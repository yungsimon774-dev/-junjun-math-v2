import assert from 'node:assert/strict';
globalThis.window={};
const saved=new Map();globalThis.localStorage={getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)};
for(const name of ['v12-config','courses','v12-bank-foundation','v12-bank-application','v12-bank-visual','v12-bank-symbol','v12-bank-life','v12-skill-map'])await import(`../${name}.js`);
const {LearningEngine,answerDescriptor}=await import('../v12-engine.js');
const {V12Store}=await import('../v12-store.js');
const {verificationOutcome}=await import('../v12-verification.js');
const {createOpenChallenge,checkOpenChallenge}=await import('../v12-open.js');
const store=new V12Store(),engine=new LearningEngine(store);
const source=engine.catalog.find(q=>(engine.bySkill.get(q.skillId)||[]).filter(candidate=>candidate.template===q.template&&candidate.options[candidate.answer]!==q.options[q.answer]&&answerDescriptor(candidate).supported).length>8);
assert.ok(source);
const item={question:source,stage:'independent',example:false};
engine.recordResult(item,{firstCorrect:false,recovered:true,hints:1,firstWrongEntry:{value:'999'},entry:{value:source.options[source.answer]}});
const session={id:'test-session',type:'learning',items:[item,{question:engine.catalog.find(q=>q.qid!==source.qid),stage:'independent'}]};
const task=engine.queueVerification(session,item,0);
assert.equal(task.status,'pending');assert.equal(session.items.length,3);
const check=session.items[2];assert.equal(check.stage,'verification');assert.equal(check.verificationOf,source.qid);
assert.notEqual(check.question.qid,source.qid);assert.notEqual(check.question.prompt,source.prompt);assert.notEqual(check.question.options[check.question.answer],source.options[source.answer]);
assert.equal(check.question.skillId,source.skillId);assert.equal(check.question.template,source.template);assert.equal(answerDescriptor(check.question).supported,true);
assert.equal(engine.queueVerification(session,check,2),null);
engine.recordResult(check,{firstCorrect:true,hints:1,entry:{value:check.question.options[check.question.answer]}});
assert.equal(task.status,'assisted');assert.equal(store.state.mistakes.some(q=>q.qid===source.qid),true);
engine.recordResult(check,{firstCorrect:false,recovered:false,hints:0,entry:{value:'999'}});
assert.equal(task.status,'retry');
const retry=engine.buildVerificationSession();assert.ok(retry.items.length);
engine.recordResult(retry.items[0],{firstCorrect:true,hints:0,entry:{value:retry.items[0].question.options[retry.items[0].question.answer]}});
assert.equal(task.status,'passed');assert.equal(store.state.mistakes.some(q=>q.qid===source.qid),false);
assert.equal(engine.buildVerificationSession().items.length,0);
assert.equal(verificationOutcome({firstCorrect:false,recovered:true,hints:0}),'assisted');
const capped={id:'capped',type:'random',items:[item],verificationAdded:2};
assert.equal(engine.queueVerification(capped,item,0).status,'pending');assert.equal(capped.items.length,1);
const unavailable=engine.queueVerification({id:'none',type:'learning',items:[item]}, {question:{...source,qid:'missing-source',skillId:'missing-skill'},stage:'independent'},0);
assert.equal(unavailable.status,'unavailable');
const diagnostic={id:'diagnostic',type:'diagnostic',items:[item]};assert.equal(engine.queueVerification(diagnostic,item,0),null);
store.save();const copy=new V12Store();assert.equal(copy.state.verificationTasks.length,2);
let combinations=0;
for(let total=8;total<=20;total++)for(const kind of ['multiple','missing']){
 const challenge=createOpenChallenge(kind,total);
 for(let apple=1;apple<total;apple++){
  const pair=checkOpenChallenge(challenge,[String(apple),String(total-apple)]);assert.equal(pair.ok,true);combinations++;
  if(kind==='multiple')assert.equal(checkOpenChallenge(challenge,[String(total-apple),String(apple)],[pair]).ok,false);
 }
 for(const values of [['',''],['0',String(total)],[String(total),'-1'],['2.5',String(total-2.5)],['1','1']])assert.equal(checkOpenChallenge(challenge,values).ok,false);
}
console.log(JSON.stringify({result:'PASS',openCombinations:combinations,tests:['different structure-matched variant','changed answer','fill-compatible variant','delayed insertion and two-item cap','no verification chains','assisted and failed checks retain mistakes','independent pass clears source mistake','pending-task persistence','missing variant cannot pass','diagnostic unaffected','multiple answers','swapped-pair deduplication','missing-condition arithmetic']},null,2));
