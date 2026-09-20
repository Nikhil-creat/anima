"use strict";
const $=(s,r=document)=>r.querySelector(s);

/* ---------- state ---------- */
const G={mu:.15,sigma:.015,R:13,dt:.1,b:[1,0,0]};
const P={N:192,seed:7,pattern:'soup',speed:2,mode:'add',running:!matchMedia('(prefers-reduced-motion: reduce)').matches};
const PRESETS={
  glider:{mu:.15,sigma:.015,R:13,dt:.1,b:[1,0,0]},
  broad:{mu:.26,sigma:.036,R:12,dt:.1,b:[1,0,0]},
  rings:{mu:.2,sigma:.03,R:15,dt:.1,b:[1,.5,.25]}
};
let busy=false,cancel=false;

/* ---------- WebGL setup ---------- */
const canvas=$('#dish');
const gl=canvas.getContext('webgl2',{antialias:false,preserveDrawingBuffer:true});
if(!gl||!gl.getExtension('EXT_color_buffer_float')){
  $('#nogl').style.display='block';
  throw new Error('WebGL2 float rendering unavailable');
}
const VS=`#version 300 es
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.0-1.0,0.0,1.0);}`;
const FS_STEP=`#version 300 es
precision highp float;precision highp int;
uniform sampler2D u_s;uniform int u_N;uniform int u_R;
uniform float u_mu,u_sig,u_dt,u_ksum;uniform vec3 u_beta;uniform int u_B;
out vec4 o;
float core(float r){return (r>0.0&&r<1.0)?exp(4.0-1.0/(r*(1.0-r))):0.0;}
float kern(float d){
  float rr=d*float(u_B);int k=min(u_B-1,int(floor(rr)));
  float b=(k==0)?u_beta.x:((k==1)?u_beta.y:u_beta.z);
  return b*core(rr-float(k));
}
void main(){
  ivec2 p=ivec2(gl_FragCoord.xy);
  float a=texelFetch(u_s,p,0).r;
  float sum=0.0;float fR=float(u_R);
  for(int j=-15;j<=15;j++){
    if(j<-u_R||j>u_R)continue;
    for(int i=-15;i<=15;i++){
      if(i<-u_R||i>u_R)continue;
      float d=sqrt(float(i*i+j*j))/fR;
      if(d>=1.0||d==0.0)continue;
      float w=kern(d);
      if(w<=0.0)continue;
      ivec2 q=(p+ivec2(i,j)+ivec2(u_N))%ivec2(u_N);
      sum+=w*texelFetch(u_s,q,0).r;
    }
  }
  float u=sum/u_ksum;
  float g=2.0*exp(-(u-u_mu)*(u-u_mu)/(2.0*u_sig*u_sig))-1.0;
  float na=clamp(a+u_dt*g,0.0,1.0);
  o=vec4(na,na-a,u,1.0);
}`;
const FS_BRUSH=`#version 300 es
precision highp float;precision highp int;
uniform sampler2D u_s;uniform vec2 u_m;uniform float u_r;uniform float u_amt;uniform int u_N;
out vec4 o;
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  ivec2 p=ivec2(gl_FragCoord.xy);vec4 c=texelFetch(u_s,p,0);
  vec2 d=vec2(p)+0.5-u_m;float n=float(u_N);d-=n*floor(d/n+0.5);
  float w=exp(-dot(d,d)/(2.0*u_r*u_r));
  float a=clamp(c.r+u_amt*w*(0.55+0.45*hash(vec2(p)+u_m)),0.0,1.0);
  o=vec4(a,0.0,c.b,1.0);
}`;
const FS_DRAW=`#version 300 es
precision highp float;precision highp int;
uniform sampler2D u_s;uniform int u_N;uniform vec2 u_res;
out vec4 o;
vec4 f(ivec2 p){return texelFetch(u_s,(p+ivec2(u_N))%ivec2(u_N),0);}
vec3 pal(float t){
  t=clamp(t,0.0,1.0);
  vec3 c0=vec3(0.016,0.027,0.063),c1=vec3(0.043,0.196,0.376),c2=vec3(0.098,0.765,0.694),c3=vec3(0.929,1.0,0.961);
  if(t<0.35)return mix(c0,c1,t/0.35);
  if(t<0.7)return mix(c1,c2,(t-0.35)/0.35);
  return mix(c2,c3,(t-0.7)/0.3);
}
void main(){
  vec2 pos=gl_FragCoord.xy/u_res*float(u_N)-0.5;
  ivec2 i0=ivec2(floor(pos));vec2 fr=fract(pos);
  vec4 v=mix(mix(f(i0),f(i0+ivec2(1,0)),fr.x),mix(f(i0+ivec2(0,1)),f(i0+ivec2(1,1)),fr.x),fr.y);
  float a=v.r,d=v.g;
  vec3 c=pal(a);
  c+=vec3(1.0,0.28,0.42)*clamp(d*14.0,0.0,1.0)*smoothstep(0.0,0.05,a+max(d,0.0));
  c+=vec3(0.06,0.12,0.4)*clamp(-d*14.0,0.0,1.0)*smoothstep(0.0,0.05,a);
  o=vec4(c,1.0);
}`;
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
function program(fs){const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,VS));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fs));
  gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));p.u={};return p;}
const U=(p,n)=>(n in p.u)?p.u[n]:(p.u[n]=gl.getUniformLocation(p,n));
const pStep=program(FS_STEP),pBrush=program(FS_BRUSH),pDraw=program(FS_DRAW);
gl.bindVertexArray(gl.createVertexArray());

const S={N:0,tex:[],fbo:[],cur:0,buf:null};
function alloc(N){
  S.tex.forEach(t=>gl.deleteTexture(t));S.fbo.forEach(f=>gl.deleteFramebuffer(f));S.tex=[];S.fbo=[];
  for(let i=0;i<2;i++){
    const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,N,N,0,gl.RGBA,gl.FLOAT,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
    S.tex.push(t);S.fbo.push(f);
  }
  S.N=N;S.cur=0;S.buf=new Float32Array(N*N*4);
}


/* ---------- simulation steps ---------- */
function step(g){
  const N=S.N,b=normBeta(g.b);
  gl.useProgram(pStep);gl.bindFramebuffer(gl.FRAMEBUFFER,S.fbo[1-S.cur]);gl.viewport(0,0,N,N);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,S.tex[S.cur]);
  gl.uniform1i(U(pStep,'u_s'),0);gl.uniform1i(U(pStep,'u_N'),N);gl.uniform1i(U(pStep,'u_R'),g.R);
  gl.uniform1f(U(pStep,'u_mu'),g.mu);gl.uniform1f(U(pStep,'u_sig'),g.sigma);gl.uniform1f(U(pStep,'u_dt'),g.dt);
  gl.uniform1f(U(pStep,'u_ksum'),ksum(g));gl.uniform3f(U(pStep,'u_beta'),b[0],b[1],b[2]);gl.uniform1i(U(pStep,'u_B'),ringCount(b));
  gl.drawArrays(gl.TRIANGLES,0,3);S.cur=1-S.cur;
}
function brush(x,y,amt){
  const N=S.N;
  gl.useProgram(pBrush);gl.bindFramebuffer(gl.FRAMEBUFFER,S.fbo[1-S.cur]);gl.viewport(0,0,N,N);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,S.tex[S.cur]);
  gl.uniform1i(U(pBrush,'u_s'),0);gl.uniform1i(U(pBrush,'u_N'),N);
  gl.uniform2f(U(pBrush,'u_m'),x,y);gl.uniform1f(U(pBrush,'u_r'),Math.max(3,G.R*.7));gl.uniform1f(U(pBrush,'u_amt'),amt);
  gl.drawArrays(gl.TRIANGLES,0,3);S.cur=1-S.cur;
}
function draw(){
  const w=canvas.width;
  gl.useProgram(pDraw);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,w,w);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,S.tex[S.cur]);
  gl.uniform1i(U(pDraw,'u_s'),0);gl.uniform1i(U(pDraw,'u_N'),S.N);gl.uniform2f(U(pDraw,'u_res'),w,w);
  gl.drawArrays(gl.TRIANGLES,0,3);
}
function readStats(){
  const N=S.N,b=S.buf;
  gl.bindFramebuffer(gl.FRAMEBUFFER,S.fbo[S.cur]);gl.readPixels(0,0,N,N,gl.RGBA,gl.FLOAT,b);
  let m=0,c=0,act=0,n=0;
  for(let i=0;i<N*N;i++){const a=b[i*4];m+=a;if(a>.1)c++;if(a>.02){n++;act+=Math.abs(b[i*4+1]);}}
  return {mass:m/(N*N),cov:c/(N*N),act:n?act/n:0};
}

/* ---------- seeding ---------- */
function seedData(N,pattern,seed){
  const r=rng(seed),d=new Float32Array(N*N*4);
  if(pattern==='soup'){
    const rad=N*.22,c=N/2;
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){const q=Math.hypot(x-c,y-c)/rad;if(q<1)d[(y*N+x)*4]=r()*(1-q**4);}
  }else{
    for(let k=0;k<6;k++){
      const cx=N*(.2+.6*r()),cy=N*(.2+.6*r()),rad=G.R*(.8+.6*r());
      for(let y=0;y<N;y++)for(let x=0;x<N;x++){const q=Math.hypot(x-cx,y-cy)/rad;if(q<1)d[(y*N+x)*4]=Math.max(d[(y*N+x)*4],r()*(1-q*q));}
    }
  }
  return d;
}
function reseed(){
  const N=S.N;gl.bindTexture(gl.TEXTURE_2D,S.tex[S.cur]);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,N,N,0,gl.RGBA,gl.FLOAT,seedData(N,P.pattern,P.seed));hist.length=0;
}
function clearDish(){
  const N=S.N;gl.bindTexture(gl.TEXTURE_2D,S.tex[S.cur]);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,N,N,0,gl.RGBA,gl.FLOAT,new Float32Array(N*N*4));hist.length=0;
}

/* ---------- genome UI ---------- */
const fmt={R:v=>v,mu:v=>v.toFixed(3),sigma:v=>v.toFixed(4),dt:v=>v.toFixed(2),b0:v=>v.toFixed(2),b1:v=>v.toFixed(2),b2:v=>v.toFixed(2)};
function syncUI(){
  document.querySelectorAll('[data-k]').forEach(el=>{
    const k=el.dataset.k;const v=k[0]==='b'&&k.length===2?G.b[+k[1]]:G[k];
    el.value=v;el.nextElementSibling.textContent=fmt[k](+v);
  });
  $('#s-taps').textContent=(tapCount(G)*S.N*S.N/1e6).toFixed(0)+'M';
  drawMap();
}
document.querySelectorAll('[data-k]').forEach(el=>el.addEventListener('input',()=>{
  const k=el.dataset.k,v=+el.value;
  if(k[0]==='b'&&k.length===2)G.b[+k[1]]=v;else G[k]=v;
  el.nextElementSibling.textContent=fmt[k](v);
  $('#s-taps').textContent=(tapCount(G)*S.N*S.N/1e6).toFixed(0)+'M';
  drawMap();
}));
function setGenome(g){G.mu=g.mu;G.sigma=g.sigma;G.R=g.R;G.dt=g.dt;G.b=[...g.b];syncUI();}
document.querySelectorAll('[data-pre]').forEach(b=>b.addEventListener('click',()=>{setGenome(PRESETS[b.dataset.pre]);reseed();}));
$('#speed').addEventListener('input',e=>{P.speed=+e.target.value;e.target.nextElementSibling.textContent=P.speed+'×';});
$('#grid').addEventListener('change',e=>{P.N=+e.target.value;alloc(P.N);reseed();syncUI();});
$('#pattern').addEventListener('change',e=>{P.pattern=e.target.value;reseed();});
$('#seed').addEventListener('change',e=>{P.seed=clamp(+e.target.value||0,0,99999);reseed();});

/* ---------- toolbar ---------- */
function setRunning(v){P.running=v;$('#play').textContent=v?'Pause':'Play';}
$('#play').onclick=()=>setRunning(!P.running);
$('#step').onclick=()=>{setRunning(false);step(G);updateStats();};
$('#reseed').onclick=()=>{P.seed=Math.floor(Math.random()*99999);$('#seed').value=P.seed;reseed();};
$('#clear').onclick=clearDish;
function setMode(m){P.mode=m;$('#m-add').setAttribute('aria-pressed',m==='add');$('#m-erase').setAttribute('aria-pressed',m==='erase');}
$('#m-add').onclick=()=>setMode('add');$('#m-erase').onclick=()=>setMode('erase');
function toast(t){const e=$('#toast');e.textContent=t;setTimeout(()=>{e.textContent='';},2500);}
$('#png').onclick=()=>{draw();canvas.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='anima.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});};
function hashStr(){const b=normBeta(G.b);return new URLSearchParams({mu:G.mu.toFixed(4),sigma:G.sigma.toFixed(4),R:G.R,dt:G.dt.toFixed(2),b:b.join(','),seed:P.seed,n:P.N,p:P.pattern}).toString();}
$('#link').onclick=async()=>{
  history.replaceState(null,'','#'+hashStr());
  try{await navigator.clipboard.writeText(location.href);toast('Link copied');}catch(e){toast('Link is in the address bar');}
};
addEventListener('keydown',e=>{if(e.code==='Space'&&!/INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)){e.preventDefault();setRunning(!P.running);}});

/* ---------- painting ---------- */
let down=false,erase=false;
function texelPos(e){const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)/r.width*S.N,(1-(e.clientY-r.top)/r.height)*S.N];}
function paint(e){if(busy)return;const [x,y]=texelPos(e);brush(x,y,(erase||P.mode==='erase')?-.7:.4);}
canvas.addEventListener('pointerdown',e=>{down=true;erase=e.shiftKey||e.button===2;canvas.setPointerCapture(e.pointerId);paint(e);});
canvas.addEventListener('pointermove',e=>{if(down)paint(e);});
['pointerup','pointercancel'].forEach(t=>canvas.addEventListener(t,()=>{down=false;}));
canvas.addEventListener('contextmenu',e=>e.preventDefault());

/* ---------- live stats ---------- */
const hist=[];
function updateStats(){
  const s=readStats();
  $('#s-mass').textContent=(s.mass*100).toFixed(1)+'%';
  $('#s-cov').textContent=(s.cov*100).toFixed(1)+'%';
  $('#s-act').textContent=s.act.toFixed(4);
  hist.push(s.mass);if(hist.length>150)hist.shift();
  const c=$('#spark'),x=c.getContext('2d'),w=c.width,h=c.height;
  x.clearRect(0,0,w,h);x.strokeStyle='#0B7F6E';x.lineWidth=2;x.beginPath();
  const mx=Math.max(.2,...hist);
  hist.forEach((v,i)=>{const px=i/149*w,py=h-4-(v/mx)*(h-8);i?x.lineTo(px,py):x.moveTo(px,py);});x.stroke();
}

/* ---------- trials, survey, discover ---------- */
const TOTAL=300,HALF=150,SPF=10;
const T={active:false,g:null,n:0,a:null,res:null};
function trial(g){
  return new Promise(res=>{
    T.g=g;T.n=0;T.a=null;T.res=res;
    gl.bindTexture(gl.TEXTURE_2D,S.tex[S.cur]);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,S.N,S.N,0,gl.RGBA,gl.FLOAT,seedData(S.N,P.pattern,P.seed));
    T.active=true;
  });
}
function setBusy(v){
  busy=v;cancel=false;
  ['play','step','reseed','clear','survey','discover','grid','pattern','seed','bench','libsave'].forEach(id=>$('#'+id).disabled=v);
  document.querySelectorAll('[data-pre]').forEach(b=>b.disabled=v);
  $('#stop').hidden=!v;$('#prog').hidden=!v;
}
$('#stop').onclick=()=>{cancel=true;};

const M={mu:[.08,.32],sg:[.008,.05],n:12,cells:[]};
const CLS={extinct:'#D5DDD9',static:'#A9BCD6',saturated:'#F0A3AE'};
function cellColor(c){
  if(!c)return null;if(CLS[c.cls])return CLS[c.cls];
  const t=c.score;const a=[143,227,207],b=[8,110,88];
  return `rgb(${a.map((v,i)=>Math.round(lerp(v,b[i],t))).join(',')})`;
}
function drawMap(){
  const cv=$('#map'),x=cv.getContext('2d'),w=cv.width,n=M.n,cs=w/n;
  x.clearRect(0,0,w,w);x.fillStyle='#EEF2F0';x.fillRect(0,0,w,w);
  for(let gy=0;gy<n;gy++)for(let gx=0;gx<n;gx++){
    const col=cellColor(M.cells[gy*n+gx]);
    if(col){x.fillStyle=col;x.fillRect(gx*cs,w-(gy+1)*cs,cs,cs);}
    x.strokeStyle='rgba(13,26,23,.08)';x.strokeRect(gx*cs,w-(gy+1)*cs,cs,cs);
  }
  const px=(G.mu-M.mu[0])/(M.mu[1]-M.mu[0])*w,py=w-(G.sigma-M.sg[0])/(M.sg[1]-M.sg[0])*w;
  if(px>=0&&px<=w&&py>=0&&py<=w){x.lineWidth=4;x.strokeStyle='#fff';x.beginPath();x.arc(px,py,10,0,7);x.stroke();
    x.lineWidth=2;x.strokeStyle='#FF4F73';x.beginPath();x.arc(px,py,10,0,7);x.stroke();}
}
$('#map').addEventListener('click',e=>{
  if(busy)return;const r=e.currentTarget.getBoundingClientRect();
  const tx=(e.clientX-r.left)/r.width,ty=1-(e.clientY-r.top)/r.height;
  G.mu=lerp(M.mu[0],M.mu[1],tx);G.sigma=lerp(M.sg[0],M.sg[1],ty);syncUI();reseed();
});
async function survey(){
  setBusy(true);const n=M.n;M.cells=new Array(n*n).fill(null);drawMap();
  const base=cloneG(G);
  outer:for(let gy=0;gy<n;gy++)for(let gx=0;gx<n;gx++){
    if(cancel)break outer;
    const g=cloneG(base);g.mu=lerp(M.mu[0],M.mu[1],(gx+.5)/n);g.sigma=lerp(M.sg[0],M.sg[1],(gy+.5)/n);
    const r=await trial(g);M.cells[gy*n+gx]=judge(r.a,r.b);drawMap();$('#prog').value=(gy*n+gx+1)/(n*n);
  }
  const alive=M.cells.filter(c=>c&&c.cls==='alive').length;
  addLog(`Survey done · ${alive} of ${M.cells.filter(Boolean).length} genomes alive`,true);
  $('#export').disabled=false;
  setBusy(false);reseed();
}
function gauss(r){return Math.sqrt(-2*Math.log(1-r()))*Math.cos(2*Math.PI*r());}
function mutate(g,wide){
  const r=Math.random,c=cloneG(g),k=wide?2:1;
  c.mu=clamp(c.mu+gauss(r)*.012*k,.05,.4);c.sigma=clamp(c.sigma+gauss(r)*.004*k,.005,.08);
  if(r()<.25)c.R=clamp(c.R+(r()<.5?-1:1),8,15);
  for(let i=1;i<3;i++)if(r()<.35)c.b[i]=clamp(Math.round((c.b[i]+gauss(r)*.2)*20)/20,0,1);
  return c;
}
const desc=g=>`μ ${g.mu.toFixed(3)} σ ${g.sigma.toFixed(4)} R ${g.R}`;
function addLog(t,best){const li=document.createElement('li');li.textContent=t;if(best)li.className='best';const l=$('#log');l.prepend(li);while(l.children.length>30)l.lastChild.remove();}
async function discover(){
  setBusy(true);const GENS=10,KIDS=6;
  let best={g:cloneG(G)};let r=await trial(best.g);best.j=judge(r.a,r.b);
  addLog(`Gen 0 · score ${best.j.score.toFixed(2)} · ${desc(best.g)} · ${best.j.cls}`,true);
  for(let gen=1;gen<=GENS&&!cancel;gen++){
    const kids=[];
    for(let k=0;k<KIDS&&!cancel;k++){const g=mutate(best.g,best.j.score===0);const rr=await trial(g);kids.push({g,j:judge(rr.a,rr.b)});$('#prog').value=((gen-1)*KIDS+k+1)/(GENS*KIDS);}
    if(!kids.length)break;
    kids.sort((a,b)=>b.j.score-a.j.score);
    const improved=kids[0].j.score>=best.j.score;
    if(improved)best=kids[0];
    addLog(`Gen ${gen} · score ${best.j.score.toFixed(2)} · ${desc(best.g)} · ${best.j.cls}`,improved);
    setGenome(best.g);
  }
  setGenome(best.g);setBusy(false);reseed();
}
$('#survey').onclick=survey;$('#discover').onclick=discover;

/* ---------- survey export ---------- */
function download(name,type,text){
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
$('#export').onclick=()=>{
  const n=M.n,b=normBeta(G.b);
  const head=[`# Anima survey · seed ${P.seed} · pattern ${P.pattern} · grid ${P.N} · R ${G.R} · dt ${G.dt} · rings ${b.join('/')} · ${TOTAL} steps per trial`,'mu,sigma,class,score'];
  const rows=[];
  for(let gy=0;gy<n;gy++)for(let gx=0;gx<n;gx++){
    const c=M.cells[gy*n+gx];if(!c)continue;
    rows.push([lerp(M.mu[0],M.mu[1],(gx+.5)/n).toFixed(4),lerp(M.sg[0],M.sg[1],(gy+.5)/n).toFixed(4),c.cls,c.score.toFixed(3)].join(','));
  }
  download('anima-survey.csv','text/csv',head.concat(rows).join('\n'));
};

/* ---------- genome library ---------- */
const LIB='anima:library:v1';
function libLoad(){try{const a=JSON.parse(localStorage.getItem(LIB)||'[]');return Array.isArray(a)?a:[];}catch(e){return [];}}
function libStore(a){try{localStorage.setItem(LIB,JSON.stringify(a.slice(0,60)));return true;}catch(e){toast('Browser storage is unavailable');return false;}}
function cleanGenome(x){
  if(!x||typeof x!=='object')return null;
  const g=x.g||{};const b=Array.isArray(g.b)?g.b:[1,0,0];
  const out={name:String(x.name||'Untitled').slice(0,40),
    g:{mu:clamp(+g.mu||.15,.05,.4),sigma:clamp(+g.sigma||.015,.005,.08),R:clamp(Math.round(+g.R)||13,6,15),dt:clamp(+g.dt||.1,.02,.3),b:[0,1,2].map(i=>clamp(+b[i]||0,0,1))},
    seed:clamp(Math.round(+x.seed)||7,0,99999),pattern:x.pattern==='blobs'?'blobs':'soup'};
  return out;
}
function renderLib(){
  const ul=$('#lib'),a=libLoad();ul.textContent='';
  if(!a.length){const li=document.createElement('li');li.textContent='Nothing saved yet.';ul.appendChild(li);return;}
  a.forEach((it,i)=>{
    const li=document.createElement('li'),sp=document.createElement('span'),sm=document.createElement('small');
    sp.textContent=it.name;sm.textContent=desc(it.g)+' · seed '+it.seed;sp.appendChild(sm);
    const l=document.createElement('button');l.textContent='Load';l.setAttribute('aria-label','Load '+it.name);
    l.onclick=()=>{if(busy)return;setGenome(it.g);P.seed=it.seed;P.pattern=it.pattern;$('#seed').value=P.seed;$('#pattern').value=P.pattern;reseed();};
    const d=document.createElement('button');d.textContent='Delete';d.setAttribute('aria-label','Delete '+it.name);
    d.onclick=()=>{const b=libLoad();b.splice(i,1);libStore(b);renderLib();};
    li.append(sp,l,d);ul.appendChild(li);
  });
}
$('#libsave').onclick=()=>{
  const a=libLoad(),name=($('#libname').value.trim()||`Genome ${a.length+1}`).slice(0,40);
  a.unshift({name,g:cloneG(G),seed:P.seed,pattern:P.pattern});
  if(libStore(a)){$('#libname').value='';renderLib();toast('Saved');}
};
$('#libexport').onclick=()=>download('anima-genomes.json','application/json',JSON.stringify({app:'anima',version:1,genomes:libLoad()},null,2));
$('#libimport').addEventListener('change',async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  try{
    const j=JSON.parse(await f.text());
    const items=(Array.isArray(j)?j:j.genomes||[]).map(cleanGenome).filter(Boolean);
    if(!items.length)throw new Error('empty');
    libStore(items.concat(libLoad()));renderLib();toast(`Imported ${items.length}`);
  }catch(err){toast('That file is not a valid Anima genome file');}
});

/* ---------- benchmark ---------- */
async function benchmark(){
  setBusy(true);const g=cloneG(G),N=S.N,CH=10,CHUNKS=20;
  const sync=()=>{gl.bindFramebuffer(gl.FRAMEBUFFER,S.fbo[S.cur]);gl.readPixels(0,0,1,1,gl.RGBA,gl.FLOAT,new Float32Array(4));};
  $('#b-sps').textContent='running…';
  for(let i=0;i<5;i++)step(g);sync();
  let ms=0;
  for(let c=0;c<CHUNKS;c++){
    const t0=performance.now();for(let i=0;i<CH;i++)step(g);sync();ms+=performance.now()-t0;
    await new Promise(r=>requestAnimationFrame(r));
  }
  const steps=CH*CHUNKS,sps=steps/ms*1000,taps=tapCount(g)*N*N*sps;
  $('#b-sps').textContent=`${sps.toFixed(1)} at ${N}×${N}`;
  $('#b-taps').textContent=`${(taps/1e9).toFixed(2)} billion taps / s`;
  setBusy(false);reseed();
}
$('#bench').onclick=benchmark;
(function(){
  const x=gl.getExtension('WEBGL_debug_renderer_info');
  $('#b-gpu').textContent=x?gl.getParameter(x.UNMASKED_RENDERER_WEBGL):'hidden by browser';
})();

/* ---------- main loop ---------- */
function fit(){const r=canvas.getBoundingClientRect(),w=Math.round(Math.min(900,r.width*Math.min(devicePixelRatio||1,2)));if(w&&canvas.width!==w){canvas.width=canvas.height=w;}}
addEventListener('resize',fit);
let frameNo=0;
function frame(){
  requestAnimationFrame(frame);fit();
  if(T.active){
    for(let k=0;k<SPF&&T.active;k++){
      step(T.g);T.n++;
      if(T.n===HALF)T.a=readStats();
      if(T.n>=TOTAL){const b=readStats();T.active=false;T.res({a:T.a,b});}
    }
  }else if(P.running&&!busy){
    for(let k=0;k<P.speed;k++)step(G);
    if(++frameNo%10===0)updateStats();
  }
  draw();
}

/* ---------- boot ---------- */
(function init(){
  const q=new URLSearchParams(location.hash.slice(1));
  if(q.has('mu')){
    G.mu=clamp(+q.get('mu'),.05,.4);G.sigma=clamp(+q.get('sigma'),.005,.08);G.R=clamp(Math.round(+q.get('R'))||13,6,15);G.dt=clamp(+q.get('dt')||.1,.02,.3);
    const b=(q.get('b')||'1,0,0').split(',').map(Number);G.b=[0,1,2].map(i=>clamp(b[i]||0,0,1));
    P.seed=clamp(+q.get('seed')||7,0,99999);if([128,192,256].includes(+q.get('n')))P.N=+q.get('n');
    if(q.get('p')==='blobs')P.pattern='blobs';
  }
  $('#grid').value=P.N;$('#pattern').value=P.pattern;$('#seed').value=P.seed;
  $('#speed').nextElementSibling.textContent=P.speed+'×';
  alloc(P.N);reseed();syncUI();renderLib();setRunning(P.running);fit();
  requestAnimationFrame(frame);
})();
