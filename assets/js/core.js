/* Anima core: pure functions shared by the app, the unit tests and the CI runner. No DOM or WebGL here. */
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const cloneG=g=>({mu:g.mu,sigma:g.sigma,R:g.R,dt:g.dt,b:[...g.b]});
/* ---------- kernel normalisation (mirrors the shader) ---------- */
const core=r=>(r>0&&r<1)?Math.exp(4-1/(r*(1-r))):0;
/* Number of concentric rings in use: the kernel radius is split evenly between them. */
function ringCount(b){return b[2]>0?3:(b[1]>0?2:1);}
function kern(d,b){const B=ringCount(b),rr=d*B,k=Math.min(B-1,Math.floor(rr));return b[k]*core(rr-k);}
const ksumCache=new Map();
function normBeta(b){return (b[0]+b[1]+b[2])>0?b:[1,0,0];}
function ksum(g){
  const b=normBeta(g.b),key=g.R+'|'+b.join(',');
  if(ksumCache.has(key))return ksumCache.get(key);
  let s=0;for(let j=-g.R;j<=g.R;j++)for(let i=-g.R;i<=g.R;i++){const d=Math.hypot(i,j)/g.R;if(d>=1||d===0)continue;s+=kern(d,b);}
  s=s||1;ksumCache.set(key,s);return s;
}
function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function judge(a,b){
  if(b.mass<.003)return {cls:'extinct',score:0};
  if(b.mass>.45)return {cls:'saturated',score:.03};
  if(b.act<.0008)return {cls:'static',score:.06};
  const dyn=clamp(b.act/.004,0,1);
  const stab=clamp(1-Math.abs(Math.log(b.mass/Math.max(a.mass,1e-6))),0,1);
  const loc=Math.exp(-(((b.cov-.06)/.09)**2));
  return {cls:'alive',score:clamp(dyn*loc*(.3+.7*stab),0,1)};
}

/* Number of kernel taps a single cell reads per step at this genome. */
function tapCount(g){const b=normBeta(g.b);let n=0;for(let j=-g.R;j<=g.R;j++)for(let i=-g.R;i<=g.R;i++){const d=Math.hypot(i,j)/g.R;if(d>=1||d===0)continue;if(kern(d,b)>0)n++;}return n;}
