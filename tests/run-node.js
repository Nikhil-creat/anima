/* Runs the core unit tests in Node with no dependencies: `node tests/run-node.js` */
const fs=require('fs'),vm=require('vm'),path=require('path');
const ctx=vm.createContext({console,Math});
const load=f=>vm.runInContext(fs.readFileSync(path.join(__dirname,f),'utf8'),ctx,{filename:f});
load('../assets/js/core.js');load('cases.js');
const cases=vm.runInContext('CASES',ctx);
let fail=0;
for(const [name,fn] of cases){
  try{fn();console.log('  ok   '+name);}catch(e){fail++;console.log('  FAIL '+name+' -> '+e.message);}
}
console.log(`\n${cases.length-fail}/${cases.length} passed`);
process.exit(fail?1:0);
