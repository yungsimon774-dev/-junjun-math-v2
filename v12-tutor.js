const escapeHTML=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));

function normalizeMath(value){
  return String(value||"")
    .replace(/[－—–]/g,"-")
    .replace(/[＋]/g,"+")
    .replace(/[×xX＊*]/g,"×")
    .replace(/[÷／/]/g,"÷")
    .replace(/＝/g,"=");
}
function calculate(a,op,b){
  if(op==="+")return a+b;
  if(op==="-")return a-b;
  if(op==="×")return a*b;
  if(op==="÷"&&b)return Math.floor(a/b);
  return null;
}
function extractArithmetic(q){
  for(const source of [q.prompt,q.explain]){
    const text=normalizeMath(source);
    const match=text.match(/(\d{1,5})\s*([+\-×÷])\s*(\d{1,5})\s*(?:=)?\s*(\d{1,6})?/);
    if(match){
      const a=Number(match[1]),op=match[2],b=Number(match[3]);
      return {a,op,b,answer:match[4]!=null?Number(match[4]):calculate(a,op,b)};
    }
  }
  return null;
}
function extractEquations(q){
  const text=normalizeMath(q.explain||"");
  return [...text.matchAll(/(\d{1,5}\s*[+\-×÷]\s*\d{1,5})\s*=\s*(\d{1,6})/g)]
    .map(match=>({left:match[1].replace(/\s+/g,""),answer:Number(match[2])}));
}
function hideFinal(text,answer){
  let value=String(text||"");
  const target=String(answer??"");
  if(!target)return value;
  const safe=target.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  value=value.replace(new RegExp(`([=＝])\\s*${safe}(?!\\d)`,"g"),"$1？");
  value=value.replace(new RegExp(`(答案(?:是|为)?[:：]?\\s*)${safe}`,"g"),"$1？");
  return value;
}
function numberLine(a,b,op){
  const marks=[];
  if(op==="+"){
    for(let i=0;i<=Math.min(b,20);i++)marks.push(a+i);
  }else{
    for(let i=0;i<=Math.min(b,20);i++)marks.push(a-b+i);
  }
  return `<div class="visual-title">数轴演示</div><div class="number-line">${marks.map(number=>`<span class="${number===a||number===(op==="+"?a+b:a-b)?"active":""}">${number}</span>`).join("")}</div><small>${op==="+"?"从左向右，数越来越大":"从右向左，数越来越小"}</small>`;
}
function placeValue(number){
  const value=Math.max(0,Number(number)||0);
  const thousands=Math.floor(value/1000);
  const hundreds=Math.floor(value%1000/100);
  const tens=Math.floor(value%100/10);
  const ones=value%10;
  return `<div class="visual-title">数位盒</div><div class="place-value"><div><b>${thousands}</b><small>千位</small></div><div><b>${hundreds}</b><small>百位</small></div><div><b>${tens}</b><small>十位</small></div><div><b>${ones}</b><small>个位</small></div></div>`;
}
function relationVisual(labels){
  return `<div class="relation-flow">${labels.map((label,index)=>`${index?'<i>→</i>':""}<span>${escapeHTML(label)}</span>`).join("")}</div>`;
}
function arithmeticLesson(q,reveal){
  const math=extractArithmetic(q);
  if(!math)return null;
  const {a,b,op}=math;
  const answer=q.options?.[q.answer]??math.answer;
  const shown=reveal?answer:"？";
  const steps=[`先读原题：${a} ${op==="+"?"加":op==="-"?"减":op==="×"?"乘":"除以"} ${b}。`];
  let visual="";
  if(op==="+"){
    if(a<=20&&b<=20){
      steps.push(`从 ${a} 开始，在数轴上向右走 ${b} 步。`);
      steps.push(`最后到达 ${shown}，所以 ${a}+${b}=${shown}。`);
      visual=numberLine(a,b,op);
    }else{
      let carry=0;
      const names=["个位","十位","百位","千位"];
      for(let i=0;i<Math.max(String(a).length,String(b).length);i++){
        const first=Math.floor(a/10**i)%10;
        const second=Math.floor(b/10**i)%10;
        const sum=first+second+carry;
        const oldCarry=carry;
        carry=Math.floor(sum/10);
        steps.push(`${names[i]}：${first}+${second}${oldCarry?"+进位1":""}=${sum}，写${sum%10}${carry?"，向前进1":""}。`);
      }
      steps.push(`按高位到低位写好，答案是 ${shown}。`);
      if(reveal)visual=placeValue(answer);
    }
  }else if(op==="-"){
    if(a<=20&&b<=20){
      steps.push(`从 ${a} 开始，在数轴上向左退 ${b} 步。`);
      steps.push(`最后到达 ${shown}，所以 ${a}-${b}=${shown}。`);
      visual=numberLine(a,b,op);
    }else{
      const top=String(a).split("").reverse().map(Number);
      const bottom=String(b).split("").reverse().map(Number);
      const names=["个位","十位","百位","千位"];
      while(bottom.length<top.length)bottom.push(0);
      for(let i=0;i<top.length;i++){
        const original=top[i];
        const down=bottom[i]||0;
        if(top[i]<down){
          let borrow=i+1;
          while(borrow<top.length&&top[borrow]===0)borrow++;
          if(borrow<top.length){
            top[borrow]--;
            for(let middle=borrow-1;middle>i;middle--)top[middle]=9;
            top[i]+=10;
            steps.push(`${names[i]}的 ${original} 不够减 ${down}，从${names[borrow]}借1，${names[i]}变成${top[i]}。`);
          }
        }
        steps.push(`${names[i]}：${top[i]}-${down}=${top[i]-down}。`);
      }
      steps.push(`按顺序写下来，答案是 ${shown}。`);
      if(reveal)steps.push(`验算：${answer}+${b}=${a}，结果正确。`);
      if(reveal)visual=placeValue(answer);
    }
  }else if(op==="×"){
    steps.push("乘法表示几个相同的数相加，先找“几组”和“每组几个”。");
    steps.push(`这里有 ${a} 组，每组 ${b}，列式 ${a}×${b}=${shown}。`);
    visual=relationVisual([`${a}组`,`每组${b}`,`一共${shown}`]);
  }else{
    steps.push("除法表示平均分或按每份数量来分。");
    steps.push(`把 ${a} 按每份 ${b} 来分，列式 ${a}÷${b}=${shown}。`);
    visual=relationVisual([`总数${a}`,`每份${b}`,`份数${shown}`]);
  }
  return {title:"把计算过程看清楚",steps,visual};
}

function conceptualLesson(q,reveal){
  const answer=q.options?.[q.answer]??"";
  const prompt=String(q.prompt||"");
  const text=`${q.kind||""} ${prompt}`;
  const explanation=reveal?String(q.explain||""):hideFinal(q.explain,answer);
  let title="先理解题意";
  let steps=[];
  let visual="";
  if(/代换|天平|图形方程/.test(text)){
    title="等量代换：一层一层换";
    steps=[
      "先找题目中已经知道数值的图案。",
      "再看第二个图案等于几个已知图案，不要跳步。",
      explanation||"把图案依次换成它代表的数，再计算。"
    ];
    visual=relationVisual(["找已知","逐层代换","最后计算"]);
  }else if(/时间|人民币|找零|单位|长度|厘米|米|元|角/.test(text)){
    title="单位题：先统一单位";
    steps=[
      "先圈出每个数字后面的单位。",
      "单位不同就先换成同一种单位，再加减。",
      explanation||"统一单位后，按题目的数量关系计算。"
    ];
    visual=relationVisual(["看单位","统一单位","列式检查"]);
  }else if(/周长|图形|边长|正方形|长方形/.test(text)){
    title="图形题：分清边长和周长";
    steps=[
      "先判断题目问边长、周长还是图形数量。",
      "绕图形一周的总长度叫周长，正方形四条边一样长。",
      explanation||"把各条边按图形关系组合起来。"
    ];
    visual=relationVisual(["认图形","找边数","算周长"]);
  }else if(/规律|周期|排序/.test(text)){
    title="规律题：先比相邻两项";
    steps=[
      "比较相邻的数或图案，看看每次增加、减少或重复什么。",
      "用同一个规则检查至少两次，确认不是巧合。",
      explanation||"确认规律后，再写下一项。"
    ];
    visual=relationVisual(["比相邻","验两次","继续写"]);
  }else if(/搭配|枚举|组合/.test(text)){
    title="搭配题：有顺序地列举";
    steps=[
      "固定第一类中的一个，再和第二类逐个搭配。",
      "换到下一个时按同样顺序继续，避免漏掉或重复。",
      explanation||"把每一种不同搭配列出来再计数。"
    ];
    visual=relationVisual(["固定一个","逐个搭配","检查重复"]);
  }else{
    title="应用题：条件、问题、关系";
    if(/一共|共有|合计|总共/.test(prompt))steps.push("看到“一共”或“共有”，先考虑把几部分合起来。");
    else if(/还剩|飞走|用去|送给|少了|找回/.test(prompt))steps.push("看到“还剩”或“找回”，先找原有数量，再去掉用掉的一部分。");
    else if(/每组|每份|几倍|平均/.test(prompt))steps.push("先分清有几组、每组多少，或者平均分成几份。");
    else steps.push("圈出数字和单位，再用自己的话说出最后问什么。");
    steps.push("把无关信息暂时放到一边，只保留和问题有关的条件。");
    steps.push(explanation||"按数量关系列式，再用生活常识检查结果。");
    visual=relationVisual(["找条件","找问题","列式检查"]);
  }
  if(reveal)steps.push(`完整答案：${answer}。`);
  return {title,steps,visual};
}

export function buildTutor(q,{stage="guided",reveal=false,hintLevel=0}={}){
  const arithmetic=arithmeticLesson(q,reveal);
  const lesson=arithmetic||conceptualLesson(q,reveal);
  const equations=extractEquations(q);
  const checkpoint=stage==="guided"&&equations.length>=2?equations[0]:null;
  let visibleSteps=lesson.steps;
  if(!reveal&&stage!=="teach"){
    const base=stage==="guided"?2:1;
    visibleSteps=lesson.steps.slice(0,Math.min(lesson.steps.length,base+hintLevel));
  }
  if(stage==="teach"){
    visibleSteps=lesson.steps;
    reveal=true;
  }
  return {
    title:lesson.title,
    steps:visibleSteps,
    allSteps:lesson.steps,
    visual:lesson.visual,
    checkpoint,
    canShowMore:!reveal&&visibleSteps.length<lesson.steps.length,
    speech:[lesson.title,...visibleSteps].join("。")
  };
}

export {extractArithmetic,extractEquations,escapeHTML};
