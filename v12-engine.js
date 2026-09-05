const courses=Array.isArray(window.MATH_COURSES)?window.MATH_COURSES:[];
const banks=window.MATH_QUESTIONS||{};
const skillMap=window.MATH_V12_SKILL_MAP||{};
const config=window.MATH_V12_CONFIG||{};

const shuffle=items=>{
  const arr=[...items];
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
};
const hashText=text=>{
  let hash=2166136261;
  for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619)}
  return (hash>>>0).toString(36);
};
const dayString=(offset=0)=>{
  const date=new Date();
  date.setDate(date.getDate()+offset);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
};

function normalizeKind(kind){
  return String(kind||"同步训练")
    .replace(/·V8强化$/u,"")
    .replace(/^Lv\d+·/u,"")
    .replace(/^[^\p{L}\p{N}]+/u,"")
    .trim()||"同步训练";
}
function templateOf(prompt){
  return String(prompt||"")
    .replace(/\d+(?:\.\d+)?/g,"#")
    .replace(/[０-９]/g,"#")
    .replace(/\s+/g," ")
    .trim();
}
function difficultyRank(value){
  const text=String(value||"");
  if(/挑战|竞赛|综合/.test(text))return 4;
  if(/拓展|提高/.test(text))return 3;
  if(/巩固/.test(text))return 2;
  return 1;
}
function makeDistractor(correct,used,seed){
  const raw=String(correct);
  if(/^-?\d+(?:\.\d+)?$/.test(raw)){
    const number=Number(raw);
    for(const delta of [1,-1,2,-2,5,-5,10,-10,3,-3]){
      const candidate=String(Math.max(0,number+delta+seed%2));
      if(!used.has(candidate))return candidate;
    }
  }
  const numberMatch=raw.match(/\d+/);
  if(numberMatch){
    const number=Number(numberMatch[0]);
    for(const delta of [1,-1,2,3,-2]){
      const candidate=raw.replace(numberMatch[0],String(Math.max(0,number+delta+seed%2)));
      if(!used.has(candidate))return candidate;
    }
  }
  for(const candidate of ["无法确定","条件不足","以上都不对","再想一想"]){
    if(!used.has(candidate))return candidate;
  }
  return `其他答案${seed+1}`;
}

const APPLICATION_CONTEXTS={
  "校园":{noun:"练习本",unit:"本",recipient:"同学",traveler:"同学",removeVerb:"使用",categoryPhrase:"的封面是红色的",irrelevant:"今天是星期三"},
  "超市":{noun:"苹果",unit:"个",recipient:"顾客",traveler:"顾客",removeVerb:"卖出",categoryPhrase:"是红色的",irrelevant:"门口的招牌是蓝色的"},
  "网球场":{noun:"网球",unit:"个",recipient:"小队员",traveler:"小队员",removeVerb:"取走",categoryPhrase:"是黄色的",irrelevant:"球场旁有一棵树"},
  "动物园":{noun:"门票",unit:"张",recipient:"游客",traveler:"游客",removeVerb:"售出",categoryPhrase:"是儿童票",irrelevant:"入口处有一张地图"},
  "太空站":{noun:"能量块",unit:"块",recipient:"机器人",traveler:"机器人",removeVerb:"消耗",categoryPhrase:"亮着蓝光",irrelevant:"舷窗外能看到星星"},
  "恐龙谷":{noun:"恐龙蛋",unit:"个",recipient:"探险员",traveler:"探险员",removeVerb:"取走",categoryPhrase:"带有斑点",irrelevant:"入口处有一块指示牌"},
  "花园":{noun:"柠檬",unit:"个",recipient:"园丁",traveler:"园丁",removeVerb:"摘下",categoryPhrase:"已经成熟",irrelevant:"旁边放着一把铲子"},
  "生日会":{noun:"气球",unit:"个",recipient:"小朋友",traveler:"小朋友",removeVerb:"使用",categoryPhrase:"是红色的",irrelevant:"桌布是蓝色的"},
  "图书馆":{noun:"图书",unit:"本",recipient:"读者",traveler:"读者",removeVerb:"借出",replenishVerb:"归还",container:"箱",batch:"包",batchVerb:"装成"},
  "地铁站":{noun:"乘客",unit:"名",recipient:"车厢",traveler:"乘客",removeVerb:"离开",replenishVerb:"到站",container:"组",distribution:"carriage",batch:"组",batchVerb:"编成"},
  "科学馆":{noun:"零件",unit:"个",recipient:"实验组",traveler:"小实验员",removeVerb:"取走",replenishVerb:"补充",container:"盒",distribution:"group",batch:"套",batchVerb:"配成"},
  "运动会":{noun:"奖牌",unit:"枚",recipient:"运动员",traveler:"运动员",removeVerb:"发出",replenishVerb:"补充",container:"盒",batch:"盒",batchVerb:"装成"},
  "农场":{noun:"玉米",unit:"根",recipient:"篮子",traveler:"小农夫",removeVerb:"卖出",replenishVerb:"补充",container:"筐",distribution:"basket",batch:"捆",batchVerb:"扎成"},
  "海洋馆":{noun:"鱼食",unit:"袋",recipient:"饲养员",traveler:"饲养员",removeVerb:"使用",replenishVerb:"补充",container:"箱",batch:"箱",batchVerb:"装成"},
  "露营地":{noun:"水瓶",unit:"个",recipient:"小队",traveler:"小队员",removeVerb:"取走",replenishVerb:"补充",container:"箱",distribution:"team",batch:"箱",batchVerb:"装成"},
  "机器人城":{noun:"芯片",unit:"枚",recipient:"维修员",traveler:"维修员",removeVerb:"安装使用",replenishVerb:"补充",container:"盒",batch:"盒",batchVerb:"装成"}
};
const STORY_COUNTERS=[
  {noun:"玻璃珠",unit:"颗"},
  {noun:"铅笔",unit:"支"},
  {noun:"贴纸",unit:"张"},
  {noun:"积木",unit:"块"},
  {noun:"书签",unit:"枚"},
  {noun:"卡片",unit:"张"},
  {noun:"贝壳",unit:"个"},
  {noun:"小旗",unit:"面"}
];
const escapeRegExp=value=>String(value).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
const addRepair=(repairs,label)=>{if(!repairs.includes(label))repairs.push(label)};
function rewriteField(question,field,pattern,replacement,repairs,label){
  const before=String(question[field]||"");
  const after=before.replace(pattern,replacement);
  if(after===before)return false;
  question[field]=after;
  addRepair(repairs,label);
  return true;
}
function repairNameConsistency(question,repairs){
  rewriteField(question,"prompt",/俊俊/g,"峻峻",repairs,"姓名一致性修正");
  rewriteField(question,"explain",/俊俊/g,"峻峻",repairs,"姓名一致性修正");
  const before=question.options.join("\u0000");
  question.options=question.options.map(option=>String(option).replace(/俊俊/g,"峻峻"));
  if(question.options.join("\u0000")!==before)addRepair(repairs,"姓名一致性修正");
}
function repairPassengerLanguage(question,repairs){
  const prompt=String(question.prompt||"");
  let match=prompt.match(/^地铁站上午有(\d+)名乘客，下午增加(\d+)名乘客，共有多少？$/);
  if(match){
    question.prompt=`地铁站上午有${match[1]}名乘客，下午又有${match[2]}名乘客到站，一共有多少名乘客？`;
  }else if((match=prompt.match(/^地铁站原有(\d+)名乘客，用掉(\d+)名乘客，还剩多少？$/))){
    question.prompt=`地铁站原有${match[1]}名乘客，其中${match[2]}名乘客离开，还剩多少名乘客？`;
  }else if((match=prompt.match(/^地铁站原有(\d+)名乘客，增加(\d+)名乘客，又用掉(\d+)名乘客，还剩多少？$/))){
    question.prompt=`地铁站原有${match[1]}名乘客，又有${match[2]}名乘客到站，随后${match[3]}名乘客离开，还剩多少名乘客？`;
  }else if((match=prompt.match(/^地铁站用掉(\d+)名乘客，又补充(\d+)名乘客后有(\d+)名乘客，原来有多少？$/))){
    question.prompt=`地铁站有${match[1]}名乘客离开，随后又有${match[2]}名乘客到站，站内有${match[3]}名乘客。原来有多少名乘客？`;
  }
  if(question.prompt!==prompt)addRepair(repairs,"人物情境动词修正");
}
function repairApplicationLanguage(question,repairs){
  const kind=normalizeKind(question.kind);
  const prefix=kind.split("·")[0];
  const context=APPLICATION_CONTEXTS[prefix];
  if(!context)return;
  const {noun,unit}=context;
  const nounPattern=escapeRegExp(noun);

  if(prefix==="地铁站")repairPassengerLanguage(question,repairs);

  let prompt=String(question.prompt||"");
  let match=prompt.match(new RegExp(`^${escapeRegExp(prefix)}共有(\\d+)${unit}${nounPattern}，其中(\\d+)${unit}${nounPattern}是红色的，其余有多少？$`));
  if(match&&context.categoryPhrase){
    question.prompt=`${prefix}共有${match[1]}${unit}${noun}，其中${match[2]}${unit}${noun}${context.categoryPhrase}，其余有多少${unit}${noun}？`;
    addRepair(repairs,"分类属性语义修正");
  }

  prompt=String(question.prompt||"");
  match=prompt.match(new RegExp(`^${escapeRegExp(prefix)}有(\\d+)${unit}${nounPattern}，天气晴朗，又送来(\\d+)${unit}${nounPattern}。求现在共有多少，只需要计算哪两个数的和？$`));
  if(match&&context.irrelevant){
    question.prompt=`${prefix}有${match[1]}${unit}${noun}，${context.irrelevant}，又送来${match[2]}${unit}${noun}。忽略无关信息，现在共有多少${unit}${noun}？`;
    addRepair(repairs,"有效信息作答对齐");
  }

  prompt=String(question.prompt||"");
  match=prompt.match(new RegExp(`^${escapeRegExp(prefix)}准备(\\d+)盒${nounPattern}，每盒(\\d+)个，用掉(\\d+)个，还剩多少？$`));
  if(match){
    const perUnit=unit==="名"?"名":unit;
    const ending=unit==="名"?`多少名${noun}`:`多少${unit}${noun}`;
    question.prompt=`${prefix}有${match[1]}${context.container||"盒"}${noun}，每${context.container||"盒"}${match[2]}${perUnit}，${context.removeVerb}${match[3]}${perUnit}后，还剩${ending}？`;
    addRepair(repairs,"容器与分组语义修正");
  }

  prompt=String(question.prompt||"");
  match=prompt.match(new RegExp(`^(\\d+)${unit}${nounPattern}，每(\\d+)个装一盒，可以装几盒？$`));
  if(match){
    question.prompt=unit==="名"
      ?`${match[1]}名乘客，每${match[2]}人一组，可以分成几组？`
      :`${match[1]}${unit}${noun}，每${match[2]}${unit}装一${context.container||"盒"}，可以装几${context.container||"盒"}？`;
    addRepair(repairs,"容器与分组语义修正");
  }

  prompt=String(question.prompt||"");
  match=prompt.match(new RegExp(`^把(\\d+)${unit}${nounPattern}平均分给(\\d+)名([^，]+)，每人(?:分)?多少？$`));
  if(match){
    const total=match[1],groups=match[2];
    if(context.distribution==="carriage")question.prompt=`把${total}名乘客平均安排到${groups}节车厢，每节车厢有多少名乘客？`;
    else if(context.distribution==="group")question.prompt=`把${total}个零件平均分给${groups}个实验组，每组分到多少个零件？`;
    else if(context.distribution==="basket")question.prompt=`把${total}根玉米平均装进${groups}个篮子，每个篮子装多少根玉米？`;
    else if(context.distribution==="team")question.prompt=`把${total}个水瓶平均分给${groups}个小队，每队分到多少个水瓶？`;
    else question.prompt=`把${total}${unit}${noun}平均分给${groups}名${context.recipient}，每人分到多少${unit}${noun}？`;
    addRepair(repairs,"分配对象语义修正");
  }

  if(/·进一法$/.test(kind)){
    rewriteField(question,"prompt",/^(\d+)名[^，]+乘车/,`$1名${context.traveler}乘车`,repairs,"人物与角色量词修正");
  }
  if(/·时间跨小时$/.test(kind)){
    rewriteField(question,"prompt",/^[^\d]+(?=\d+时\d+分开始活动)/,context.traveler,repairs,"人物与角色量词修正");
  }
  if(/·去尾法$/.test(kind)&&context.batch&&context.batchVerb){
    prompt=String(question.prompt||"");
    match=prompt.match(new RegExp(`^(\\d+)${unit}${nounPattern}，每(\\d+)(?:${unit}|个)做一份，最多能做几份完整的？$`));
    if(match){
      question.prompt=`${match[1]}${unit}${noun}，每${match[2]}${unit}${context.batchVerb}一${context.batch}，最多能${context.batchVerb}几${context.batch}？`;
      addRepair(repairs,"分组用途语义修正");
    }
  }

  if(unit!=="个"){
    const unitRules=[
      [/每组(\d+)个/g,`每组$1${unit}`],
      [/每盒(\d+)个/g,`每盒$1${unit}`],
      [/另外还有(\d+)个/g,`另外还有$1${unit}`],
      [/每(\d+)个(?=(?:装一盒|装一组|一组|做一份))/g,`每$1${unit}`],
      [/分别有((?:\d+、){2}\d+)个/g,`分别有$1${unit}`],
      [/(一共|共有)多少个/g,`$1多少${unit}`]
    ];
    for(const [pattern,replacement] of unitRules)rewriteField(question,"prompt",pattern,replacement,repairs,"量词与单位规范");
    if(new RegExp(`(?:共有|共)多少？$`).test(question.prompt)){
      rewriteField(question,"prompt",/(共有|共)多少？$/,`$1多少${unit}${noun}？`,repairs,"量词与单位规范");
    }
  }

  if(prefix!=="地铁站"&&context.removeVerb!=="用掉"){
    rewriteField(question,"prompt",/用掉/g,context.removeVerb,repairs,"生活情境动词规范");
    rewriteField(question,"prompt",/先用(?=\d)/g,`先${context.removeVerb}`,repairs,"生活情境动词规范");
    rewriteField(question,"prompt",/再用(?=\d)/g,`再${context.removeVerb}`,repairs,"生活情境动词规范");
  }
  if(context.replenishVerb&&context.replenishVerb!=="补充"){
    rewriteField(question,"prompt",/补充/g,context.replenishVerb,repairs,"生活情境动词规范");
  }
}
function repairStoryLanguage(question,repairs){
  const kind=normalizeKind(question.kind);
  if(["逆向","变化判断","逆向两步","关系理解"].includes(kind)){
    const rule=STORY_COUNTERS.find(item=>String(question.prompt||"").includes(item.noun));
    if(rule){
      const counters="个张支本面枚块颗根袋瓶";
      const noun=escapeRegExp(rule.noun);
      rewriteField(question,"prompt",new RegExp(`(\\d+)[${counters}]${noun}`,"g"),`$1${rule.unit}${rule.noun}`,repairs,"物品量词修正");
      rewriteField(question,"prompt",new RegExp(`(\\d+)[${counters}](?=(?:后|，|。|？|\\?|$))`,"g"),`$1${rule.unit}`,repairs,"物品量词修正");
      rewriteField(question,"prompt",new RegExp(`多少[${counters}]`,"g"),`多少${rule.unit}`,repairs,"物品量词修正");
    }
  }
  if(kind==="变化判断"){
    rewriteField(question,"prompt",/请先说数量是变多还是变少，再求现在有多少([个张支本面枚块颗根袋瓶])。/,"先判断数量是变多、变少还是不变，再选择现在的数量。",repairs,"作答要求与选项对齐");
  }
  if(kind==="抗干扰"){
    const match=String(question.prompt||"").match(/^两筐水果共(\d+)个，第一筐(\d+)个，第二筐多少个？如果第一筐多1个，第二筐仍是多少？$/);
    if(match){
      const total=Number(match[1]),first=Number(match[2]),second=total-first;
      question.prompt=`两筐水果共${total}个，第一筐有${first}个，旁边还有1个空篮子。空篮子与水果数量无关，第二筐有多少个水果？`;
      question.explain=`空篮子是无关信息。用总数减第一筐：${total}-${first}=${second}个。`;
      addRepair(repairs,"抗干扰条件逻辑修正");
    }
  }
}

function repairQuestion(source){
  const question={...source,options:Array.isArray(source.options)?source.options.map(String):[]};
  const repairs=[];
  repairNameConsistency(question,repairs);
  const setCorrect=value=>{
    if(Number.isInteger(Number(question.answer))&&question.options[Number(question.answer)]!=null){
      question.options[Number(question.answer)]=String(value);
    }
  };

  let match=String(question.prompt||"").match(/两个数的和是(\d+)，大数比小数多(\d+)，大数是多少/);
  if(match){
    const sum=Number(match[1]);
    const statedDifference=Number(match[2]);
    const answer=Number(question.options[Number(question.answer)]);
    const correctedDifference=answer*2-sum;
    if(Number.isFinite(answer)&&correctedDifference>0&&correctedDifference!==statedDifference){
      question.prompt=question.prompt.replace(`大数比小数多${statedDifference}`,`大数比小数多${correctedDifference}`);
      const small=sum-answer;
      question.explain=`先把多出的${correctedDifference}拿出来：${sum}-${correctedDifference}=${small*2}；再平均分：${small*2}÷2=${small}；大数是${small}+${correctedDifference}=${answer}。`;
      repairs.push("和差关系奇偶修正");
    }
  }

  match=String(question.prompt||"").match(/原有(\d+)([^，]+)，增加(\d+)([^，]+)，又用掉(\d+)([^，]+)，还剩多少/);
  if(match){
    const original=Number(match[1]);
    const added=Number(match[3]);
    const used=Number(match[5]);
    const available=original+added;
    if(used>available){
      const remaining=Math.max(1,Math.floor(available/3));
      const correctedUsed=available-remaining;
      question.prompt=question.prompt.replace(`又用掉${used}`,`又用掉${correctedUsed}`);
      question.explain=`先算增加后有多少：${original}+${added}=${available}；再算剩余：${available}-${correctedUsed}=${remaining}。`;
      setCorrect(remaining);
      repairs.push("负数库存情境修正");
    }
  }

  match=String(question.prompt||"").match(/每支笔(\d+)元，买(\d+)支，付(\d+)元，应找回多少元/);
  if(match){
    const price=Number(match[1]);
    const count=Number(match[2]);
    const paid=Number(match[3]);
    const cost=price*count;
    if(paid<cost){
      const correctedPaid=Math.ceil((cost+1)/10)*10;
      const change=correctedPaid-cost;
      question.prompt=question.prompt.replace(`付${paid}元`,`付${correctedPaid}元`);
      question.explain=`先算总价：${price}×${count}=${cost}元；再算找零：${correctedPaid}-${cost}=${change}元。`;
      setCorrect(change);
      repairs.push("付款不足情境修正");
    }
  }

  match=String(question.prompt||"").match(/^([^，]{2,3})有\d+(?:本书|个积木)，比\1(?:少|多)\d+(?:本|个)?，\1有多少/);
  if(match){
    const repeatedName=match[1];
    const sourceName=repeatedName==="峻峻"?"乐乐":"峻峻";
    question.prompt=question.prompt.replace(`${repeatedName}有`,`${sourceName}有`);
    repairs.push("人物关系指代修正");
  }

  repairApplicationLanguage(question,repairs);
  repairStoryLanguage(question,repairs);

  if(repairs.length){
    const correct=String(question.options[Number(question.answer)]??"");
    const used=new Set([correct]);
    for(let index=0;index<question.options.length;index++){
      if(index===Number(question.answer))continue;
      let option=String(question.options[index]);
      if(/^-\d/.test(option)||used.has(option))option=makeDistractor(correct,used,index);
      question.options[index]=option;
      used.add(option);
    }
  }
  question.qualityRepairs=repairs;
  return question;
}

function sanitizeQuestion(source,course,index){
  const repaired=repairQuestion(source);
  const options=Array.isArray(repaired.options)?repaired.options.map(String):[];
  const answer=Number(repaired.answer);
  const correct=options[answer];
  if(correct!=null){
    const used=new Set([String(correct)]);
    options[answer]=String(correct);
    for(let i=0;i<options.length;i++){
      if(i===answer)continue;
      const value=String(options[i]);
      if(value===String(correct)||used.has(value))options[i]=makeDistractor(String(correct),used,i);
      used.add(String(options[i]));
    }
  }
  const q={...repaired,options,answer};
  q.courseId=course.id;
  q.courseTitle=course.title;
  q.set=course.set;
  q.index=index;
  q.kindName=normalizeKind(q.kind);
  q.skillId=`${course.id}::${q.kindName}`;
  q.template=templateOf(q.prompt);
  q.qid=`${course.id}:${hashText(`${source.prompt}::${(source.options||[]).join("|")}`)}`;
  q.difficultyRank=difficultyRank(q.difficulty);
  return q;
}
function questionSignature(q){
  return JSON.stringify([q.courseId,q.prompt,q.options,q.answer,q.explain||"",q.kindName||"",q.difficulty||""]);
}
function hasStoryCounterMismatch(prompt){
  const text=String(prompt||"");
  const counters="个张支本面枚块颗根袋瓶";
  return STORY_COUNTERS.some(({noun,unit})=>{
    const matches=[...text.matchAll(new RegExp(`\\d+([${counters}])${escapeRegExp(noun)}`,"g"))];
    return matches.some(match=>match[1]!==unit);
  });
}
function hasApplicationLanguageIssue(q){
  const kind=normalizeKind(q.kind);
  const context=APPLICATION_CONTEXTS[kind.split("·")[0]];
  if(!context)return false;
  const prompt=String(q.prompt||"");
  if(/只需要计算哪两个数的和|天气晴朗/.test(prompt))return true;
  if(/·去尾法$/.test(kind)&&/做一份/.test(prompt))return true;
  if(context.unit!=="个"&&new RegExp(`(?:每组|每盒|另外还有|每)\\d+个(?=.*${escapeRegExp(context.noun)})`).test(prompt))return true;
  return false;
}

export function answerDescriptor(q){
  const raw=q?.options?.[q.answer];
  if(raw==null)return {type:"choice",supported:false,raw:""};
  const text=String(raw).trim();
  let match=text.match(/^(-?\d+(?:\.\d+)?)$/);
  if(match)return {type:"number",supported:true,raw:text,value:Number(match[1]),unit:""};
  match=text.match(/^(-?\d+(?:\.\d+)?)\s*(个|元|角|分|米|厘米|毫米|千米|小时|分钟|秒|本|支|颗|辆|人|朵|只|张|块|盒|次|天|岁|倍|页|道|棵|面|组|排|圈|千克|克)$/);
  if(match)return {type:"number",supported:true,raw:text,value:Number(match[1]),unit:match[2]};
  match=text.match(/^(\d+)\s*组[，,、 ]*剩\s*(\d+)\s*(?:人|个)?$/);
  if(match)return {type:"compound",supported:true,raw:text,values:[Number(match[1]),Number(match[2])],labels:["组","剩"]};
  match=text.match(/^(\d+)\s*元\s*(\d+)\s*角$/);
  if(match)return {type:"compound",supported:true,raw:text,values:[Number(match[1]),Number(match[2])],labels:["元","角"]};
  match=text.match(/^(\d+)\s*时\s*(\d+)\s*分$/);
  if(match)return {type:"compound",supported:true,raw:text,values:[Number(match[1]),Number(match[2])],labels:["时","分"]};
  if(/^[><=＝]$/.test(text))return {type:"relation",supported:true,raw:text,value:text==="＝"?"=":text};
  if(/^[\d\s()+\-×÷=＝]+$/.test(text)&&/[+\-×÷=＝]/.test(text)){
    const value=normalizeExpression(text);
    return {
      type:"expression",
      supported:true,
      raw:text,
      value,
      comparison:acceptsReversedMultiplication(q,value)?"multiplication-factors":"exact"
    };
  }
  return {type:"choice",supported:false,raw:text};
}
export function normalizeExpression(value){
  return String(value||"")
    .replace(/[xX＊*]/g,"×")
    .replace(/[／/]/g,"÷")
    .replace(/＝/g,"=")
    .replace(/\s+/g,"");
}
function multiplicationParts(value){
  const text=normalizeExpression(value);
  const match=text.match(/^(-?\d+(?:\.\d+)?)×(-?\d+(?:\.\d+)?)(?:=(-?\d+(?:\.\d+)?))?$/);
  if(!match)return null;
  const first=Number(match[1]);
  const second=Number(match[2]);
  const product=first*second;
  const stated=match[3]==null?null:Number(match[3]);
  if(!Number.isFinite(first)||!Number.isFinite(second)||!Number.isFinite(product))return null;
  if(stated!=null&&(!Number.isFinite(stated)||Math.abs(stated-product)>1e-9))return null;
  return {factors:[first,second].sort((a,b)=>a-b),product};
}
function acceptsReversedMultiplication(q,value){
  if(!multiplicationParts(value))return false;
  const prompt=String(q?.prompt||"");
  const asksForResult=/算式/.test(prompt)&&/(?:得数|结果|积)(?:是|为|等于)?/.test(prompt);
  const asksForStructure=/(?:列|写|选择|表示|改写|根据|解决|需要).*算式|算式.*(?:正确|合适|符合|表示)|每(?:组|行|排|份|盒|个)|\d+个\d+/.test(prompt);
  return asksForResult&&!asksForStructure;
}
function sameMultiplicationFactors(expected,actual){
  const left=multiplicationParts(expected);
  const right=multiplicationParts(actual);
  if(!left||!right)return false;
  return Math.abs(left.factors[0]-right.factors[0])<=1e-9
    &&Math.abs(left.factors[1]-right.factors[1])<=1e-9
    &&Math.abs(left.product-right.product)<=1e-9;
}
export function compareAnswer(descriptor,entry){
  if(!descriptor?.supported)return false;
  if(descriptor.type==="number")return Number(entry.value)===descriptor.value;
  if(descriptor.type==="compound")return descriptor.values.every((value,index)=>Number(entry.values?.[index])===value);
  if(descriptor.type==="relation")return normalizeExpression(entry.value)===descriptor.value;
  if(descriptor.type==="expression"){
    const entered=normalizeExpression(entry.value);
    if(entered===descriptor.value)return true;
    if(descriptor.comparison==="multiplication-factors")return sameMultiplicationFactors(descriptor.value,entered);
    return false;
  }
  return false;
}

function mastery(stats){
  const attempts=Number(stats?.attempts||0);
  if(!attempts)return 0;
  const first=Number(stats.firstCorrect??stats.correct??0);
  const recovered=Number(stats.recovered||0);
  const hints=Number(stats.hints??stats.help??0);
  const transfer=Number(stats.stage?.transfer?.correct||0);
  const transferAttempts=Number(stats.stage?.transfer?.attempts||0);
  const accuracy=(first+recovered*.45)/attempts;
  const independence=Math.max(0,1-Math.min(1,hints/Math.max(1,attempts))*.25);
  const confidence=Math.min(1,attempts/10);
  const transferBonus=transferAttempts?Math.min(.08,transfer/transferAttempts*.08):0;
  return Math.max(0,Math.min(100,Math.round((accuracy*.68+independence*.14+confidence*.18+transferBonus)*100)));
}

export class LearningEngine{
  constructor(store){
    this.store=store;
    this.courseById=new Map(courses.map(course=>[course.id,course]));
    this.catalog=[];
    this.byQid=new Map();
    this.byCourse=new Map();
    this.bySkill=new Map();
    this.rawQuestionCount=0;
    this.invalidQuestionsRemoved=0;
    this.exactDuplicatesRemoved=0;
    this.qidCollisionsResolved=0;
    const signaturesByBaseQid=new Map();
    for(const course of courses){
      const rawQuestions=banks[course.set]||[];
      this.rawQuestionCount+=rawQuestions.length;
      const questions=[];
      for(let index=0;index<rawQuestions.length;index++){
        const q=sanitizeQuestion(rawQuestions[index],course,index);
        if(!q.prompt||!q.options.length||!Number.isInteger(q.answer)||q.answer<0||q.answer>=q.options.length){
          this.invalidQuestionsRemoved++;
          continue;
        }
        const baseQid=q.qid;
        const signature=questionSignature(q);
        if(!signaturesByBaseQid.has(baseQid))signaturesByBaseQid.set(baseQid,new Map());
        const known=signaturesByBaseQid.get(baseQid);
        if(known.has(signature)){
          this.exactDuplicatesRemoved++;
          continue;
        }
        if(known.size){
          let suffix=known.size+1;
          while(this.byQid.has(`${baseQid}~${suffix}`))suffix++;
          q.qid=`${baseQid}~${suffix}`;
          this.qidCollisionsResolved++;
        }
        known.set(signature,q.qid);
        questions.push(q);
        this.catalog.push(q);
        this.byQid.set(q.qid,q);
        if(!this.bySkill.has(q.skillId))this.bySkill.set(q.skillId,[]);
        this.bySkill.get(q.skillId).push(q);
      }
      this.byCourse.set(course.id,questions);
    }
  }

  getCourses(grade){
    return courses
      .filter(course=>Number(course.grade)===Number(grade))
      .sort((a,b)=>(skillMap[a.id]?.order||0)-(skillMap[b.id]?.order||0));
  }

  getCourse(courseId){
    return this.courseById.get(courseId)||null;
  }

  getQuestion(qid){
    return this.byQid.get(qid)||null;
  }

  skillMastery(skillId){
    return mastery(this.store.state.skillStats[skillId]);
  }

  courseMastery(courseId){
    const skills=[...this.bySkill.keys()].filter(id=>id.startsWith(courseId+"::"));
    const practiced=skills
      .map(id=>({id,stats:this.store.state.skillStats[id]}))
      .filter(item=>item.stats?.attempts);
    if(!practiced.length)return mastery(this.store.state.courseStats[courseId]);
    const attempts=practiced.reduce((sum,item)=>sum+Number(item.stats.attempts||0),0);
    return attempts?Math.round(practiced.reduce((sum,item)=>sum+mastery(item.stats)*Number(item.stats.attempts||0),0)/attempts):0;
  }

  overallMastery(){
    const practiced=Object.values(this.store.state.skillStats).filter(stats=>stats?.attempts);
    if(!practiced.length)return 0;
    const attempts=practiced.reduce((sum,stats)=>sum+Number(stats.attempts||0),0);
    return attempts?Math.round(practiced.reduce((sum,stats)=>sum+mastery(stats)*Number(stats.attempts||0),0)/attempts):0;
  }

  courseStatus(courseId){
    const score=this.courseMastery(courseId);
    const stats=this.store.state.courseStats[courseId]||{};
    if(!stats.attempts)return {level:"未开始",score,ready:this.prerequisitesMet(courseId)};
    if(score>=85&&Number(stats.transferCorrect||0)>=2)return {level:"已掌握",score,ready:true};
    if(score>=65)return {level:"巩固中",score,ready:true};
    return {level:"学习中",score,ready:true};
  }

  prerequisitesMet(courseId){
    const prerequisites=skillMap[courseId]?.prerequisites||[];
    return prerequisites.every(id=>this.courseMastery(id)>=55||this.store.state.completedCourses.includes(id));
  }

  stageCounts(total){
    const count=Math.max(8,Number(total||12));
    const guided=Math.max(2,Math.round(count*.25));
    const transfer=Math.max(2,Math.round(count*.25));
    const independent=Math.max(3,count-guided-transfer);
    return {teach:1,guided,independent,transfer};
  }

  candidateScore(q,stage){
    const qStats=this.store.state.questionStats[q.qid]||{};
    const skillStats=this.store.state.skillStats[q.skillId]||{};
    const attempts=Number(qStats.attempts||0);
    const accuracy=attempts?Number(qStats.firstCorrect||qStats.correct||0)/attempts:0;
    const skillScore=mastery(skillStats);
    const lastAt=Number(qStats.lastAt||0);
    const recent=lastAt&&Date.now()-lastAt<3*86400000;
    let score=Math.random()*12;
    if(!attempts)score+=22;
    else score+=(1-accuracy)*45+Number(qStats.wrong||0)*5;
    score+=(100-skillScore)*.3;
    if(recent)score-=35;
    if(this.store.state.mistakes.some(item=>item.skillId===q.skillId||item.template===q.template))score+=18;
    if(stage==="teach"){
      score+=(5-q.difficultyRank)*12;
      if(q.set==="g2_symbol"&&q.index===0)score+=1000;
    }else if(stage==="guided"){
      score+=(4-q.difficultyRank)*5;
    }else if(stage==="independent"){
      score+=q.difficultyRank===2||q.difficultyRank===3?12:0;
    }else if(stage==="transfer"){
      score+=q.difficultyRank*10;
      if(/应用|生活|综合|逆向|推理|挑战/.test(`${q.kind} ${q.prompt}`))score+=18;
    }
    return score;
  }

  pickDiverse(candidates,count,selected=[]){
    const result=[...selected];
    const ids=new Set(result.map(item=>item.qid));
    const prompts=new Set(result.map(item=>item.prompt));
    const templates=new Set(result.map(item=>item.template));
    for(const q of candidates){
      if(result.length>=count)break;
      if(ids.has(q.qid)||templates.has(q.template))continue;
      result.push(q);ids.add(q.qid);prompts.add(q.prompt);templates.add(q.template);
    }
    for(const q of candidates){
      if(result.length>=count)break;
      if(ids.has(q.qid)||prompts.has(q.prompt))continue;
      result.push(q);ids.add(q.qid);prompts.add(q.prompt);
    }
    for(const q of candidates){
      if(result.length>=count)break;
      if(ids.has(q.qid))continue;
      result.push(q);ids.add(q.qid);
    }
    return result;
  }

  pickForStage(courseId,stage,count,selected=[]){
    const all=this.byCourse.get(courseId)||[];
    const sorted=all
      .filter(q=>!selected.some(item=>item.qid===q.qid))
      .map(q=>({q,score:this.candidateScore(q,stage)}))
      .sort((a,b)=>b.score-a.score)
      .map(item=>item.q);
    const target=selected.length+count;
    return this.pickDiverse(sorted,target,selected);
  }

  buildLearningSession(courseId){
    const course=this.getCourse(courseId);
    if(!course)throw new Error("课程不存在");
    const counts=this.stageCounts(this.store.state.settings.roundSize);
    let selected=[];
    const items=[];
    for(const stage of ["teach","guided","independent","transfer"]){
      const before=selected.length;
      selected=this.pickForStage(courseId,stage,counts[stage],selected);
      selected.slice(before).forEach((question,index)=>items.push({
        id:`${stage}:${question.qid}:${index}`,
        stage,
        example:stage==="teach",
        question
      }));
    }
    return {id:`learning:${courseId}:${Date.now()}`,type:"learning",course,items,startedAt:Date.now()};
  }

  buildAdaptiveSession(courseId){
    const course=this.getCourse(courseId);
    if(!course)throw new Error("课程不存在");
    const count=this.store.state.settings.roundSize;
    const all=this.byCourse.get(courseId)||[];
    const sorted=all
      .map(q=>({q,score:this.candidateScore(q,"independent")+(this.isDue(q.qid)?45:0)}))
      .sort((a,b)=>b.score-a.score)
      .map(item=>item.q);
    const questions=this.pickDiverse(sorted,count);
    return {
      id:`adaptive:${courseId}:${Date.now()}`,
      type:"adaptive",
      course,
      items:questions.map((question,index)=>({id:`adaptive:${question.qid}:${index}`,stage:"independent",example:false,question})),
      startedAt:Date.now()
    };
  }

  buildRandomSession(courseId){
    const course=this.getCourse(courseId);
    if(!course)throw new Error("课程不存在");
    const questions=this.pickDiverse(shuffle(this.byCourse.get(courseId)||[]),this.store.state.settings.roundSize);
    return {
      id:`random:${courseId}:${Date.now()}`,
      type:"random",
      course,
      items:questions.map((question,index)=>({id:`random:${question.qid}:${index}`,stage:"independent",example:false,question})),
      startedAt:Date.now()
    };
  }

  buildDiagnostic(grade){
    const gradeCourses=this.getCourses(grade);
    const domains=new Map();
    for(const course of gradeCourses){
      const domain=skillMap[course.id]?.domain||"综合";
      if(!domains.has(domain))domains.set(domain,[]);
      domains.get(domain).push(course);
    }
    const chosen=[];
    const domainEntries=shuffle([...domains.entries()]);
    let domainIndex=0;
    while(chosen.length<15&&domainEntries.length){
      const [,domainCourses]=domainEntries[domainIndex%domainEntries.length];
      const course=domainCourses[chosen.length%domainCourses.length];
      const pool=(this.byCourse.get(course.id)||[]).filter(q=>!chosen.some(item=>item.qid===q.qid));
      const preferred=pool.filter(q=>q.difficultyRank===2||q.difficultyRank===3);
      const question=shuffle(preferred.length?preferred:pool)[0];
      if(question)chosen.push(question);
      domainIndex++;
      if(domainIndex>200)break;
    }
    const diagnosticCourse={id:`diagnostic_g${grade}`,grade,title:`${grade}年级能力诊断`,icon:"🩺",set:"diagnostic"};
    return {
      id:`diagnostic:${grade}:${Date.now()}`,
      type:"diagnostic",
      course:diagnosticCourse,
      items:chosen.map((question,index)=>({id:`diagnostic:${question.qid}:${index}`,stage:"diagnostic",example:false,question})),
      startedAt:Date.now()
    };
  }

  isDue(qid){
    const review=this.store.state.reviews[qid];
    return Boolean(review&&review.dueDate<=dayString());
  }

  dueReviews(){
    return Object.values(this.store.state.reviews)
      .filter(review=>review.dueDate<=dayString()&&this.byQid.has(review.qid))
      .sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate)));
  }

  buildReviewSession(){
    const due=this.dueReviews();
    const questions=[];
    for(const review of due){
      const original=this.byQid.get(review.qid);
      if(!original)continue;
      const variants=(this.bySkill.get(original.skillId)||[])
        .filter(q=>q.qid!==original.qid&&!questions.some(item=>item.qid===q.qid));
      questions.push(shuffle(variants)[0]||original);
      if(questions.length>=this.store.state.settings.roundSize)break;
    }
    if(questions.length<this.store.state.settings.roundSize){
      const weak=this.weakSkills(12).flatMap(item=>this.bySkill.get(item.id)||[]);
      const filled=this.pickDiverse(weak,this.store.state.settings.roundSize,questions);
      questions.splice(0,questions.length,...filled);
    }
    const reviewCourse={id:"review",grade:this.store.state.profile.grade,title:"今日间隔复习",icon:"🔁",set:"review"};
    return {
      id:`review:${Date.now()}`,
      type:"review",
      course:reviewCourse,
      items:questions.map((question,index)=>({id:`review:${question.qid}:${index}`,stage:"review",example:false,question})),
      startedAt:Date.now()
    };
  }

  weakSkills(limit=8){
    return Object.entries(this.store.state.skillStats)
      .filter(([,stats])=>stats?.attempts)
      .map(([id,stats])=>({
        id,
        name:id.split("::").slice(1).join("::"),
        courseId:id.split("::")[0],
        score:mastery(stats),
        attempts:Number(stats.attempts||0),
        errorReasons:stats.errorReasons||{}
      }))
      .sort((a,b)=>a.score-b.score||b.attempts-a.attempts)
      .slice(0,limit);
  }

  recommendedCourse(grade=this.store.state.profile.grade){
    const gradeCourses=this.getCourses(grade);
    const attempted=gradeCourses.filter(course=>this.store.state.courseStats[course.id]?.attempts);
    if(attempted.length){
      const weak=[...attempted].sort((a,b)=>this.courseMastery(a.id)-this.courseMastery(b.id))[0];
      if(this.courseMastery(weak.id)<75)return weak;
    }
    const ready=gradeCourses.filter(course=>this.prerequisitesMet(course.id)&&!this.store.state.completedCourses.includes(course.id));
    return ready[0]||gradeCourses[0]||courses[0];
  }

  dailyPlan(){
    const due=this.dueReviews().length;
    const recommended=this.recommendedCourse();
    const diagnosticPending=!this.store.state.diagnostic.completed||Number(this.store.state.diagnostic.grade)!==Number(this.store.state.profile.grade);
    return {
      diagnosticPending,
      due,
      recommended,
      weak:this.weakSkills(3),
      targetMinutes:15,
      completedMinutes:Number(this.store.state.daily.minutes||0)
    };
  }

  classifyError(q,entry){
    const text=`${q.kind||""} ${q.prompt||""}`;
    const descriptor=answerDescriptor(q);
    const enteredRaw=entry?.value??entry?.selectedValue;
    const correctRaw=q.options[q.answer];
    const enteredNumber=Number(enteredRaw);
    const correctNumber=Number(correctRaw);
    const explanation=normalizeExpression(q.explain||"");
    const equationAnswers=[...explanation.matchAll(/-?\d+(?:[+\-×÷]-?\d+)+=(-?\d+)/g)].map(match=>Number(match[1]));
    if(equationAnswers.length>=2&&Number.isFinite(enteredNumber)&&enteredNumber===equationAnswers[0]&&enteredNumber!==correctNumber)return "停在中间步骤";
    const remainderPrompt=String(q.prompt||"").match(/(\d+)÷(\d+)/);
    if(remainderPrompt&&Number.isFinite(enteredNumber)){
      const quotient=Math.floor(Number(remainderPrompt[1])/Number(remainderPrompt[2]));
      const remainder=Number(remainderPrompt[1])%Number(remainderPrompt[2]);
      if(enteredNumber!==correctNumber&&(enteredNumber===quotient||enteredNumber===remainder))return "商和余数混淆";
    }
    const simple=explanation.match(/(-?\d+)([+\-×÷])(-?\d+)=(-?\d+)/);
    if(simple&&Number.isFinite(enteredNumber)&&Number.isFinite(correctNumber)){
      const first=Number(simple[1]),operator=simple[2],second=Number(simple[3]);
      if(operator==="+"&&enteredNumber===Math.abs(first-second))return "把合并误看成求相差";
      if(operator==="-"&&enteredNumber===first+second)return "把去掉误看成合并";
      if(operator==="×"&&enteredNumber===first+second)return "把乘法只算成一次加法";
      if(operator==="÷"&&enteredNumber===first*second)return "乘除关系看反";
    }
    if(descriptor.type==="compound"||/单位|人民币|长度|时间|厘米|米|元|角/.test(text))return "单位与换算";
    if(/退位|不够减/.test(text))return "退位步骤";
    if(/进位/.test(text))return "进位步骤";
    if(/代换|天平|方程/.test(text))return "等量关系";
    if(/规律|周期|排序/.test(text))return "规律观察";
    if(/周长|图形|边长/.test(text))return "图形概念";
    if(/应用|一共|还剩|买|送|共有|每/.test(text))return "数量关系";
    if(Number.isFinite(correctNumber)&&Number.isFinite(enteredNumber)){
      if(Math.abs(correctNumber-enteredNumber)<=2)return "计算细节";
      if(Math.abs(correctNumber-enteredNumber)%10===0)return "数位计算";
    }
    return "概念或计算";
  }

  scheduleReview(q,quality){
    const current=this.store.state.reviews[q.qid]||{qid:q.qid,skillId:q.skillId,box:0,dueDate:dayString(),history:[]};
    let box=Number(current.box||0);
    if(quality>=5)box=Math.min(5,box+1);
    else if(quality===4)box=Math.min(5,Math.max(1,box+1));
    else if(quality===3)box=Math.min(1,box);
    else box=0;
    const intervals=config.reviewIntervals||[0,1,3,7,14,30];
    current.box=box;
    current.dueDate=dayString(Number(intervals[box]||0));
    current.lastQuality=quality;
    current.lastAt=Date.now();
    current.history=[...(current.history||[]),{date:Date.now(),quality,box}].slice(-12);
    this.store.state.reviews[q.qid]=current;
  }

  recordResult(item,result){
    if(item.example)return;
    const q=item.question;
    const elapsed=Math.max(0,Math.min(600000,Number(result.elapsedMs||0)));
    const firstCorrect=Boolean(result.firstCorrect);
    const recovered=Boolean(result.recovered);
    const wrong=!firstCorrect;
    const state=this.store.state;
    const courseStats=state.courseStats[q.courseId]||(state.courseStats[q.courseId]={attempts:0,firstCorrect:0,recovered:0,hints:0,totalMs:0,sessions:0,stage:{},errorReasons:{}});
    const skillStats=state.skillStats[q.skillId]||(state.skillStats[q.skillId]={attempts:0,firstCorrect:0,recovered:0,hints:0,totalMs:0,stage:{},errorReasons:{}});
    const questionStats=state.questionStats[q.qid]||(state.questionStats[q.qid]={attempts:0,firstCorrect:0,recovered:0,wrong:0,hints:0,totalMs:0,lastAt:0});
    for(const stats of [courseStats,skillStats,questionStats]){
      stats.attempts=Number(stats.attempts||0)+1;
      stats.firstCorrect=Number(stats.firstCorrect||stats.correct||0)+(firstCorrect?1:0);
      stats.recovered=Number(stats.recovered||0)+(recovered?1:0);
      stats.hints=Number(stats.hints||stats.help||0)+Number(result.hints||0);
      stats.totalMs=Number(stats.totalMs||0)+elapsed;
    }
    questionStats.wrong=Number(questionStats.wrong||0)+(wrong?1:0);
    questionStats.lastAt=Date.now();
    for(const stats of [courseStats,skillStats]){
      stats.stage=stats.stage||{};
      const stageStats=stats.stage[item.stage]||(stats.stage[item.stage]={attempts:0,correct:0,recovered:0});
      stageStats.attempts++;
      if(firstCorrect)stageStats.correct++;
      if(recovered)stageStats.recovered++;
    }
    if(item.stage==="transfer"&&firstCorrect)courseStats.transferCorrect=Number(courseStats.transferCorrect||0)+1;
    state.stats.attempts++;
    state.stats.firstCorrect+=firstCorrect?1:0;
    state.stats.recovered+=recovered?1:0;
    state.stats.hints+=Number(result.hints||0);
    state.stats.totalMs+=elapsed;
    state.daily.attempts++;
    state.daily.firstCorrect+=firstCorrect?1:0;
    state.daily.recovered+=recovered?1:0;
    state.daily.totalMs=Number(state.daily.totalMs||0)+elapsed;
    state.daily.minutes=Math.round(state.daily.totalMs/60000);
    if(wrong){
      const reason=this.classifyError(q,result.entry);
      courseStats.errorReasons=courseStats.errorReasons||{};
      skillStats.errorReasons=skillStats.errorReasons||{};
      courseStats.errorReasons[reason]=Number(courseStats.errorReasons[reason]||0)+1;
      skillStats.errorReasons[reason]=Number(skillStats.errorReasons[reason]||0)+1;
      const mistake={
        key:q.qid,
        qid:q.qid,
        courseId:q.courseId,
        course:q.courseTitle,
        prompt:q.prompt,
        correct:q.options[q.answer],
        kind:q.kindName,
        skillId:q.skillId,
        template:q.template,
        reason,
        explain:q.explain||"",
        wrongAt:Date.now()
      };
      state.mistakes=[mistake,...state.mistakes.filter(item=>item.qid!==q.qid)].slice(0,100);
    }
    if(result.masteredMistake)state.mistakes=state.mistakes.filter(mistake=>mistake.qid!==result.masteredMistake);
    const quality=firstCorrect?(Number(result.hints||0)?4:5):recovered?3:1;
    this.scheduleReview(q,quality);
    this.store.save();
    return {skillMastery:this.skillMastery(q.skillId),courseMastery:this.courseMastery(q.courseId),quality};
  }

  completeSession(session,summary){
    const state=this.store.state;
    const courseId=session.course.id;
    if(this.courseById.has(courseId)){
      const stats=state.courseStats[courseId]||(state.courseStats[courseId]={attempts:0,firstCorrect:0,recovered:0,sessions:0});
      stats.sessions=Number(stats.sessions||0)+1;
      stats.lastAt=Date.now();
      stats.lastScore=summary.score;
      stats.best=Math.max(Number(stats.best||0),summary.score);
      if(this.courseMastery(courseId)>=85&&!state.completedCourses.includes(courseId))state.completedCourses.push(courseId);
    }
    state.stats.completedSessions++;
    state.stats.stars+=5;
    state.daily.sessions++;
    state.sessions.unshift({
      date:Date.now(),
      courseId,
      course:session.course.title,
      mode:session.type,
      score:summary.score,
      firstCorrect:summary.firstCorrect,
      recovered:summary.recovered,
      total:summary.total,
      minutes:summary.minutes,
      mastery:this.courseById.has(courseId)?this.courseMastery(courseId):0
    });
    state.sessions=state.sessions.slice(0,80);
    if(session.type==="diagnostic"){
      const skillResults={};
      for(const result of summary.results||[]){
        const skillId=result.skillId;
        if(!skillResults[skillId])skillResults[skillId]={attempts:0,correct:0};
        skillResults[skillId].attempts++;
        if(result.firstCorrect)skillResults[skillId].correct++;
      }
      state.diagnostic={completed:true,grade:state.profile.grade,date:Date.now(),score:summary.score,skills:skillResults};
    }
    this.store.save();
  }

  trend(days=7){
    const rows=[];
    for(let offset=days-1;offset>=0;offset--){
      const day=dayString(-offset);
      const sessions=this.store.state.sessions.filter(item=>{
        const date=new Date(item.date);
        const value=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
        return value===day;
      });
      const total=sessions.reduce((sum,item)=>sum+Number(item.total||0),0);
      const correct=sessions.reduce((sum,item)=>sum+Number(item.firstCorrect||0),0);
      rows.push({day,label:day.slice(5).replace("-","/"),questions:total,accuracy:total?Math.round(correct/total*100):0,minutes:sessions.reduce((sum,item)=>sum+Number(item.minutes||0),0)});
    }
    return rows;
  }

  errorReasons(){
    const totals={};
    for(const stats of Object.values(this.store.state.skillStats)){
      for(const [reason,count] of Object.entries(stats?.errorReasons||{}))totals[reason]=Number(totals[reason]||0)+Number(count||0);
    }
    return Object.entries(totals).map(([reason,count])=>({reason,count})).sort((a,b)=>b.count-a.count);
  }

  bankStats(){
    const uniquePrompts=new Set(this.catalog.map(q=>q.prompt));
    const templates=new Set(this.catalog.map(q=>q.template));
    const skills=new Set(this.catalog.map(q=>q.skillId));
    const fillable=this.catalog.filter(q=>answerDescriptor(q).supported).length;
    const repairBreakdown={};
    let semanticRepairs=0;
    let repairedQuestions=0;
    for(const q of this.catalog){
      if(q.qualityRepairs?.length)repairedQuestions++;
      for(const label of q.qualityRepairs||[]){
        semanticRepairs++;
        repairBreakdown[label]=Number(repairBreakdown[label]||0)+1;
      }
    }
    return {
      courses:courses.length,
      sets:Object.keys(banks).length,
      rawQuestions:this.rawQuestionCount,
      questions:this.catalog.length,
      exactDuplicatesRemoved:this.exactDuplicatesRemoved,
      invalidQuestionsRemoved:this.invalidQuestionsRemoved,
      qidCollisionsResolved:this.qidCollisionsResolved,
      uniquePrompts:uniquePrompts.size,
      templates:templates.size,
      skills:skills.size,
      fillable,
      repairedQuestions,
      semanticRepairs,
      repairBreakdown
    };
  }

  catalogAudit(){
    let invalidQuestions=0;
    let duplicateOptions=0;
    let negativeAnswers=0;
    let languageIssues=0;
    let multiplicationExpressionQuestions=0;
    for(const q of this.catalog){
      if(!q.prompt||!q.options.length||!Number.isInteger(q.answer)||q.answer<0||q.answer>=q.options.length)invalidQuestions++;
      if(new Set(q.options).size!==q.options.length)duplicateOptions++;
      const descriptor=answerDescriptor(q);
      if(descriptor.type==="number"&&descriptor.value<0)negativeAnswers++;
      if(descriptor.type==="expression"&&descriptor.comparison==="multiplication-factors")multiplicationExpressionQuestions++;
      const prompt=String(q.prompt||"");
      const allText=`${prompt}\n${q.explain||""}\n${q.options.join("\n")}`;
      if(/俊俊|盒乘客|名(?:车厢|实验组|篮子|小队)(?:乘车|，每人)|用掉\d+名乘客|补充\d+名乘客|请先说数量是变多还是变少|如果第一筐多1个，第二筐仍是/.test(allText)
        ||hasStoryCounterMismatch(prompt)||hasApplicationLanguageIssue(q))languageIssues++;
    }
    return {
      rawQuestions:this.rawQuestionCount,
      activeQuestions:this.catalog.length,
      qidCount:this.byQid.size,
      qidsUnique:this.byQid.size===this.catalog.length,
      exactDuplicatesRemoved:this.exactDuplicatesRemoved,
      qidCollisionsResolved:this.qidCollisionsResolved,
      invalidQuestions,
      duplicateOptions,
      negativeAnswers,
      languageIssues,
      multiplicationExpressionQuestions
    };
  }
}

export {normalizeKind,templateOf,mastery,dayString,repairQuestion};
