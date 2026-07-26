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
function sanitizeQuestion(source,course,index){
  const options=Array.isArray(source.options)?source.options.map(String):[];
  const answer=Number(source.answer);
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
  const q={...source,options,answer};
  q.courseId=course.id;
  q.courseTitle=course.title;
  q.set=course.set;
  q.index=index;
  q.kindName=normalizeKind(q.kind);
  q.skillId=`${course.id}::${q.kindName}`;
  q.template=templateOf(q.prompt);
  q.qid=`${course.id}:${hashText(`${q.prompt}::${options.join("|")}`)}`;
  q.difficultyRank=difficultyRank(q.difficulty);
  return q;
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
    return {type:"expression",supported:true,raw:text,value:normalizeExpression(text)};
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
export function compareAnswer(descriptor,entry){
  if(!descriptor?.supported)return false;
  if(descriptor.type==="number")return Number(entry.value)===descriptor.value;
  if(descriptor.type==="compound")return descriptor.values.every((value,index)=>Number(entry.values?.[index])===value);
  if(descriptor.type==="relation")return normalizeExpression(entry.value)===descriptor.value;
  if(descriptor.type==="expression")return normalizeExpression(entry.value)===descriptor.value;
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
    for(const course of courses){
      const questions=(banks[course.set]||[])
        .map((q,index)=>sanitizeQuestion(q,course,index))
        .filter(q=>q.prompt&&q.options.length&&Number.isInteger(q.answer)&&q.answer>=0&&q.answer<q.options.length);
      this.byCourse.set(course.id,questions);
      for(const q of questions){
        this.catalog.push(q);
        this.byQid.set(q.qid,q);
        if(!this.bySkill.has(q.skillId))this.bySkill.set(q.skillId,[]);
        this.bySkill.get(q.skillId).push(q);
      }
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
    if(descriptor.type==="compound"||/单位|人民币|长度|时间|厘米|米|元|角/.test(text))return "单位与换算";
    if(/退位|不够减/.test(text))return "退位步骤";
    if(/进位/.test(text))return "进位步骤";
    if(/代换|天平|方程/.test(text))return "等量关系";
    if(/规律|周期|排序/.test(text))return "规律观察";
    if(/周长|图形|边长/.test(text))return "图形概念";
    if(/应用|一共|还剩|买|送|共有|每/.test(text))return "数量关系";
    const correctNumber=Number(q.options[q.answer]);
    const enteredNumber=Number(entry?.value??entry?.selectedValue);
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
    return {
      courses:courses.length,
      sets:Object.keys(banks).length,
      questions:this.catalog.length,
      uniquePrompts:uniquePrompts.size,
      templates:templates.size,
      skills:skills.size,
      fillable
    };
  }
}

export {normalizeKind,templateOf,mastery,dayString};
