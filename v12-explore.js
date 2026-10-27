export function createExploration(level=1,values={}){
  level=[1,2,3].includes(Number(level))?Number(level):1;
  const whole=(value,fallback,min,max)=>Number.isInteger(value)&&value>=min&&value<=max?value:fallback;
  const a=whole(values.a,2+Math.floor(Math.random()*7),1,9);
  const b=whole(values.b,2+Math.floor(Math.random()*3),2,5);
  const c=whole(values.c,1+Math.floor(Math.random()*5),1,9);
  const pear=a*b;
  const prompt=level===1?`🍎＝${a}，🍐＝${b}个🍎。🍐等于多少？`
    :level===2?`🍎＝${a}，🍐＝${b}个🍎，🍇＝🍐＋🍎。🍇等于多少？`
    :`🍎＋🍎＝${a*2}，🍐＝${b}个🍎，🍇＝🍐＋${c}。🍇等于多少？`;
  const answer=level===1?pear:level===2?pear+a:pear+c;
  const firstAnswer=level===3?a:pear;
  const firstPrompt=level===3?`先想一想：两个🍎一样大，合起来是${a*2}，一个🍎是多少？`:`先想一想：${b}个🍎，每个是${a}，🍐是多少？`;
  const firstSolution=level===3?`${a*2}÷2＝${a}`:`${a}×${b}＝${pear}`;
  const repeated=Array(b).fill(a).join('＋');
  const methods=level===1?[`乘法：${a}×${b}＝${answer}`,`连加：${repeated}＝${answer}`]
    :level===2?[`逐层代换：🍐＝${a}×${b}＝${pear}，🍇＝${pear}＋${a}＝${answer}`,`合并再算：🍇共有${b+1}个🍎，${a}×${b+1}＝${answer}`]
    :[`倒推再代换：🍎＝${a*2}÷2＝${a}，🍐＝${a}×${b}＝${pear}，🍇＝${pear}＋${c}＝${answer}`,`画组连加：每组${a}，共${b}组，再添${c}，${repeated}＋${c}＝${answer}`];
  return {id:`explore:${Date.now()}:${Math.random().toString(36).slice(2)}`,level,a,b,c,title:["","一层代换","连续代换","先反推，再代换"][level],prompt,answer,firstPrompt,firstAnswer,firstSolution,methods};
}

export function checkExploration(value,answer){
  const text=String(value??'').trim();
  return /^\d+$/.test(text)&&Number(text)===answer;
}
