import {answerDescriptor,parseNumericAnswer,normalizeExpression} from './v12-engine.js?v=120170';
import {extractArithmetic,extractEquations} from './v12-tutor.js?v=120170';

// Use only a verified calculation path, never accept an arbitrary equality
// merely because its result happens to match the question's answer.
function binary(left,result){
  const match=normalizeExpression(left).match(/^(-?\d+(?:\.\d+)?)([+\-×÷])(-?\d+(?:\.\d+)?)$/);
  if(!match)return null;
  const a=Number(match[1]),op=match[2],b=Number(match[3]);
  const value=op==='+'?a+b:op==='-'?a-b:op==='×'?a*b:b===0?null:a/b;
  return value!=null&&Math.abs(value-result)<1e-9?{a,op,b,result}:null;
}
export function equationPlan(q){
  const descriptor=answerDescriptor(q);
  const arithmetic=extractArithmetic(q);
  if(arithmetic)return [{a:arithmetic.a,op:arithmetic.op,b:arithmetic.b,result:arithmetic.answer}];
  if(descriptor.type==='expression'){
    const [left,stated]=descriptor.value.split('=');
    const match=left.match(/^(-?\d+)([+\-×÷])(-?\d+)$/);
    if(!match)return null;
    const a=Number(match[1]),b=Number(match[3]),op=match[2];
    const value=op==='+'?a+b:op==='-'?a-b:op==='×'?a*b:b===0?null:a/b;
    if(value==null||(stated!=null&&Number(stated)!==value))return null;
    return [{a,op,b,result:value}];
  }
  if(descriptor.type!=='number')return null;
  const records=extractEquations(q);
  if(!records.length||records.length>4)return null;
  const rows=records.map(r=>binary(r.left,r.answer));
  if(rows.some(r=>!r)||rows.at(-1).result!==descriptor.value)return null;
  // Earlier steps must feed a later calculation; exclude unrelated check sums.
  if(rows.some((r,i)=>i<rows.length-1&&!rows.slice(i+1).some(next=>next.a===r.result||next.b===r.result)))return null;
  return rows;
}
export function checkEquationPlan(plan,rows){
  if(!Array.isArray(plan)||!plan.length||!Array.isArray(rows)||rows.length!==plan.length)return {correct:false,incomplete:true};
  const normalized=rows.map(row=>({a:parseNumericAnswer(row?.a),op:normalizeExpression(row?.op),b:parseNumericAnswer(row?.b),result:parseNumericAnswer(row?.result)}));
  if(normalized.some(r=>r.a==null||r.b==null||r.result==null||!['+','-','×','÷'].includes(r.op)))return {correct:false,incomplete:true};
  const correct=plan.every((expected,i)=>{
    const row=normalized[i];
    const numbers=row.a===expected.a&&row.b===expected.b;
    const reversed=['+','×'].includes(expected.op)&&row.a===expected.b&&row.b===expected.a;
    return row.op===expected.op&&(numbers||reversed)&&row.result===expected.result;
  });
  const equations=normalized.map(r=>`${r.a}${r.op}${r.b}=${r.result}`);
  return {correct,incomplete:false,entry:{value:String(normalized.at(-1).result),selectedValue:equations.join('；'),equations}};
}
