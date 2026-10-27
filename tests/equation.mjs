import assert from 'node:assert/strict';
globalThis.window={};globalThis.localStorage={getItem:()=>null,setItem(){}};
for(const name of ['v12-config','courses','v12-bank-foundation','v12-bank-application','v12-bank-visual','v12-bank-symbol','v12-bank-life','v12-skill-map'])await import(`../${name}.js`);
const {equationPlan,checkEquationPlan}=await import('../v12-equation.js');
const {LearningEngine}=await import('../v12-engine.js');const {V12Store}=await import('../v12-store.js');
const q=(prompt,answer,explain='')=>({prompt,options:[answer],answer:0,explain});
const counts={'+':0,'-':0,'×':0,'÷':0};let total=0,multi=0;
for(const question of new LearningEngine(new V12Store()).catalog){
 const plan=equationPlan(question);if(!plan)continue;total++;if(plan.length>1)multi++;
 assert.equal(checkEquationPlan(plan,plan).correct,true,question.prompt);
 const blank=plan.map(r=>({...r,result:''}));assert.equal(checkEquationPlan(plan,blank).incomplete,true);
 for(const [i,row] of plan.entries()){
  counts[row.op]++;
  const wrong=plan.map(r=>({...r}));wrong[i].result++;assert.equal(checkEquationPlan(plan,wrong).correct,false);
  wrong[i]={...row,a:row.a+100,b:row.b+100};assert.equal(checkEquationPlan(plan,wrong).correct,false);
  const reversed=plan.map(r=>({...r}));reversed[i]={...row,a:row.b,b:row.a};assert.equal(checkEquationPlan(plan,reversed).correct,['+','×'].includes(row.op)||row.a===row.b);
 }
}
assert.ok(total>1000);for(const n of Object.values(counts))assert.ok(n>0);
for(const [prompt,result,op] of [['6×5＝？','30','×'],['6+5＝？','11','+'],['6-5＝？','1','-'],['30÷5＝？','6','÷']]){
 const plan=equationPlan(q(prompt,result));assert.equal(plan[0].op,op);assert.equal(checkEquationPlan(plan,plan).correct,true);
 assert.equal(checkEquationPlan(plan,[{...plan[0],op:'?'}]).incomplete,true);
 assert.equal(checkEquationPlan(plan,[{...plan[0],a:''}]).incomplete,true);
}
const mul=equationPlan(q('6×5＝？','30'));
assert.equal(checkEquationPlan(mul,[{a:'５',op:'X',b:'６',result:'３０'}]).correct,true);
assert.equal(checkEquationPlan(mul,[{a:3,op:'×',b:10,result:30}]).correct,false);
assert.equal(checkEquationPlan(mul,[{a:6,op:'+',b:5,result:30}]).correct,false);
assert.equal(checkEquationPlan(mul,[{a:'0x6',op:'×',b:5,result:30}]).incomplete,true);
const two=equationPlan(q('原有12个，再买3个，平均放入5盒，每盒多少？','3','12+3=15；15÷5=3'));
assert.equal(two.length,2);assert.equal(checkEquationPlan(two,two).correct,true);assert.equal(checkEquationPlan(two,[two[1]]).incomplete,true);
assert.equal(equationPlan(q('比较大小','>')),null);
assert.equal(equationPlan(q('余数是多少','2','17÷5=3余2')),null);
assert.equal(equationPlan(q('单位转换','3元2角')),null);
assert.equal(equationPlan(q('不可靠的讲解','30','6×5=31')),null);
assert.equal(equationPlan(q('正确算式','6×5'))[0].result,30);
const store=new V12Store();assert.equal(store.state.settings.equationPractice,true);
console.log(JSON.stringify({equationQuestions:total,multiStepQuestions:multi,operations:counts,formulaValidation:'PASS'}));
