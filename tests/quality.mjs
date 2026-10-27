import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
globalThis.window={};
let disk=new Map(),blockRead=false,blockWrite=false,failKey='';
globalThis.localStorage={getItem:key=>{if(blockRead)throw Error('disabled');return disk.get(key)||null},setItem:(key,value)=>{if(blockWrite||key===failKey)throw Error('quota');disk.set(key,value)}};
for(const name of ['v12-config','courses','v12-bank-foundation','v12-bank-application','v12-bank-visual','v12-bank-symbol','v12-bank-life','v12-skill-map'])await import(`../${name}.js`);
const {LearningEngine,answerDescriptor,compareAnswer}=await import('../v12-engine.js');
const {validateTutorQuestion,evaluateExpression}=await import('../v12-tutor.js');
const {V12Store}=await import('../v12-store.js');
const store=new V12Store(),engine=new LearningEngine(store);
let checked=0;
const methods={};
for(const q of engine.catalog){
 const tutor=validateTutorQuestion(q);assert.equal(tutor.valid,true,q.qid);methods[tutor.methodId]=(methods[tutor.methodId]||0)+1;
 const descriptor=answerDescriptor(q);
 if(descriptor.supported){
  const entry=descriptor.type==='compound'?{values:descriptor.values}:{value:descriptor.type==='number'?String(descriptor.value):descriptor.value};
  assert.equal(compareAnswer(descriptor,entry),true,q.qid);checked++;
 }
 if(descriptor.type==='number'){
  const expression=q.prompt.replace(/\s/g,'').match(/^([\d()+\-×÷]+)(?:=|＝)?[?？]$/);
  if(expression){const result=evaluateExpression(expression[1]);if(result!==null)assert.equal(result,descriptor.value,q.qid)}
 }
}
for(const value of ['',null,undefined,' ','0x0','0e2',[],{},false])assert.equal(compareAnswer({supported:true,type:'number',value:0},{value}),false);
assert.equal(compareAnswer({supported:true,type:'number',value:12},{value:'１２'}),true);
assert.equal(compareAnswer({supported:true,type:'number',value:12},{value:' 12 '}),true);
assert.equal(compareAnswer({supported:true,type:'compound',values:[0,2]},{values:['',2]}),false);
assert.equal(compareAnswer({supported:true,type:'compound',values:[0,2]},{values:[0,2,3]}),false);
const course='g1u1',skills=[...engine.bySkill.keys()].filter(id=>id.startsWith(course+'::'));
store.state.profile.grade=1;store.state.skillStats[skills[0]]={attempts:100,firstCorrect:100,stage:{transfer:{attempts:10,correct:10}}};
store.state.courseStats[course]={attempts:100,firstCorrect:100,transferCorrect:10};
const practicedQuestion=engine.byCourse.get(course)[0];store.state.questionStats[practicedQuestion.qid]={attempts:100,firstCorrect:100};
assert.equal(engine.courseCoverage(course).practiced,1);assert.ok(engine.courseMastery(course)<85);assert.notEqual(engine.courseStatus(course).level,'已掌握');
const summary={score:100,firstCorrect:1,recovered:0,total:1,minutes:0,results:[]},session={course:engine.getCourse(course),type:'random'};
engine.completeSession(session,summary);const stars=store.state.stats.stars;engine.completeSession(session,summary);assert.equal(store.state.stats.stars,stars);
assert.equal(store.state.completedCourses.includes(course),false);

const KEY='junjun_math_v12';
store.state.stats.stars=88;store.save();const before=store.snapshot();
store.importPayload({data:{schema:12,stats:{stars:'22',attempts:'3',firstCorrect:'9'},questionStats:{bad:null},profile:{grade:9}}});
assert.equal(store.state.stats.stars,22);assert.equal(store.state.stats.firstCorrect,3);assert.equal(store.state.profile.grade,2);assert.deepEqual(store.state.questionStats,{});
assert.equal(store.hasImportBackup(),true);store.restoreImportBackup();assert.equal(store.state.stats.stars,before.stats.stars);
const oldPrimary=disk.get(KEY),oldMemory=store.snapshot();failKey=KEY;
assert.throws(()=>store.importPayload({data:{schema:12,stats:{stars:5}}}),/未替换/);assert.equal(disk.get(KEY),oldPrimary);assert.deepEqual(store.snapshot(),oldMemory);failKey='';
assert.throws(()=>store.importPayload({data:[{schema:12}]}));
blockWrite=true;store.state.stats.stars=99;assert.equal(store.save(),false);assert.match(store.storageError,/未能保存/);assert.throws(()=>store.reset());assert.equal(store.state.stats.stars,99);blockWrite=false;
disk=new Map([[KEY,'broken-json']]);const recovered=new V12Store();assert.equal(recovered.recoveryRaw,'broken-json');assert.ok([...disk.values()].includes('broken-json'));assert.equal(new V12Store().recoveryRaw,'broken-json');
disk=new Map([[KEY,'broken-json']]);blockWrite=true;const noBackup=new V12Store();assert.equal(noBackup.canWrite,false);assert.equal(disk.get(KEY),'broken-json');blockWrite=false;
disk=new Map([[KEY,JSON.stringify({schema:99,stats:{stars:999}})]]);const future=new V12Store();assert.equal(future.canWrite,false);assert.equal(JSON.parse(disk.get(KEY)).schema,99);
blockRead=true;const denied=new V12Store();assert.equal(denied.save(),false);assert.match(denied.storageError,/未允许/);blockRead=false;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'release-manifest.json'),'utf8'));assert.equal(manifest.release,'120170');
for(const entry of manifest.files)assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root,entry.path))).digest('hex'),entry.sha256,entry.path);
console.log(JSON.stringify({result:'PASS',tutorsChecked:engine.catalog.length,fillableChecked:checked,teachingMethods:Object.keys(methods).length,learningUnits:engine.byUnit.size,releaseFiles:manifest.files.length,tests:['all generated tutor arithmetic checks','fillable answer round trips','strict empty/number/compound boundaries','unpractised coverage cannot inflate completion','session reward idempotence','normalised imports','recoverable import backup','failed import is non-destructive','storage denial and quota warning','corrupt original retention','future version protection','release digest consistency'],limits:'Automated arithmetic/structure checks do not prove all word-problem semantics or teaching effectiveness.'},null,2));
