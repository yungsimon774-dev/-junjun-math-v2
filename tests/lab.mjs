import assert from 'node:assert/strict';
import {createLab,restoreLab,changeLab,labSolved,expandedTotal,labTotal,balanceDifference,labRecord} from '../v12-lab.js';
let puzzles=0,steps=0;
for(let a=1;a<=5;a++)for(let b=2;b<=4;b++)for(let c=1;c<=4;c++){
 const lab=createLab('substitution',{a,b,c});
 const total=a*b+c;assert.equal(expandedTotal(lab),total);assert.equal(labTotal(lab),total);
 lab.answer=String(total);assert.equal(labSolved(lab).ok,false);
 while(lab.board.tokens.some(t=>t.kind!=='unit')){
  const before=JSON.stringify(lab.board),token=lab.board.tokens.find(t=>t.kind!=='unit');
  assert.equal(changeLab(lab,{type:'expand',id:token.id}).ok,true);assert.equal(expandedTotal(lab),total);
  assert.equal(changeLab(lab,{type:'undo'}).ok,true);assert.equal(JSON.stringify(lab.board),before);
  assert.equal(changeLab(lab,{type:'expand',id:token.id}).ok,true);assert.equal(expandedTotal(lab),total);steps++;
 }
 assert.equal(lab.board.tokens.length,total);assert.equal(labSolved(lab).ok,true);
 lab.answer='';assert.equal(labSolved(lab).ok,false);lab.answer=String(total+1);assert.equal(labSolved(lab).ok,false);
 lab.answer=String(total);lab.completed=true;lab.note='<script>no()</script>';
 const restored=restoreLab(JSON.parse(JSON.stringify(lab)));assert.ok(restored);assert.equal(restored.completed,true);assert.equal(restored.note,lab.note);
 assert.equal(labRecord(lab).moves,2*(b+1));assert.equal(labRecord(lab).undoCount,b+1);
 const broken=JSON.parse(JSON.stringify(lab));broken.board.tokens.pop();assert.equal(restoreLab(broken),null);
 const invalid=JSON.parse(JSON.stringify(lab));invalid.board.tokens[0].kind='unknown';assert.equal(restoreLab(invalid),null);
 const balance=createLab('balance',{a,b,c});balance.answer=String(a);
 assert.equal(balanceDifference(balance),0);assert.equal(labSolved(balance).ok,false);
 changeLab(balance,{type:'add',side:'left'});assert.equal(balanceDifference(balance),1);
 changeLab(balance,{type:'bothAdd'});assert.equal(balanceDifference(balance),1);
 changeLab(balance,{type:'undo'});changeLab(balance,{type:'undo'});assert.equal(balanceDifference(balance),0);
 changeLab(balance,{type:'move',from:'left',to:'right'});assert.equal(balanceDifference(balance),-2);
 changeLab(balance,{type:'undo'});assert.equal(balanceDifference(balance),0);
 for(let i=0;i<c;i++){assert.equal(changeLab(balance,{type:'bothRemove'}).ok,true);assert.equal(balanceDifference(balance),0);steps++}
 assert.equal(labSolved(balance).ok,true);assert.equal(changeLab(balance,{type:'bothRemove'}).ok,false);
 balance.completed=true;assert.equal(restoreLab(JSON.parse(JSON.stringify(balance))).completed,true);
 const wrong=JSON.parse(JSON.stringify(balance));wrong.answer='999';assert.equal(restoreLab(wrong).completed,false);
 puzzles+=2;
}
const boundary=createLab('balance',{a:1,b:2,c:1});
while(boundary.board.leftUnits<30)changeLab(boundary,{type:'add',side:'left'});
const before=JSON.stringify(boundary.board);assert.equal(changeLab(boundary,{type:'add',side:'left'}).ok,false);assert.equal(JSON.stringify(boundary.board),before);
for(let i=0;i<100;i++){changeLab(boundary,{type:'remove',side:'left'});changeLab(boundary,{type:'add',side:'left'})}
assert.equal(boundary.history.length,40);assert.equal(boundary.events.length,40);
assert.equal(restoreLab({}),null);assert.equal(restoreLab(null),null);
const demo=createLab('substitution');assert.equal(changeLab(demo,{type:'expand',id:999}).ok,false);
const untouched=createLab('balance');untouched.completed=true;assert.equal(restoreLab(untouched).completed,false);
const storage=new Map();globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
const {V12Store}=await import('../v12-store.js');
const store=new V12Store();store.state.stats.stars=77;store.state.manipulativeDraft=boundary;store.state.manipulativeRecords=[labRecord(boundary)];store.save();
const reopened=new V12Store();assert.equal(restoreLab(reopened.state.manipulativeDraft).board.leftUnits,30);assert.equal(reopened.state.manipulativeRecords.length,1);assert.equal(reopened.state.stats.stars,77);
const exported=reopened.exportPayload('Build012');const imported=new V12Store();imported.importPayload(exported);assert.ok(restoreLab(imported.state.manipulativeDraft));
imported.importPayload({data:{schema:12,stats:{stars:31},mistakes:[]}});assert.equal(imported.state.stats.stars,31);assert.deepEqual(imported.state.manipulativeRecords,[]);assert.equal(imported.state.manipulativeDraft,null);
console.log(JSON.stringify({result:'PASS',puzzles,checkedTransformationSteps:steps,tests:['every valid puzzle combination','substitution quantity invariant','stepwise decomposition','exact undo','balance direction and simultaneous operations','cross-pan unit movement','completion requires representation and answer','invalid/empty answers','safe draft restore','imported flag cannot fake completion','bounds and bounded history']},null,2));
