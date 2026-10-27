const OPS=['+','-','×','÷'];
const digit=(n,col)=>Math.floor(n/10**col)%10;
export function verticalProblem(op,a,b){
  if(!OPS.includes(op)||!Number.isInteger(a)||!Number.isInteger(b)||a<0||a>999||b<0||b>999||(op==='-'&&a<b)||(['×','÷'].includes(op)&&b>9)||(op==='÷'&&(!b||a<b)))throw new Error('不支持的竖式参数');
  const result=op==='+'?a+b:op==='-'?a-b:op==='×'?a*b:Math.floor(a/b);
  const width=Math.max(String(a).length,String(b).length,String(result).length);
  const fields={};const rows=[];
  const fixed=(label,n,cls='')=>({label,cls,cells:String(n).padStart(width,' ').split('').map(text=>({text}))});
  const field=(key,value,label)=>{fields[key]=String(value);return {key,label}};
  if(op==='÷'){
    const chars=String(a).split('');const quotient=String(result).padStart(width,' ');
    rows.push({label:'商',cells:[...quotient].map((d,i)=>d===' '?{text:' '}:field('q'+i,d,`商的${10**(width-1-i)}位`))});
    rows.push({...fixed(`${b} ⟌`,a,'division-dividend')});
    let remainder=0,started=false;
    chars.forEach((d,i)=>{
      const partial=remainder*10+Number(d);const q=Math.floor(partial/b);
      if(!started&&q===0){remainder=partial;return}started=true;
      const product=q*b;remainder=partial-product;
      const cells=Array.from({length:width},()=>({text:' '}));
      [...String(product)].forEach((n,j,arr)=>cells[i-arr.length+1+j]=field(`p${i}_${j}`,n,`第${i+1}列相乘结果第${j+1}位`));
      rows.push({label:'−',cls:'vertical-subtract',cells});
      const rest=Array.from({length:width},()=>({text:' '}));rest[i]=field('r'+i,remainder,i===width-1?'最终余数':`第${i+1}列相减的余数`);
      if(i<width-1)rest[i+1]={text:chars[i+1],down:true};
      rows.push({label:i===width-1?'余数':'落下一位',cells:rest});
    });
  }else{
    if(op==='+'||op==='×'){
      const cells=Array.from({length:width},()=>({text:' '}));let carry=0;
      for(let col=0;col<width;col++){
        if(col>0)cells[width-1-col]=field('carry'+col,carry,`向${10**col}位进位（没有填0）`);
        const sum=op==='+'?digit(a,col)+digit(b,col)+carry:digit(a,col)*b+carry;
        carry=Math.floor(sum/10);
      }
      rows.push({label:'进位',cls:'vertical-carry',cells});
    }else{
      let borrow=0;const cells=Array.from({length:width},()=>({text:' '}));
      for(let col=0;col<width;col++){
        let value=digit(a,col)-borrow;borrow=value<digit(b,col)?1:0;if(borrow)value+=10;
        cells[width-1-col]=field('work'+col,value,`${10**col}位退位调整后的被减数`);
      }
      rows.push({label:'调整后',cls:'vertical-carry',cells});
    }
    rows.push(fixed('',a));rows.push(fixed(op,b,'vertical-subtract'));
    rows.push({label:'结果',cells:String(result).padStart(width,' ').split('').map((d,i)=>d===' '?{text:' '}:field('answer'+i,d,`结果的${10**(width-1-i)}位`))});
  }
  return {op,a,b,result,remainder:op==='÷'?a%b:0,width,rows,fields,title:`${a} ${op} ${b}`,hint:op==='+'?'相同数位对齐，从个位加起。满十向左进1，进位格没有进位填0。':op==='-'?'从个位减起。不够减向左借1，换成10个本数位单位；“调整后”填写这一位实际用于相减的数，连续退位也要计算。':op==='×'?'用一位乘数从个位乘起，把上一位进来的数加上，再写个位、向左进位。没有进位填0。':'从被除数左边开始，不够除就看前两位。商对齐当前数位，写相乘结果，相减后落下下一位；商中间的0不能漏，余数须小于除数。'};
}
const normalize=value=>typeof value==='string'?value.trim().replace(/[０-９]/g,c=>String(c.charCodeAt(0)-65296)):'';
export function checkVertical(problem,values={}){
  const keys=Object.keys(problem.fields);const missing=keys.filter(k=>!/^\d{1,2}$/.test(normalize(values[k])));
  const wrong=keys.filter(k=>!missing.includes(k)&&Number(normalize(values[k]))!==Number(problem.fields[k]));
  return {complete:missing.length===0,correct:!missing.length&&!wrong.length,missing,wrong};
}
export function createVerticalRound(op='mixed',digits=2,rng=Math.random){
  if(!['mixed',...OPS].includes(op))op='mixed';if(![2,3].includes(digits))digits=2;
  const rand=(lo,hi)=>lo+Math.floor(Math.max(0,Math.min(.999999999,Number(rng())||0))*(hi-lo+1));
  const questions=[];const used=new Set();
  for(let i=0;i<5;i++){
    const sign=op==='mixed'?OPS[i%4]:op;let a,b,key;
    for(let tries=0;tries<50;tries++){
      a=rand(10**(digits-1),10**digits-1);b=['×','÷'].includes(sign)?rand(2,9):rand(10**(digits-1),10**digits-1);
      if(sign==='-'&&a<b)[a,b]=[b,a];key=`${sign}:${a}:${b}`;if(!used.has(key))break;
    }
    while(used.has(key)){a=a>=10**digits-1?10**(digits-1):a+1;if(sign==='-'&&a<b)[a,b]=[b,a];key=`${sign}:${a}:${b}`}
    used.add(key);questions.push({op:sign,a,b});
  }
  return {id:`vertical-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,at:Date.now(),op,digits,questions,answers:[],values:{},hintUsed:false,pending:null};
}
export function restoreVerticalRound(input){
  if(!input||typeof input!=='object'||!Array.isArray(input.questions)||input.questions.length!==5)return null;
  try{
    const questions=input.questions.map(q=>{verticalProblem(q.op,q.a,q.b);return {op:q.op,a:q.a,b:q.b}});
    const answers=Array.isArray(input.answers)?input.answers.slice(0,5).map(row=>({values:row?.values&&typeof row.values==='object'?row.values:{},hintUsed:row?.hintUsed===true})):[];
    if(answers.some((r,i)=>!checkVertical(verticalProblem(questions[i].op,questions[i].a,questions[i].b),r.values).complete))return null;
    const pending=input.pending&&answers.length<5?{values:input.pending.values||{},hintUsed:input.pending.hintUsed===true}:null;
    if(pending&&!checkVertical(verticalProblem(questions[answers.length].op,questions[answers.length].a,questions[answers.length].b),pending.values).complete)return null;
    return {pending,id:typeof input.id==='string'?input.id.slice(0,100):'restored-'+Date.now(),at:Number.isFinite(input.at)?input.at:Date.now(),op:['mixed',...OPS].includes(input.op)?input.op:'mixed',digits:input.digits===3?3:2,questions,answers,values:input.values&&typeof input.values==='object'?input.values:{},hintUsed:input.hintUsed===true};
  }catch{return null}
}
export function verticalSummary(round){
  let correct=0,independent=0;
  round.answers.forEach((row,i)=>{const q=round.questions[i];if(checkVertical(verticalProblem(q.op,q.a,q.b),row.values).correct){correct++;if(!row.hintUsed)independent++}});
  return {total:round.questions.length,answered:round.answers.length,correct,independent};
}
