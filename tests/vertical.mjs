import assert from 'node:assert/strict';
import {verticalProblem,checkVertical,createVerticalRound,restoreVerticalRound,verticalSummary} from '../v12-vertical.js';
let checked=0;
for(let a=10;a<=999;a+=7)for(let b=2;b<=9;b++)for(const op of ['+','-','×','÷']){
 const p=verticalProblem(op,a,b);assert.equal(checkVertical(p,p.fields).correct,true);
 assert.equal(p.result,op==='+'?a+b:op==='-'?a-b:op==='×'?a*b:Math.floor(a/b));
 for(const key of Object.keys(p.fields)){
  assert.equal(checkVertical(p,{...p.fields,[key]:''}).complete,false);
  assert.equal(checkVertical(p,{...p.fields,[key]:String(Number(p.fields[key])+1)}).correct,false);
 }
 if(op==='÷'){
  assert.equal(p.result*b+p.remainder,a);assert.ok(p.remainder<b);
  const quotient=p.rows[0].cells.map(c=>c.key?p.fields[c.key]:'').join('');assert.equal(Number(quotient),Math.floor(a/b));
  const remKeys=Object.keys(p.fields).filter(k=>/^r\d+$/.test(k));assert.equal(Number(p.fields[remKeys.at(-1)]),a%b);
 }
 checked++;
}
const add=verticalProblem('+',58,67);assert.equal(add.fields.carry1,'1');assert.equal(add.fields.carry2,'1');assert.equal(add.result,125);
const sub=verticalProblem('-',302,178);assert.equal(sub.fields.work0,'12');assert.equal(sub.fields.work1,'9');assert.equal(sub.fields.work2,'2');assert.equal(sub.result,124);
const mul=verticalProblem('×',246,7);assert.equal(mul.fields.carry1,'4');assert.equal(mul.fields.carry2,'3');assert.equal(mul.fields.carry3,'1');assert.equal(mul.result,1722);
const div=verticalProblem('÷',408,4);assert.equal(div.fields.q0,'1');assert.equal(div.fields.q1,'0');assert.equal(div.fields.q2,'2');assert.equal(div.remainder,0);
assert.equal(checkVertical(add,Object.fromEntries(Object.entries(add.fields).map(([k,v])=>[k,v.replace(/\d/g,d=>String.fromCharCode(65296+Number(d)))]))).correct,true);
for(const value of ['',' ',null,[],{},'0x1','1e0','1.0','-1'])assert.equal(checkVertical(add,{...add.fields,carry1:value}).complete,false);
for(const args of [['/',10,2],['-',10,20],['÷',12,0],['×',12,10],['+',1000,1]])assert.throws(()=>verticalProblem(...args));
for(const op of ['mixed','+','-','×','÷']){const r=createVerticalRound(op,2,()=>0);assert.equal(new Set(r.questions.map(q=>`${q.a}${q.op}${q.b}`)).size,5)}
let seed=42;const rng=()=>((seed=(1664525*seed+1013904223)>>>0)/2**32);
for(const op of ['mixed','+','-','×','÷'])for(const digits of [2,3]){
 const r=createVerticalRound(op,digits,rng);assert.equal(r.questions.length,5);assert.equal(new Set(r.questions.map(q=>`${q.a}${q.op}${q.b}`)).size,5);
 if(op==='mixed')assert.deepEqual(new Set(r.questions.map(q=>q.op)),new Set(['+','-','×','÷']));
 r.answers=r.questions.map(q=>({values:verticalProblem(q.op,q.a,q.b).fields,hintUsed:false}));
 assert.equal(verticalSummary(r).independent,5);r.answers[0].hintUsed=true;assert.equal(verticalSummary(r).correct,5);assert.equal(verticalSummary(r).independent,4);
 assert.equal(verticalSummary(restoreVerticalRound(JSON.parse(JSON.stringify(r)))).correct,5);
}
const round=createVerticalRound();const p=verticalProblem(round.questions[0].op,round.questions[0].a,round.questions[0].b);round.pending={values:p.fields,hintUsed:true};round.values=p.fields;
assert.deepEqual(restoreVerticalRound(round).pending,round.pending);assert.equal(restoreVerticalRound({...round,pending:{values:{}}}),null);
assert.equal(restoreVerticalRound({questions:[{op:'÷',a:1,b:0}]}),null);
globalThis.window={};const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
const {V12Store}=await import('../v12-store.js');const store=new V12Store();store.state.stats.stars=123;store.state.verticalDraft=round;store.save();const restored=new V12Store();assert.deepEqual(restored.state.verticalDraft,round);assert.equal(restored.state.stats.stars,123);
console.log(JSON.stringify({verticalCases:checked,tests:['all four operations and process fields','carry chains','consecutive borrowing','zero inside quotient','remainder identity','blank and invalid input','rounds and honest hint scoring','submitted draft restoration','record preservation']}));
