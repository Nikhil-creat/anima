/* Shared test cases. Runs in the browser (tests/index.html) and in Node/CI (tests/run-node.js). */
const CASES=[
  ['kernel core peaks at 1 for r = 0.5',()=>assertClose(core(0.5),1,1e-12)],
  ['kernel core is zero outside (0,1)',()=>{assertEq(core(0),0);assertEq(core(1),0);assertEq(core(1.4),0);}],
  ['normBeta falls back to a single ring when all weights are zero',()=>assertEq(normBeta([0,0,0]).join(),'1,0,0')],
  ['ksum is positive for a default genome',()=>assert(ksum({R:13,b:[1,0,0]})>0)],
  ['ksum scales linearly with ring weight',()=>assertClose(ksum({R:13,b:[2,0,0]})/ksum({R:13,b:[1,0,0]}),2,1e-9)],
  ['ksum grows roughly with the square of the radius',()=>{const r=ksum({R:12,b:[1,0,0]})/ksum({R:6,b:[1,0,0]});assert(r>3&&r<4.6,'ratio '+r);}],
  ['a single ring spans the full radius',()=>{assertEq(ringCount([1,0,0]),1);let far=0;for(let d=.7;d<.95;d+=.01)far+=kern(d,[1,0,0]);assert(far>0,'outer kernel is empty');}],
  ['ring count follows the last non-zero weight',()=>{assertEq(ringCount([1,.5,0]),2);assertEq(ringCount([1,0,.2]),3);}],
  ['tapCount is close to pi R^2',()=>{const t=tapCount({R:13,b:[1,0,0]});assert(Math.abs(t-Math.PI*169)<40,'taps '+t);}],
  ['rng is deterministic for a seed',()=>{const a=rng(7),b=rng(7);for(let i=0;i<50;i++)assertEq(a(),b());}],
  ['rng differs between seeds',()=>assert(rng(1)()!==rng(2)())],
  ['rng stays within [0,1)',()=>{const r=rng(99);for(let i=0;i<1000;i++){const v=r();assert(v>=0&&v<1);}}],
  ['judge: vanishing mass is extinct',()=>assertEq(judge({mass:.1,cov:.1,act:.01},{mass:.0005,cov:0,act:0}).cls,'extinct')],
  ['judge: huge mass is saturated',()=>assertEq(judge({mass:.4,cov:.5,act:.01},{mass:.6,cov:.9,act:.01}).cls,'saturated')],
  ['judge: no motion is static',()=>assertEq(judge({mass:.05,cov:.05,act:.0},{mass:.05,cov:.05,act:.0001}).cls,'static')],
  ['judge: compact moving structures score above zero',()=>{const j=judge({mass:.03,cov:.06,act:.003},{mass:.03,cov:.06,act:.004});assertEq(j.cls,'alive');assert(j.score>.5,'score '+j.score);}],
  ['judge: scores stay within [0,1]',()=>{const j=judge({mass:.01,cov:.3,act:.01},{mass:.3,cov:.4,act:.05});assert(j.score>=0&&j.score<=1);}],
  ['cloneG produces an independent copy',()=>{const g={mu:.1,sigma:.02,R:10,dt:.1,b:[1,0,0]},c=cloneG(g);c.b[0]=.5;assertEq(g.b[0],1);}],
  ['clamp and lerp behave',()=>{assertEq(clamp(5,0,1),1);assertEq(clamp(-5,0,1),0);assertEq(lerp(0,10,.25),2.5);}]
];
function assert(c,m){if(!c)throw new Error(m||'assertion failed');}
function assertEq(a,b){if(a!==b)throw new Error(`expected ${b}, got ${a}`);}
function assertClose(a,b,e){if(Math.abs(a-b)>e)throw new Error(`expected ${b}, got ${a}`);}
