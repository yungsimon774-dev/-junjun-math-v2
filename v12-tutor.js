const escapeHTML=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));

function normalizeMath(value){
  return String(value||"")
    .replace(/[－—–]/g,"-")
    .replace(/[＋]/g,"+")
    .replace(/[×xX＊*]/g,"×")
    .replace(/[÷／/]/g,"÷")
    .replace(/＝/g,"=");
}

function evaluateExpression(source){
  const text=normalizeMath(source).replace(/\s+/g,"");
  if(!text||!/^[\d.()+\-×÷]+$/.test(text))return null;
  let index=0;
  const parseNumber=()=>{
    const start=index;
    while(/[\d.]/.test(text[index]||""))index++;
    if(start===index)return null;
    const value=Number(text.slice(start,index));
    return Number.isFinite(value)?value:null;
  };
  const parseFactor=()=>{
    if(text[index]==="+"){index++;return parseFactor()}
    if(text[index]==="-"){index++;const value=parseFactor();return value==null?null:-value}
    if(text[index]==="("){
      index++;
      const value=parseSum();
      if(text[index]!==")")return null;
      index++;
      return value;
    }
    return parseNumber();
  };
  const parseProduct=()=>{
    let value=parseFactor();
    if(value==null)return null;
    while(text[index]==="×"||text[index]==="÷"){
      const operator=text[index++];
      const right=parseFactor();
      if(right==null||(operator==="÷"&&right===0))return null;
      value=operator==="×"?value*right:value/right;
    }
    return value;
  };
  const parseSum=()=>{
    let value=parseProduct();
    if(value==null)return null;
    while(text[index]==="+"||text[index]==="-"){
      const operator=text[index++];
      const right=parseProduct();
      if(right==null)return null;
      value=operator==="+"?value+right:value-right;
    }
    return value;
  };
  const result=parseSum();
  return index===text.length&&Number.isFinite(result)?result:null;
}

function calculate(a,operator,b){
  if(operator==="+")return a+b;
  if(operator==="-")return a-b;
  if(operator==="×")return a*b;
  if(operator==="÷"&&b!==0)return a/b;
  return null;
}

function numericAnswer(q){
  const raw=String(q.options?.[q.answer]??"").trim();
  const match=raw.match(/^(-?\d+(?:\.\d+)?)\s*(?:个|元|角|分|米|厘米|毫米|千米|小时|分钟|秒|本|支|颗|辆|人|朵|只|张|块|盒|次|天|岁|倍|页|道|棵|面|组|排|圈|千克|克|种|场)?$/);
  return match?Number(match[1]):null;
}

function extractArithmetic(q){
  const text=normalizeMath(q.prompt||"")
    .replace(/^【[^】]+】\s*/,"")
    .replace(/^(?:请)?(?:计算|口算|算一算)\s*[:：]?\s*/,"")
    .replace(/\s*(?:=\s*[?？]?|等于多少[?？]?)?\s*[。．]?\s*$/,"")
    .trim();
  const match=text.match(/^(\d{1,6})\s*([+\-×÷])\s*(\d{1,6})$/);
  if(!match)return null;
  const a=Number(match[1]),operator=match[2],b=Number(match[3]);
  const answer=calculate(a,operator,b);
  const expected=numericAnswer(q);
  if(answer==null||expected==null||Math.abs(answer-expected)>1e-9)return null;
  return {a,op:operator,b,answer};
}

function equationRecords(value){
  const text=normalizeMath(value||"");
  const pattern=/((?:-?\d+(?:\.\d+)?|\([^=；;。]+\))(?:\s*[+\-×÷]\s*(?:-?\d+(?:\.\d+)?|\([^=；;。]+\)))+)\s*=\s*(-?\d+(?:\.\d+)?)(?:\s*(?:余|…+)\s*(\d+))?/g;
  return [...text.matchAll(pattern)].map(match=>{
    const left=match[1].replace(/\s+/g,"");
    const answer=Number(match[2]);
    const remainder=match[3]==null?null:Number(match[3]);
    const actual=evaluateExpression(left);
    const division=left.match(/^(\d+)÷(\d+)$/);
    const quotientValid=remainder!=null&&division&&Number(division[2])!==0
      &&Math.floor(Number(division[1])/Number(division[2]))===answer
      &&Number(division[1])%Number(division[2])===remainder;
    return {left,answer,remainder,actual,valid:Boolean(quotientValid||(actual!=null&&Math.abs(actual-answer)<1e-9))};
  });
}

function extractEquations(q){
  return equationRecords(q.explain).filter(record=>record.valid).map(({left,answer})=>({left,answer}));
}

function splitExplanation(value){
  return normalizeMath(value||"")
    .split(/[；;。]+/)
    .flatMap(part=>part.split(/，(?=(?:再|然后|最后|所以|接着|先算))/))
    .map(part=>part.trim())
    .filter(Boolean);
}

function validatedExplanation(q){
  const parts=splitExplanation(q.explain);
  const invalid=[];
  const safe=[];
  for(const part of parts){
    const records=equationRecords(part);
    const bad=records.filter(record=>!record.valid);
    if(bad.length)invalid.push(...bad);
    else safe.push(part);
  }
  return {parts:safe,invalid,records:equationRecords(q.explain)};
}

function numberLine(a,b,operator){
  const end=operator==="+"?a+b:a-b;
  const low=Math.max(0,Math.min(a,end));
  const high=Math.max(a,end);
  if(high-low>20)return "";
  const marks=[];
  for(let number=low;number<=high;number++)marks.push(number);
  return `<div class="visual-title">数轴演示</div><div class="number-line">${marks.map(number=>`<span class="${number===a||number===end?"active":""}">${number}</span>`).join("")}</div><small>${operator==="+"?`从 ${a} 向右走 ${b} 步`:`从 ${a} 向左退 ${b} 步`}</small>`;
}

function placeValue(number){
  const value=Math.max(0,Math.floor(Number(number)||0));
  const thousands=Math.floor(value/1000);
  const hundreds=Math.floor(value%1000/100);
  const tens=Math.floor(value%100/10);
  const ones=value%10;
  return `<div class="visual-title">数位盒</div><div class="place-value"><div><b>${thousands}</b><small>千位</small></div><div><b>${hundreds}</b><small>百位</small></div><div><b>${tens}</b><small>十位</small></div><div><b>${ones}</b><small>个位</small></div></div>`;
}

function relationVisual(labels){
  return `<div class="relation-flow">${labels.map((label,index)=>`${index?"<i>→</i>":""}<span>${escapeHTML(label)}</span>`).join("")}</div>`;
}

function roundingVisual(number,lower,upper){
  const leftDistance=number-lower;
  const rightDistance=upper-number;
  return `<div class="visual-title">整十（整百）位置图</div><div class="rounding-visual"><span>${lower}</span><i style="--position:${upper===lower?50:(number-lower)/(upper-lower)*100}%"><b>${number}</b></i><span>${upper}</span></div><small>离左边 ${leftDistance}，离右边 ${rightDistance}</small>`;
}

function stripVisual(sum,difference){
  return `<div class="visual-title">纸条图</div><div class="strip-visual"><div><small>大数</small><i></i><em>多 ${difference}</em></div><div><small>小数</small><i></i></div></div><small>两条纸条合起来是 ${sum}</small>`;
}

function groupsVisual(groups,each,reveal,total){
  const shown=Math.min(Math.max(1,groups),10);
  return `<div class="visual-title">分组图</div><div class="groups-visual">${Array.from({length:shown},()=>`<span>${Array.from({length:Math.min(each,10)},()=>"●").join("")}</span>`).join("")}</div><small>${groups}组，每组${each}个${reveal?`，一共${total}个`:"，一共有多少？"}</small>`;
}

function normalizedKind(q){
  return String(q.kindName||q.kind||"同步训练")
    .replace(/·V8强化$/u,"")
    .replace(/^Lv\d+·/u,"")
    .trim();
}

function isSymbolSubstitutionQuestion(q){
  const text=`${normalizedKind(q)} ${q.prompt||""}`;
  return /等量|代换|天平|图形方程|反向求未知数/.test(text);
}

function pureMixedExpression(q){
  const text=normalizeMath(q.prompt||"")
    .replace(/^【[^】]+】\s*/,"")
    .replace(/^(?:请)?(?:计算|口算|巧算|算一算)\s*[:：]?\s*/,"")
    .replace(/\s*(?:=\s*[?？]?|等于多少[?？]?)?\s*[。．]?\s*$/,"")
    .trim();
  if(/[□△○◇🍎🍐🍊🍌🍓⚽🎈🦖🚌🪁🥝🍋]/u.test(text))return null;
  if(!/^[\d\s().+\-×÷]+$/.test(text))return null;
  const operators=text.match(/[+\-×÷]/g)||[];
  return operators.length>=2?text:null;
}

function verticalAdditionSteps(a,b,answer){
  const steps=[];
  const names=["个位","十位","百位","千位","万位"];
  const length=Math.max(String(a).length,String(b).length);
  let carry=0;
  for(let index=0;index<length;index++){
    const first=Math.floor(a/10**index)%10;
    const second=Math.floor(b/10**index)%10;
    const incoming=carry;
    const sum=first+second+incoming;
    carry=Math.floor(sum/10);
    steps.push(`${names[index]}：${first}+${second}${incoming?"+进位1":""}=${sum}，写${sum%10}${carry?"，向前进1":""}。`);
  }
  if(carry)steps.push(`最高位写下进位的 ${carry}。`);
  steps.push(`所以 ${a}+${b}=${answer}。`);
  return steps;
}

function verticalSubtractionSteps(a,b,answer){
  const steps=[];
  const names=["个位","十位","百位","千位","万位"];
  const top=String(a).split("").reverse().map(Number);
  const bottom=String(b).split("").reverse().map(Number);
  while(bottom.length<top.length)bottom.push(0);
  for(let index=0;index<top.length;index++){
    const down=bottom[index]||0;
    if(top[index]<down){
      let lender=index+1;
      while(lender<top.length&&top[lender]===0)lender++;
      if(lender<top.length){
        top[lender]-=1;
        for(let middle=lender-1;middle>index;middle--)top[middle]=9;
        top[index]+=10;
        const through=lender-index>1?"，中间经过的0变成9":"";
        steps.push(`${names[index]}不够减，向${names[lender]}退1${through}，${names[index]}按 ${top[index]} 来减。`);
      }
    }
    steps.push(`${names[index]}：${top[index]}-${down}=${top[index]-down}。`);
  }
  steps.push(`所以 ${a}-${b}=${answer}；用 ${answer}+${b}=${a} 验算。`);
  return steps;
}

function finalStep(q){
  return `答：${String(q.options?.[q.answer]??"")}。`;
}

function cleanSolutionSteps(q){
  const checked=validatedExplanation(q);
  const steps=checked.parts.map(part=>`${/[=<>]|先|再|因为|所以|每|比较|假设|排序|相加|相减/.test(part)?"":"根据题意，"}${part.replace(/[。！？]+$/g,"")}。`);
  const answer=String(q.options?.[q.answer]??"");
  if(!steps.some(step=>step.includes(`答：${answer}`)))steps.push(finalStep(q));
  return {steps,validation:{valid:checked.invalid.length===0,invalidEquations:checked.invalid,equations:checked.records}};
}

function symbolLesson(q){
  const prompt=normalizeMath(q.prompt||"");
  const relations=prompt.split(/[，,；;。]/).map(part=>part.trim()).filter(Boolean);
  const known=relations.find(part=>/^[^=+\-×÷]{1,12}=\s*-?\d+$/.test(part));
  const solution=cleanSolutionSteps(q);
  return {
    methodId:"symbol-substitution",
    title:"等量代换：一层一层换",
    methodSteps:[
      known?`先找已知量：${known}。`:"先找题目里已经知道数值的图案或数量。",
      "沿着等量关系一层一层换：先算离已知量最近的图案，再用它算下一层。",
      "最后才做题目所问的加、减、乘或除，并把结果代回原关系检查。"
    ],
    solutionSteps:solution.steps,
    visual:relationVisual(["找已知","逐层代换","最后计算"]),
    validation:solution.validation
  };
}

function arithmeticLesson(q,reveal){
  const math=extractArithmetic(q);
  if(!math)return null;
  const {a,b,op,answer}=math;
  let title="把计算过程看清楚";
  let methodSteps=[];
  let solutionSteps=[];
  let visual="";
  if(op==="+"){
    title="加法：相同数位对齐";
    methodSteps=a<=20&&b<=20
      ?[`从 ${a} 开始，加 ${b} 就是在数轴上向右走 ${b} 步。`,`到达的新位置就是和，再用倒着减检查。`]
      :["相同数位对齐，从个位算起。","哪一位相加满10，就向前一位进1；最后别漏写最高位的进位。"];
    solutionSteps=a<=20&&b<=20
      ?[`从 ${a} 向右走 ${b} 步，到达 ${answer}。`,`所以 ${a}+${b}=${answer}。`,finalStep(q)]
      :[...verticalAdditionSteps(a,b,answer),finalStep(q)];
    visual=reveal?(a<=20&&b<=20?numberLine(a,b,op):placeValue(answer)):relationVisual([`从${a}开始`,`向右${b}步`,`到哪里？`]);
  }else if(op==="-"){
    title="减法：从个位开始减";
    methodSteps=a<=20&&b<=20
      ?[`从 ${a} 开始，减 ${b} 就是在数轴上向左退 ${b} 步。`,`到达的新位置就是差，再用加法验算。`]
      :["相同数位对齐，从个位算起。","当前数位不够减，就向前一位退1当10；遇到连续的0要逐位退。"];
    solutionSteps=a<=20&&b<=20
      ?[`从 ${a} 向左退 ${b} 步，到达 ${answer}。`,`所以 ${a}-${b}=${answer}；用 ${answer}+${b}=${a} 验算。`,finalStep(q)]
      :[...verticalSubtractionSteps(a,b,answer),finalStep(q)];
    visual=reveal?(a<=20&&b<=20?numberLine(a,b,op):placeValue(answer)):relationVisual([`从${a}开始`,`向左${b}步`,`到哪里？`]);
  }else if(op==="×"){
    title="乘法：先认清几组、每组几个";
    methodSteps=["乘法表示几个相同的数相加。","把一个数看成“组数”，另一个数看成“每组几个”，再用乘法口诀计算。"];
    solutionSteps=[`${a}组，每组${b}个，就是 ${a}×${b}=${answer}。`,finalStep(q)];
    visual=relationVisual([`${a}组`,`每组${b}个`,reveal?`一共${answer}个`:"一共？"]);
  }else{
    title="除法：看清平均分还是几个一组";
    methodSteps=["先找总数和每份数。","总数÷每份数=份数；算完用“份数×每份数”检查能不能回到总数。"];
    solutionSteps=[`${a}÷${b}=${answer}，因为 ${answer}×${b}=${a}。`,finalStep(q)];
    visual=relationVisual([`总数${a}`,`每份${b}`,reveal?`分成${answer}份`:"分成几份？"]);
  }
  return {methodId:`arithmetic-${op}`,title,methodSteps,solutionSteps,visual,validation:{valid:true,invalidEquations:[],equations:[]}};
}

function sumDifferenceLesson(q){
  const prompt=normalizeMath(q.prompt||"");
  const match=prompt.match(/和是\s*(\d+).*?(?:大数比小数多|相差)\s*(\d+)/)
    ||prompt.match(/共有\s*(\d+).*?比.*?多\s*(\d+)/);
  if(!match)return null;
  const sum=Number(match[1]),difference=Number(match[2]);
  const equalPart=sum-difference;
  const small=equalPart/2;
  const big=small+difference;
  if(!Number.isInteger(small))return null;
  const asksSmall=/小数(?:是|等于|有)?多少|较少的一组/.test(prompt);
  const checked=validatedExplanation(q);
  return {
    methodId:"sum-difference",
    title:"和差问题：先拿走多出的部分",
    methodSteps:[
      "画两条长短不同的纸条表示两个数。",
      "先从总数里拿走大数多出的部分，剩下的就能平均分成两份。",
      "求出小数后，再把多出的部分加回去得到大数。"
    ],
    solutionSteps:[
      `先把大数多出的 ${difference} 拿出来：${sum}-${difference}=${equalPart}。`,
      `剩下的两份一样多：${equalPart}÷2=${small}，所以小数是 ${small}。`,
      `大数是 ${small}+${difference}=${big}。`,
      `题目问${asksSmall?"小数":"大数"}，所以写 ${asksSmall?small:big}。`,
      finalStep(q)
    ],
    visual:stripVisual(sum,difference),
    validation:{valid:checked.invalid.length===0,invalidEquations:checked.invalid,equations:checked.records}
  };
}

function chickenRabbitLesson(q){
  const prompt=normalizeMath(q.prompt||"");
  const match=prompt.match(/(?:共有)?\s*(\d+)\s*个头.*?(\d+)\s*条腿/);
  if(!match)return null;
  const heads=Number(match[1]),legs=Number(match[2]);
  const allChicken=heads*2;
  const extra=legs-allChicken;
  const rabbits=extra/2;
  if(!Number.isInteger(rabbits)||rabbits<0)return null;
  const chickens=heads-rabbits;
  return {
    methodId:"chicken-rabbit",
    title:"鸡兔同笼：先假设全是鸡",
    methodSteps:[
      "每个头先配2条腿，假设全部都是鸡。",
      "实际多出的腿来自兔子：每把一只鸡换成兔，就多2条腿。",
      "多出的腿÷2就是兔的只数，再用头数检查。"
    ],
    solutionSteps:[
      `如果 ${heads} 个头全是鸡，应有 ${heads}×2=${allChicken} 条腿。`,
      `实际多 ${legs}-${allChicken}=${extra} 条腿。`,
      `每只兔比鸡多2条腿，所以兔有 ${extra}÷2=${rabbits} 只。`,
      `检查：鸡有 ${chickens} 只，${chickens}×2+${rabbits}×4=${legs} 条腿。`,
      finalStep(q)
    ],
    visual:relationVisual(["全当作鸡","找多出的腿","每2条对应1只兔"]),
    validation:{valid:true,invalidEquations:[],equations:[]}
  };
}

function specializedLesson(q,{methodId,title,methodSteps,solutionSteps,visual}){
  const checked=validatedExplanation(q);
  const steps=[...solutionSteps];
  const answer=String(q.options?.[q.answer]??"");
  if(!steps.some(step=>step.includes(`答：${answer}`)))steps.push(finalStep(q));
  return {
    methodId,
    title,
    methodSteps,
    solutionSteps:steps,
    visual,
    validation:{valid:checked.invalid.length===0,invalidEquations:checked.invalid,equations:checked.records}
  };
}

function roundingLesson(q){
  const prompt=normalizeMath(q.prompt||"");
  const match=prompt.match(/(\d+)最接近哪个整(十|百)数/);
  if(!match)return null;
  const number=Number(match[1]);
  const base=match[2]==="百"?100:10;
  const lower=Math.floor(number/base)*base;
  const upper=number%base===0?number:lower+base;
  if(lower===upper){
    return specializedLesson(q,{methodId:"rounding",title:"找最近整十（整百）：看它落在哪两个整点之间",methodSteps:[`先找 ${number} 左右相邻的整${match[2]}数。`,`分别比较距离，离谁近就选谁；本身是整${match[2]}数时直接选自己。`],solutionSteps:[`${number} 本身就是整${match[2]}数，所以不需要改变。`],visual:relationVisual([`${number}`,"本身就是整点"])});
  }
  const left=number-lower,right=upper-number;
  const nearest=left<right?lower:upper;
  return specializedLesson(q,{methodId:"rounding",title:"找最近整十（整百）：比较左右距离",methodSteps:[`先找 ${number} 左右相邻的两个整${match[2]}数。`,`分别算离左边和右边有多远，距离较小的就是最近数。`],solutionSteps:[`${number} 在 ${lower} 和 ${upper} 之间。`,`离 ${lower} 有 ${left}，离 ${upper} 有 ${right}。`,`因为 ${Math.min(left,right)} 更小，所以最近的是 ${nearest}。`],visual:roundingVisual(number,lower,upper)});
}

function placeValueLesson(q){
  const prompt=normalizeMath(q.prompt||"");
  const match=prompt.match(/(\d{1,4})/);
  if(!match)return null;
  const number=Number(match[1]);
  const thousands=Math.floor(number/1000);
  const hundreds=Math.floor(number%1000/100);
  const tens=Math.floor(number%100/10);
  const ones=number%10;
  let solutionSteps=[];
  if(/几个十和几个一/.test(prompt))solutionSteps=[`${number}=${tens}×10+${ones}，所以由 ${tens} 个十和 ${ones} 个一组成。`];
  else if(/千位/.test(prompt))solutionSteps=[`从右往左依次是个位、十位、百位、千位，所以千位数字是 ${thousands}。`];
  else if(/百位/.test(prompt))solutionSteps=[`从右往左依次是个位、十位、百位，所以百位数字是 ${hundreds}。`];
  else if(/十位/.test(prompt))solutionSteps=[`从右往左第2位是十位，所以十位数字是 ${tens}。`];
  else if(/个位/.test(prompt))solutionSteps=[`最右边一位是个位，所以个位数字是 ${ones}。`];
  else solutionSteps=cleanSolutionSteps(q).steps;
  return specializedLesson(q,{methodId:"place-value",title:"数位：从右往左认个位、十位、百位",methodSteps:["先把每个数字放进对应的数位盒。","某一位上的数字表示有几个这样的计数单位，0也要保留。"],solutionSteps,visual:placeValue(number)});
}

function forwardCountingLesson(q){
  const match=normalizeMath(q.prompt||"").match(/(\d+)后面第(\d+)个数/);
  if(!match)return null;
  const start=Number(match[1]),count=Number(match[2]);
  const sequence=Array.from({length:count},(_,index)=>start+index+1);
  return specializedLesson(q,{methodId:"forward-counting",title:"往后数：第1个数是起点后面的那个数",methodSteps:[`从 ${start} 的下一个数开始数，不能把 ${start} 自己算作第1个。`,`每往后一个位置就加1，并同时数清第几个。`],solutionSteps:[`依次往后数：${sequence.join("、")}。`,`第 ${count} 个是 ${start+count}。`],visual:relationVisual([`${start}`, ...sequence.map(String)])});
}

function makeTenLesson(q){
  const match=normalizeMath(q.prompt||"").match(/(\d+)\s*\+\s*(\d+)/);
  if(!match)return null;
  const first=Number(match[1]),second=Number(match[2]);
  const need=(10-first%10)%10;
  const rest=second-need;
  if(!need){
    const tens=Math.floor(second/10)*10,ones=second%10,answer=first+second;
    return specializedLesson(q,{methodId:"make-ten",title:"整十数加两位数：先加整十，再加个位",methodSteps:[`${first} 已经是整十数，把 ${second} 拆成 ${tens} 和 ${ones}。`,`先加整十部分，再加个位部分，数位更清楚。`],solutionSteps:[`${second}=${tens}+${ones}。`,`${first}+${tens}=${first+tens}。`,`${first+tens}+${ones}=${answer}。`],visual:relationVisual([`${first}+${tens}`,`得到${first+tens}`,`再加${ones}`])});
  }
  if(rest<0){
    const lower=Math.floor(first/10)*10,ones=first%10,tail=ones+second,answer=first+second;
    return specializedLesson(q,{methodId:"make-ten",title:"拆成整十数：整十和个位分开算",methodSteps:[`把 ${first} 拆成 ${lower} 和 ${ones}。`,`先把个位 ${ones} 与 ${second} 合起来，再加回整十部分。`],solutionSteps:[`${first}=${lower}+${ones}。`,`${ones}+${second}=${tail}。`,`${lower}+${tail}=${answer}。`],visual:relationVisual([`${first}拆开`,`${lower}和${ones}`,`再加${second}`])});
  }
  const bridge=first+need;
  const answer=first+second;
  return specializedLesson(q,{methodId:"make-ten",title:"凑整计算：先把个位凑成10",methodSteps:[`看 ${first} 的个位，还差 ${need} 就到下一个整十数。`,`把 ${second} 拆成 ${need} 和 ${rest}，先凑整再加剩下的。`],solutionSteps:[`${second}=${need}+${rest}。`,`${first}+${need}=${bridge}。`,`${bridge}+${rest}=${answer}。`],visual:relationVisual([`${first}+${need}`,`得到${bridge}`,`再加${rest}`])});
}

function digitReverseLesson(q){
  const match=normalizeMath(q.prompt||"").match(/两位数(\d{2})交换十位和个位/);
  if(!match)return null;
  const number=match[1];
  const reversed=Number(number[1]+number[0]);
  return specializedLesson(q,{methodId:"digit-reversal",title:"交换数位：数字换位置，数位价值也跟着换",methodSteps:[`先认出 ${number} 的十位是 ${number[0]}、个位是 ${number[1]}。`,`交换后，原个位放到十位，原十位放到个位。`],solutionSteps:[`交换后是 ${number[1]} 个十和 ${number[0]} 个一。`,`新数是 ${reversed}。`],visual:relationVisual([`十位${number[0]}`,"交换",`十位${number[1]}`])});
}

function completeTensLesson(q){
  const match=normalizeMath(q.prompt||"").match(/(\d+)里最多有几个完整的十/);
  if(!match)return null;
  const number=Number(match[1]),tens=Math.floor(number/10),ones=number%10;
  return specializedLesson(q,{methodId:"complete-tens",title:"完整的十：只数能凑满10的组",methodSteps:["每10个圈成一组，没满10的只能算零散的个。","十位数字就是完整十的组数。"],solutionSteps:[`${number}=${tens}×10+${ones}。`,`有 ${tens} 个完整的十，还剩 ${ones} 个一。`],visual:placeValue(number)});
}

function polygonLesson(q){
  const match=String(q.prompt||"").match(/(三角形|四边形|五边形|六边形)有几条边/);
  if(!match)return null;
  const sides={三角形:3,四边形:4,五边形:5,六边形:6}[match[1]];
  return specializedLesson(q,{methodId:"polygon-sides",title:"多边形：名称里的数字就是边数",methodSteps:["沿图形边界一条一条数，数过的边做记号。","边和边连接的转角数相同，可以用顶点再检查一次。"],solutionSteps:[`${match[1]}有 ${sides} 条边，也有 ${sides} 个顶点。`],visual:relationVisual([match[1],`${sides}条边`,`${sides}个顶点`])});
}

function estimationLesson(q){
  const match=normalizeMath(q.prompt||"").match(/(\d+)\s*([+\-])\s*(\d+)/);
  if(!match)return null;
  const first=Number(match[1]),operator=match[2],second=Number(match[3]);
  const base=Math.max(first,second)>=100?100:10;
  const roundedFirst=Math.round(first/base)*base;
  const roundedSecond=Math.round(second/base)*base;
  const estimate=calculate(roundedFirst,operator,roundedSecond);
  const exact=calculate(first,operator,second);
  return specializedLesson(q,{methodId:"estimate-then-exact",title:"先估一估，再准确计算",methodSteps:[`先把两个数看成附近的整${base===100?"百":"十"}数，得到大概范围。`,`再按数位准确计算；准确结果应和估算在同一范围。`],solutionSteps:[`估算：${first}≈${roundedFirst}，${second}≈${roundedSecond}，所以大约是 ${estimate}。`,`准确算：${first}${operator}${second}=${exact}。`,`准确结果 ${exact} 与估算 ${estimate} 接近，结果合理。`],visual:relationVisual([`估算约${estimate}`,`准确算${exact}`,"比较范围"])});
}

function remainderOnlyLesson(q){
  const prompt=normalizeMath(q.prompt||"");
  let match=prompt.match(/(\d+)÷(\d+).*余数/);
  if(!match)match=prompt.match(/(\d+).*每(\d+)个.*剩几个/);
  if(!match)return null;
  const total=Number(match[1]),each=Number(match[2]);
  const quotient=Math.floor(total/each),remainder=total%each;
  return specializedLesson(q,{methodId:"remainder-only",title:"求余数：先找最大的完整组",methodSteps:[`找不超过 ${total} 的最大 ${each} 的倍数。`,`总数减去完整组用掉的数量，剩下的才是余数；余数一定小于 ${each}。`],solutionSteps:[`${each}×${quotient}=${each*quotient}，还能完整分 ${quotient} 组。`,`${total}-${each*quotient}=${remainder}，所以余数是 ${remainder}。`,`检查：${each}×${quotient}+${remainder}=${total}。`],visual:relationVisual([`总数${total}`,`${quotient}个完整组`,`余${remainder}`])});
}

function repeatedAdditionLesson(q){
  const match=normalizeMath(q.prompt||"").match(/用加法表示(\d+)×(\d+)/);
  if(!match)return null;
  const addend=Number(match[1]),times=Number(match[2]);
  const expression=Array.from({length:times},()=>addend).join("+");
  const total=addend*times;
  return specializedLesson(q,{methodId:"repeated-addition",title:"乘法改写成加法：相同加数重复出现",methodSteps:[`${addend}×${times}表示 ${times} 个 ${addend} 相加。`,`加数必须相同，出现次数由后一个数决定。`],solutionSteps:[`${addend}×${times}=${expression}=${total}。`],visual:groupsVisual(times,addend,true,total)});
}

function consecutiveSumLesson(q){
  const prompt=normalizeMath(q.prompt||"");
  const match=prompt.match(/从1连续加到(\d+)/)||prompt.match(/1\+2\+3\+…\+(\d+)/);
  if(!match)return null;
  const last=Number(match[1]);
  const pairSum=last+1;
  const pairCount=Math.floor(last/2);
  const middle=last%2?(last+1)/2:0;
  const total=pairSum*pairCount+middle;
  const solutionSteps=[`首尾配对：1+${last}=${pairSum}，2+${last-1}=${pairSum}，每对的和相同。`];
  if(middle)solutionSteps.push(`共有 ${pairCount} 对，还剩中间的 ${middle}。`,`总和是 ${pairSum}×${pairCount}+${middle}=${total}。`);
  else solutionSteps.push(`正好有 ${pairCount} 对，所以总和是 ${pairSum}×${pairCount}=${total}。`);
  return specializedLesson(q,{methodId:"consecutive-pairing",title:"连续数求和：首尾配成相同的和",methodSteps:["把第1个和最后1个配成一对，第2个和倒数第2个配成一对。","先算每对的和，再数有几对；项数是奇数时别漏掉中间数。"],solutionSteps,visual:relationVisual([`每对${pairSum}`,`${pairCount}对`,middle?`加中间${middle}`:"正好配完"])});
}

function operationSelectionLesson(q){
  const answer=String(q.options?.[q.answer]??"");
  return specializedLesson(q,{methodId:"operation-selection",title:"选算式：按事情发生顺序写",methodSteps:["先写开始数量，再把“来、增加”写成加，把“走、用掉”写成减。","算式中的数字顺序要和事情发生顺序一致，暂时不用急着算结果。"],solutionSteps:[`按题意依次记录数量变化，应列算式 ${answer}。`],visual:relationVisual(["开始","发生变化","写出算式"])});
}

function questionMatchLesson(q){
  const answer=String(q.options?.[q.answer]??"");
  return specializedLesson(q,{methodId:"question-matching",title:"算式配问题：先翻译运算的意思",methodSteps:["加法表示把两部分合起来；减法表示去掉、求剩余或求相差。","逐个读选项，只保留数量关系和给定算式完全一致的问题。"],solutionSteps:[`给定算式表示把两部分合起来，与“${answer}”的关系一致。`],visual:relationVisual(["读算式","翻译关系","匹配问题"])});
}

function profileFor(q){
  const kind=normalizedKind(q);
  const prompt=normalizeMath(q.prompt||"");
  const text=`${kind} ${prompt}`;
  const equations=extractEquations(q);
  if(/和差问题|和是\s*\d+.*(?:大数比小数多|相差)/.test(text))return {special:"sum-difference"};
  if(/鸡兔同笼/.test(text))return {special:"chicken-rabbit"};
  if(/最接近哪个整(?:十|百)数/.test(prompt))return {special:"rounding"};
  if(/里面有几个十和几个一|(?:千|百|十|个)位数字/.test(prompt))return {special:"place-value"};
  if(/后面第\d+个数/.test(prompt))return {special:"forward-counting"};
  if(/看成整十数再算/.test(prompt))return {special:"make-ten"};
  if(/交换十位和个位/.test(prompt))return {special:"digit-reversal"};
  if(/最多有几个完整的十/.test(prompt))return {special:"complete-tens"};
  if(/(?:三角形|四边形|五边形|六边形)有几条边/.test(prompt))return {special:"polygon-sides"};
  if(/估一估再准确算/.test(prompt))return {special:"estimate-then-exact"};
  if(/余数是多少|装满后剩几个/.test(prompt))return {special:"remainder-only"};
  if(/用加法表示\d+×\d+/.test(prompt))return {special:"repeated-addition"};
  if(/从1连续加到\d+/.test(prompt)||/1\+2\+3\+…\+\d+/.test(prompt))return {special:"consecutive-pairing"};
  if(/运算顺序/.test(kind)&&/哪个算式正确/.test(prompt))return {special:"operation-selection"};
  if(/选择合适问题/.test(kind))return {special:"question-matching"};
  if(/逆向运算|逆向两步|反向求未知数|开放填空|方框里填|□/.test(text))return {id:"reverse-operation",title:"逆推题：从结果倒着走",steps:["先从等号右边的结果开始。","按相反顺序倒着算：加变减、减变加、乘变除、除变乘。","把求出的数放回原式，从左到右检查一次。"],labels:["看最后结果","倒着还原","代回检查"]};
  if(/周期|循环|重复排列/.test(text))return {id:"cycle",title:"周期规律：先圈出一整组",steps:["先圈出从头到尾重复的一整组，并数出每组有几个。","用目标位置按组去分；有余数就从每组第1个继续数。","如果正好分完，答案是每组的最后一个，不能当作第0个。"],labels:["找一组","按组分","看余数位置"]};
  if(/规律|数列|排序/.test(text)&&!/排序定位|从大到小|从小到大/.test(text))return {id:"pattern",title:"找规律：同一个变化要连续成立",steps:["先比较相邻两项，看每次增加、减少或重复什么。","用同一个规则再检查一组，连续成立才算找到规律。","按这个规则推到题目所问的位置。"],labels:["比相邻","再验证","继续推"]};
  if(/方向|路线/.test(text))return {id:"direction",title:"方向与路线：每一步都从当前方向出发",steps:["先标出开始时面向哪里。","每转一次或走一段，就更新当前方向，不能一直按最初方向判断。","问路程就把每段长度相加；问位置才看东南西北。"],labels:["标起点","逐步转向","分清路程位置"]};
  if(/搭配|组合|排列|枚举|每两队|比赛一场/.test(text))return {id:"enumeration",title:"搭配与组合：有顺序地列，不重不漏",steps:["固定第一类中的一个，再和第二类逐个搭配。","换到下一个时按同样顺序继续，并划掉已经数过的。","如果A配B与B配A算同一种，只能数一次。"],labels:["固定一个","逐个搭配","检查重复"]};
  if(/进一法|去尾法|有余数|尽量平均分/.test(text))return {id:"division-remainder",title:"有余数的除法：先弄清余数怎么处理",steps:["先用除法求能装满几组，并看余数。","问“至少需要”时，有余数要再加1组；问“最多坐满”时，只数完整的组。","把答案放回生活情境检查，不能只看商。"],labels:["求商余数","看至少或最多","结合题意"]};
  if(/经过时间|时间换算|分钟|几时结束|什么时候结束/.test(text))return {id:"time-calculation",title:"时间题：从开始时刻沿时间线往后走",steps:["先分清题目给的是时刻还是经过时间。","分钟满60要换成1小时；跨过整点时分开计算更清楚。","把结果代回时间线，检查先后顺序。"],labels:["开始时刻","经过多久","结束时刻"]};
  if(/人民币|找零|总价|付款|元|角/.test(text))return {id:"money-calculation",title:"购物题：先算总价，再看付款和找零",steps:["有几件相同商品时，先用单价×数量求总价。","找零用付款数减总价；付款数必须不少于总价。","元和角先统一单位，答案写回正确单位。"],labels:["单价×数量","付款-总价","写回单位"]};
  if(/单位换算|长度|厘米|千米|千克|克/.test(text)||/(?:\d+)\s*(?:米|克)/.test(prompt))return {id:"unit-conversion",title:"单位换算：先统一成同一种单位",steps:["圈出每个数字的单位，并写出换算关系。","先换单位，再进行加减或比较，不能把不同单位直接相加。","结果按题目要求换回指定单位。"],labels:["看单位","统一单位","计算并写回"]};
  if(/周长|边长|正方形|长方形/.test(text))return {id:"perimeter",title:"周长：沿边界绕一周",steps:["先确认题目问的是边长还是周长。","长方形周长是两个长加两个宽；正方形是4条相同的边。","逆向求边长时，先求半周长再减已知边。"],labels:["认清所求","沿四边相加","逆向检查"]};
  if(/格点|图形计数|方格|粘合边|数形结合/.test(text))return {id:"grid-geometry",title:"方格与格点：格数和点数不能混",steps:["先确认数的是小方格、格点还是相邻的粘合边。","一排有n个格，边界上会有n+1个点；排成一行的n个图形只有n-1处相邻。","画一个更小的同类图检查规律。"],labels:["认清对象","找n与n±1","小图检查"]};
  if(/图形/.test(text))return {id:"geometry",title:"图形题：先认形状，再数特征",steps:["先看边、角和位置关系，确认是什么图形。","按题目要求数边、角或图形数量，数过的做记号。","换一种顺序再数一次，检查是否遗漏。"],labels:["认图形","逐个数","换序检查"]};
  if(/统计|读图/.test(text))return {id:"statistics",title:"统计题：先逐项读数，再合计或比较",steps:["先确认图例和每一格代表多少。","把各项数据逐个写下，再按问题求总数或相差。","用估算检查合计是否在合理范围。"],labels:["读图例","记录数据","合计比较"]};
  if(/排序|排序定位|最大|最小/.test(text))return {id:"ordering",title:"排序：从最高位开始比较",steps:["先比较最高位，最高位相同再比较下一位。","按从大到小或从小到大的要求逐个排列。","最后数清题目问的是第几个。"],labels:["比最高位","依次排列","找指定位置"]};
  if(/比较|较大|较小/.test(text))return {id:"number-comparison",title:"比较大小：从最高位开始",steps:["位数多的数更大；位数相同就从最高位逐位比较。","遇到相同数位继续往右看，直到出现不同。","带单位比较时先统一单位。"],labels:["看位数","逐位比较","写出结论"]};
  if(/数的组成|数位|分类/.test(text))return {id:"number-data",title:"数的组成：看清每一位表示多少",steps:["从右往左依次认个位、十位、百位和千位。","某一位是几，就表示有几个对应计数单位。","用展开式重新组成原数检查。"],labels:["认数位","说组成","重组检查"]};
  if(/错题诊断|错误|判断|够不够|有效信息|多余|信息筛选|抗干扰|补充条件|方法选择|列式选择|算式匹配|数学语言/.test(text))return {id:"reasoning-check",title:"判断题：先说依据，再选答案",steps:["把题目真正问的内容用自己的话说一遍。","划掉不影响问题的信息，再检查条件够不够。","先写出判断依据或算式，最后才选答案。"],labels:["读问题","筛条件","用依据判断"]};
  const mixed=pureMixedExpression(q);
  if(mixed)return {id:"mixed-calculation",title:"混合运算：顺序不能乱",steps:[/[（(]/.test(mixed)?"先算括号里面，再算括号外面。":/[×÷]/.test(mixed)&&/[+\-]/.test(mixed)?"先算乘除，再算加减；同一级运算从左往右。":"只有同一级运算时，从左往右一步一步算。","每完成一步就写下新的算式，不要在脑中同时跳两步。","用估算或逆运算检查最后结果。"],labels:["看顺序","算第一步","用结果继续"]};
  if(equations.length>=2||/两步|连续增加|连续减少|先加后减|先减后加|三数相加|乘加|乘减|除加|购物两步|容量问题|变化判断|多量比较/.test(text))return {id:"multi-step-application",title:"两步应用题：一步只解决一个小问题",steps:["先按事情发生的顺序，找出第一步能求什么。","把第一步的结果当作新条件，再解决最后的问题。","每一步都带着单位，最后回到原题检查答的是不是所问。"],labels:["求中间量","带入下一步","回答原问题"]};
  if(/平均分|每份|每组|几个一组|除法/.test(text))return {id:"division-application",title:"除法应用：分清每份数和份数",steps:["先找总数，再判断已知的是每份数还是份数。","总数÷份数=每份数；总数÷每份数=份数。","用“份数×每份数=总数”检查。"],labels:["找总数","分清两种除法","乘法检查"]};
  if(/乘法|每轮|每盒|每行|每排|每箱|几倍|数图结合/.test(text))return {id:"multiplication-application",title:"乘法应用：找几组和每组几个",steps:["圈出“有几组”和“每组几个”。","求一共多少，就是组数×每组数。","把乘法看成相同加数连加，检查数量关系。"],labels:["找组数","找每组数","相乘求总数"]};
  if(/合并|求总数|一共|共有|合计|增加|又送来|比多求大数|逆向求原有|求原来|已知剩余/.test(text))return {id:"addition-application",title:"加法应用：把有关的部分合起来",steps:["先找清楚是哪几部分要合起来。","求总数或原有数量时，把这些部分相加；“比……多”求较大数也用加法。","写好单位，再用减法倒过来检查。"],labels:["找各部分","相加求整体","减法检查"]};
  if(/剩余|减少|用掉|求部分|求相差|找回|还要|比少求小数|凑整|相差/.test(text))return {id:"subtraction-application",title:"减法应用：从整体中去掉或比较",steps:["先确认哪个数是整体或较大的数。","求剩余、另一部分或相差多少，用整体减去已知部分，或大数减小数。","结果必须回答题目所问，不能把被减的部分当答案。"],labels:["找整体或大数","减去已知部分","检查问题"]};
  const firstEquation=equations[0]?.left||"";
  if(/^\d+\+\d+$/.test(firstEquation))return {id:"addition-application",title:"加法关系：把有关数量合起来",steps:["先说清楚哪两个数量需要合起来。","用加法求整体或较大数。","再用减法倒过来检查。"],labels:["找两部分","相加","减法检查"]};
  if(/^\d+-\d+$/.test(firstEquation))return {id:"subtraction-application",title:"减法关系：去掉或求相差",steps:["先找整体和部分，或者找较大数和较小数。","整体减部分求剩余；大数减小数求相差。","用加法验算，并回答原问题。"],labels:["找整体或大数","相减","加法检查"]};
  if(/^\d+×\d+$/.test(firstEquation))return {id:"multiplication-application",title:"乘法关系：几个相同数量",steps:["先找有几组和每组几个。","组数×每组数求总数。","用相同加数连加检查。"],labels:["找组数","找每组数","相乘"]};
  if(/^\d+÷\d+$/.test(firstEquation))return {id:"division-application",title:"除法关系：平均分或几个一组",steps:["先找总数。","分清题目问每份几个，还是可以分几份。","用乘法倒过来检查。"],labels:["找总数","分清所求","乘法检查"]};
  return {id:"concept",title:"先读懂条件、问题和关系",steps:["圈出有用的数字和单位，用自己的话说出题目问什么。","想清楚数量是合起来、去掉、平均分，还是比较关系。","列式后用生活常识或逆运算检查，再写完整答案。"],labels:["找条件","找问题","列式检查"]};
}

function profileLesson(q,profile){
  if(profile.special==="sum-difference")return sumDifferenceLesson(q);
  if(profile.special==="chicken-rabbit")return chickenRabbitLesson(q);
  if(profile.special==="rounding")return roundingLesson(q);
  if(profile.special==="place-value")return placeValueLesson(q);
  if(profile.special==="forward-counting")return forwardCountingLesson(q);
  if(profile.special==="make-ten")return makeTenLesson(q);
  if(profile.special==="digit-reversal")return digitReverseLesson(q);
  if(profile.special==="complete-tens")return completeTensLesson(q);
  if(profile.special==="polygon-sides")return polygonLesson(q);
  if(profile.special==="estimate-then-exact")return estimationLesson(q);
  if(profile.special==="remainder-only")return remainderOnlyLesson(q);
  if(profile.special==="repeated-addition")return repeatedAdditionLesson(q);
  if(profile.special==="consecutive-pairing")return consecutiveSumLesson(q);
  if(profile.special==="operation-selection")return operationSelectionLesson(q);
  if(profile.special==="question-matching")return questionMatchLesson(q);
  const solution=cleanSolutionSteps(q);
  return {methodId:profile.id,title:profile.title,methodSteps:profile.steps,solutionSteps:solution.steps,visual:relationVisual(profile.labels),validation:solution.validation};
}

function fallbackLesson(q){
  const solution=cleanSolutionSteps(q);
  return {methodId:"concept",title:"先读懂题意",methodSteps:["找出有用条件。","说清题目所问。","列式计算并检查。"],solutionSteps:solution.steps,visual:relationVisual(["条件","问题","检查"]),validation:solution.validation};
}

function equationPlanHint(equations){
  const first=equations[0];
  if(!first)return "";
  return `把数量关系写成算式：${first.left}=？。先自己算问号，不要看选项猜。`;
}

function recoveryHint(methodId,mistakeEntry,mistakeReason){
  if(!mistakeEntry)return "";
  const entered=String(mistakeEntry.selectedValue??mistakeEntry.value??"").trim();
  const focus={
    "symbol-substitution":"不要跳过中间图案，回到已知量后每次只代换一层。",
    "reverse-operation":"不要从左边硬算；从最后结果开始，用相反运算倒着还原。",
    "multi-step-application":"检查是否只算完第一步；中间结果还要带入第二步。",
    "addition-application":"重新确认题目是在合并两部分，别把“多多少”与“有多少”混在一起。",
    "subtraction-application":"先找整体或大数，把它写在减号前面。",
    "multiplication-application":"重新圈出组数和每组数，别把乘法只算成一次加法。",
    "division-application":"重新分清题目问每份几个，还是能分几份。",
    "division-remainder":"商和余数回答的是不同问题，先看题目究竟问哪一个。",
    "remainder-only":"题目只问剩下多少，不要把完整组数当答案。",
    "money-calculation":"先检查总价，再确认付款数减总价的顺序。",
    "time-calculation":"检查分钟有没有跨过60，以及题目问开始还是结束时刻。",
    "unit-conversion":"先把单位统一，再比较或计算。",
    "place-value":"从右往左重新标出个位、十位、百位。",
    "rounding":"把数放回左右两个整点之间，再比较两边距离。",
    "sum-difference":"先拿走多出的部分，再平均分；不能直接把总数除以2。"
  }[methodId]||"把刚才的答案先遮住，重新按“条件—关系—计算—检查”走一遍。";
  const prefix=entered?`你刚才填写了“${entered}”。`:"刚才这一步还没有算对。";
  return `🔎 针对刚才的答案：${prefix}${mistakeReason?`重点检查“${mistakeReason}”。`:""}${focus}`;
}

function hiddenVisual(methodId,original){
  const labels={
    "place-value":["从右往左","标数位","再回答"],
    "forward-counting":["起点不算第1个","逐个加1","数到所问位置"],
    "digit-reversal":["认十位个位","交换位置","写新数"],
    "complete-tens":["每10个一组","圈完整组","零散不算"],
    "polygon-sides":["沿边开始","数过做记号","回到起点"],
    "estimate-then-exact":["先估范围","再准确算","比较是否合理"],
    "remainder-only":["找完整组","总数减已用","余数小于每份"],
    "repeated-addition":["找相同加数","数出现次数","再求和"]
  }[methodId];
  return labels?relationVisual(labels):original;
}

export function buildTutor(q,{stage="guided",reveal=false,hintLevel=0,mistakeEntry=null,mistakeReason=""}={}){
  const shouldReveal=reveal||stage==="teach";
  let lesson;
  if(isSymbolSubstitutionQuestion(q))lesson=symbolLesson(q);
  else lesson=arithmeticLesson(q,shouldReveal)||profileLesson(q,profileFor(q));
  if(!lesson)lesson=fallbackLesson(q);
  const equations=extractEquations(q);
  const checkpoint=stage==="guided"&&equations.length>=2?equations[0]:null;
  const methodSteps=[...lesson.methodSteps];
  const planHint=equationPlanHint(equations);
  if(planHint&&!methodSteps.includes(planHint))methodSteps.push(planHint);
  const correction=!shouldReveal?recoveryHint(lesson.methodId,mistakeEntry,mistakeReason):"";
  if(correction)methodSteps.unshift(correction);
  const available=shouldReveal?[...methodSteps,...lesson.solutionSteps]:methodSteps;
  const base=stage==="guided"?2:1;
  const visibleSteps=shouldReveal?available:available.slice(0,Math.min(available.length,base+Math.max(0,hintLevel)));
  return {
    title:lesson.title,
    methodId:lesson.methodId,
    steps:visibleSteps,
    allSteps:available,
    methodSteps,
    solutionSteps:lesson.solutionSteps,
    visual:shouldReveal?lesson.visual:hiddenVisual(lesson.methodId,lesson.visual),
    checkpoint,
    canShowMore:!shouldReveal&&visibleSteps.length<available.length,
    validated:lesson.validation.valid,
    recoveryApplied:Boolean(correction),
    validation:lesson.validation,
    speech:[lesson.title,...visibleSteps].map(step=>String(step).replace(/[。！？]+$/,"")).join("。")+"。"
  };
}

export function validateTutorQuestion(q){
  const lesson=buildTutor(q,{stage:"teach",reveal:true,hintLevel:10});
  const answer=String(q.options?.[q.answer]??"");
  return {
    valid:Boolean(lesson.validated&&lesson.steps.length&&lesson.solutionSteps.length&&lesson.solutionSteps.some(step=>step.includes(answer))),
    methodId:lesson.methodId,
    invalidEquations:lesson.validation.invalidEquations||[],
    equationCount:(lesson.validation.equations||[]).length
  };
}

export {evaluateExpression,extractArithmetic,extractEquations,escapeHTML,isSymbolSubstitutionQuestion,pureMixedExpression};
