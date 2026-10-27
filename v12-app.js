import {screenKeyboardHTML,mountScreenKeyboard} from './v12-screen-keyboard.js?v=120170';
import {mountVertical} from './v12-vertical-view.js?v=120170';
import {restoreVerticalRound,verticalSummary} from './v12-vertical.js?v=120170';
import {equationPlan,checkEquationPlan} from './v12-equation.js?v=120170';
import {V12Store,today} from "./v12-store.js?v=120170";
import {LearningEngine,answerDescriptor,compareAnswer,normalizeExpression} from "./v12-engine.js?v=120170";
import {buildTutor,escapeHTML} from "./v12-tutor.js?v=120170";

import {independentSummary,REFLECTIONS,reflectionSummary} from "./v12-progress.js?v=120170";
import {createExploration,checkExploration} from "./v12-explore.js?v=120170";

import {verificationLabel} from "./v12-verification.js?v=120170";
import {createOpenChallenge,checkOpenChallenge} from "./v12-open.js?v=120170";
import {mountLab} from "./v12-lab-view.js?v=120170";
import {initOffline} from "./v12-offline.js?v=120170";

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const cfg=window.MATH_V12_CONFIG||{};
const store=new V12Store();
const engine=new LearningEngine(store);

let session=null;
let activeLabDispose=null;
let itemIndex=0;
let sessionResults=[];
let currentMode="choice";
let currentDescriptor=null;
let currentEquationPlan=null;
let equationKeyboard=null;
let typed="";
let parts=["",""];
let activePart=0;
let questionStartedAt=0;
let firstAttemptDone=false;
let retrying=false;
let finalized=false;
let selectedWrong=new Set();
let hints=0;
let hintLevel=0;
let firstWrongEntry=null;
let checkpointPassed=false;
let mandarinVoice=null;
let voicesReady=false;

const audio={
  click:new Audio("./click.wav"),
  correct:new Audio("./correct.wav"),
  wrong:new Audio("./wrong.wav"),
  finish:new Audio("./finish.wav")
};

function play(name){
  if(!store.state.settings.sound)return;
  try{
    audio[name].currentTime=0;
    const result=audio[name].play();
    if(result?.catch)result.catch(()=>{});
  }catch{}
}
function updateVoiceStatus(message){
  $("#voiceStatus").textContent=message||"严格只使用普通话；没有普通话系统语音时不会改用广东话。";
}
function loadVoices(){
  const voices=(window.speechSynthesis&&speechSynthesis.getVoices())||[];
  const exact=voices.filter(voice=>/^(zh-CN|cmn-CN)(-|$)/i.test(String(voice.lang||"")));
  const mainland=voices.filter(voice=>/^zh(?:-|_)CN$/i.test(String(voice.lang||"")));
  mandarinVoice=exact[0]||mainland[0]||null;
  voicesReady=true;
  if(mandarinVoice)updateVoiceStatus(`普通话语音已就绪：${mandarinVoice.name}（${mandarinVoice.lang}）`);
  else updateVoiceStatus("本机没有可用的普通话网页语音；已停止朗读，不会播放广东话。");
}
function speak(text,onDone){
  if(!store.state.settings.sound){onDone?.();return}
  const value=String(text||"").trim();
  if(!value){onDone?.();return}
  if(!window.speechSynthesis){updateVoiceStatus("此浏览器不支持普通话朗读；不会改用广东话。");onDone?.();return}
  if(!voicesReady)loadVoices();
  if(!mandarinVoice){updateVoiceStatus("没有找到普通话系统语音，本次不朗读。");onDone?.();return}
  speechSynthesis.cancel();
  const utterance=new SpeechSynthesisUtterance(value);
  utterance.lang="zh-CN";
  utterance.voice=mandarinVoice;
  utterance.rate=cfg.speechRate||.88;
  utterance.pitch=cfg.speechPitch||1;
  utterance.onstart=()=>updateVoiceStatus(`正在使用普通话：${mandarinVoice.name}`);
  utterance.onend=()=>{updateVoiceStatus();onDone?.()};
  utterance.onerror=()=>{updateVoiceStatus("普通话朗读失败；已停止，不会改用广东话。");onDone?.()};
  speechSynthesis.speak(utterance);
}

function navigate(panel){
  $$(".nav-button").forEach(button=>button.classList.toggle("active",button.dataset.panel===panel));
  $$(".panel").forEach(element=>element.classList.toggle("active",element.id===panel));
  document.body.classList.toggle("focus-mode-active",panel==="game"&&store.state.settings.focusMode&&session);
  if(panel==="report")renderReport();
  if(panel==="plan")renderPlan();
}
function openModal(icon,title,content){
  activeLabDispose?.();activeLabDispose=null;
  $("#modalIcon").textContent=icon;
  $("#modalTitle").textContent=title;
  $("#modalContent").innerHTML=content;
  $("#modal").classList.remove("hidden");
  document.body.classList.add("modal-open");
}
function closeModal(){
  activeLabDispose?.();activeLabDispose=null;
  $("#modal").classList.add("hidden");
  document.body.classList.remove("modal-open");
}
function celebrate(count=18){
  const box=$("#celebration");
  const icons=["⭐","🎉","✨","🎈","🏅"];
  for(let i=0;i<count;i++){
    const element=document.createElement("span");
    element.className="confetti";
    element.textContent=icons[i%icons.length];
    element.style.left=Math.random()*100+"%";
    element.style.animationDelay=Math.random()*.35+"s";
    box.appendChild(element);
    setTimeout(()=>element.remove(),1900);
  }
}

function header(){
  const state=store.state;
  const accuracy=state.stats.attempts?Math.round(state.stats.firstCorrect/state.stats.attempts*100):0;
  const mastery=engine.overallMastery();
  $("#version").textContent=cfg.version;
  $("#statStars").textContent=state.stats.stars;
  $("#statAccuracy").textContent=state.stats.attempts?accuracy+"%":"—";
  $("#statMastery").textContent=state.stats.attempts?mastery+"%":"—";
  $("#statDue").textContent=engine.dueReviews().length;
  $("#profileLevel").textContent=mastery>=85?"数学小导师":mastery>=65?"数学闯关者":state.stats.attempts?"数学探索者":"数学新星";
}

function renderHome(){
  const state=store.state;
  const grade=state.profile.grade;
  $("#labResumeNote").textContent=state.manipulativeDraft?"已保留上次操作，打开即可继续。":"不限时，可撤回，操作自动保留。";
  const plan=engine.dailyPlan();
  const recommended=plan.recommended;
  $$(".grade-switch button").forEach(button=>button.classList.toggle("active",Number(button.dataset.grade)===Number(grade)));
  $("#gradeEyebrow").textContent=grade===1?"一年级复习":"二年级主课程";
  if(plan.diagnosticPending){
    $("#smartPlanTitle").textContent=`先完成${grade}年级能力诊断`;
    $("#smartPlanText").textContent="15道题找出真正会的、似懂非懂的和需要补的知识点。";
  }else if(plan.due){
    $("#smartPlanTitle").textContent=`今天有 ${plan.due} 个知识点到期复习`;
    $("#smartPlanText").textContent="先复习快要忘记的内容，再进入新的课程。";
  }else if(recommended){
    $("#smartPlanTitle").textContent=`今天建议：${recommended.title}`;
    $("#smartPlanText").textContent=window.MATH_V12_SKILL_MAP?.[recommended.id]?.goal||recommended.desc;
  }
  const diagnosticDone=!plan.diagnosticPending;
  $("#diagnosticCard").classList.toggle("done",diagnosticDone);
  $("#diagnosticCopy").textContent=diagnosticDone?`上次诊断：${new Date(state.diagnostic.date).toLocaleDateString("zh-CN")} · ${state.diagnostic.score}分`:"先找到真正会的和需要补的，后面才会出得准。";
  $("#diagnosticStart").textContent=diagnosticDone?"重新诊断":"开始诊断";

  const gradeCourses=engine.getCourses(grade);
  $("#courseSummary").textContent=`${gradeCourses.length}个课程 · 按知识前后关系排列`;
  $("#courseGrid").innerHTML=gradeCourses.map(course=>{
    const status=engine.courseStatus(course.id);
    const map=window.MATH_V12_SKILL_MAP?.[course.id]||{};
    const route=engine.learningRoute(course.id);
    const locked=!status.ready;
    const levelClass=status.level==="已掌握"?"mastered":"";
    return `<button class="course-card ${locked?"locked":""}" data-course="${course.id}">
      <div class="course-top"><span class="course-icon">${course.icon}</span><span class="course-level ${levelClass}">${locked?"建议先学前置课":status.level}</span></div>
      <h3>${escapeHTML(course.title)}</h3>
      <p>${escapeHTML(map.goal||course.desc)}</p>
      ${route.secure?`<small class="route-note">${route.secure}/${route.skills}个题型近期独立掌握，减少重复练习</small>`:""}
      <div class="mastery-line"><span>课程进展 ${status.score}% · 已练${engine.courseCoverage(course.id).practiced}/${engine.courseCoverage(course.id).total}类</span><div class="mastery-track"><i style="width:${status.score}%"></i></div></div>
      <div class="course-go"><span>${escapeHTML(map.domain||"综合数学")}</span><b>${status.level==="未开始"?"开始学习":"继续学习"} →</b></div>
    </button>`;
  }).join("");
  $$(".course-card").forEach(button=>button.onclick=()=>showCourseChoice(button.dataset.course));
  const stats=engine.bankStats();
  $("#bankSummary").textContent=`Build017题库审计：${stats.courses}个课程 · ${stats.rawQuestions.toLocaleString()}道原题 · 去除${stats.exactDuplicatesRemoved.toLocaleString()}道完全重复题 · ${stats.questions.toLocaleString()}道有效题 · ${stats.templates}种结构 · ${stats.fillable.toLocaleString()}道可防猜 · ${stats.repairedQuestions.toLocaleString()}道旧题语义已校正`;
}

function showCourseChoice(courseId){
  const course=engine.getCourse(courseId);
  const status=engine.courseStatus(courseId);
  const prerequisites=window.MATH_V12_SKILL_MAP?.[courseId]?.prerequisites||[];
  const prerequisiteText=prerequisites.map(id=>engine.getCourse(id)?.title).filter(Boolean).join("、");
  openModal(course.icon,course.title,`
    <div class="course-choice">
      <p>${escapeHTML(window.MATH_V12_SKILL_MAP?.[course.id]?.goal||course.desc)}</p>
      ${!status.ready?`<div class="course-warning">建议先完成：${escapeHTML(prerequisiteText)}。仍可提前体验本课程。</div>`:""}
      <button class="claim-button" data-course-mode="learning">四阶段学习：讲解 → 引导 → 独立 → 迁移</button>
      <div class="mode-grid">
        <button data-course-mode="adaptive">🧠 智能强化<br><small>集中练薄弱点</small></button>
        <button data-course-mode="random">🎲 随机练习<br><small>自由抽题</small></button>
      </div>
      <small>当前掌握度 ${status.score}% · ${status.level}</small>
    </div>`);
  $$("[data-course-mode]").forEach(button=>button.onclick=()=>{closeModal();startCourse(courseId,button.dataset.courseMode)});
}

function renderPlan(){
  const plan=engine.dailyPlan();
  const progress=Math.min(100,Math.round(Number(store.state.daily.minutes||0)/plan.targetMinutes*100));
  $("#dailyProgress").innerHTML=`<div class="daily-progress-head"><b>今日专注学习</b><span>${store.state.daily.minutes||0}/${plan.targetMinutes}分钟</span></div><div class="daily-progress-track"><i style="width:${progress}%"></i></div>`;
  $("#dueCopy").textContent=plan.due?`${plan.due}个知识点已到复习时间`:"今天没有到期内容，可做智能巩固";
  $("#reviewStart").textContent=plan.due?"复习":"智能练";
  $("#weakCopy").textContent=plan.weak.length?plan.weak.map(item=>item.name).slice(0,2).join("、"):"完成诊断或练习后自动生成";
  const claimed=store.state.rewards.lastDate===today();
  $("#rewardCopy").textContent=claimed?`今天已领取 · 连续${store.state.rewards.streak}天`:`连续学习${store.state.rewards.streak}天`;
  $("#rewardBtn").textContent=claimed?"看成就":"领取";
  const reasons=[];
  if(plan.diagnosticPending)reasons.push(["🩺","还没有本年级诊断结果，先诊断才能准确安排。"]);
  if(plan.due)reasons.push(["🔁",`${plan.due}个知识点到期，先复习能减少遗忘。`]);
  if(plan.weak.length)reasons.push(["🧩",`目前最需要巩固：${plan.weak.map(item=>item.name).join("、")}。`]);
  if(plan.recommended)reasons.push(["🚀",`新学习建议：${plan.recommended.title}。`]);
  $("#planReason").innerHTML=(reasons.length?reasons:[["🌱","先完成几道题，V12会逐步了解峻峻。"]]).map(([icon,text])=>`<div class="reason-row"><span>${icon}</span><p>${escapeHTML(text)}</p></div>`).join("");
}

function renderReport(){
  const state=store.state;
  $("#restoreImport").classList.toggle("hidden",!store.hasImportBackup());
  $("#exportRecovery").classList.toggle("hidden",!store.recoveryRaw);
  const accuracy=state.stats.attempts?Math.round(state.stats.firstCorrect/state.stats.attempts*100):0;
  const independent=independentSummary(state);
  $("#reportStats").innerHTML=[
    ["答题",state.stats.attempts],
    ["首次正确",state.stats.attempts?accuracy+"%":"—"],
    ["自主纠错",state.stats.recovered],
    ["无提示独立答对",independent.rate===null?"—":independent.rate+"%"],
    ["本年级进展",state.stats.attempts?engine.overallMastery()+"%":"—"],
    ["待复习",engine.dueReviews().length],
    ["学习场次",state.stats.completedSessions],
    ["累计星星",state.stats.stars]
  ].map(([label,value])=>`<div class="report-stat"><b>${value}</b><small>${label}</small></div>`).join("");

  const trend=engine.trend(7);
  const maxQuestions=Math.max(1,...trend.map(day=>day.questions));
  $("#trendChart").innerHTML=trend.map(day=>`<div class="trend-day"><div class="trend-bars"><i style="height:${Math.max(3,day.questions/maxQuestions*100)}%"></i><i class="accuracy" style="height:${Math.max(3,day.accuracy)}%"></i></div><b>${day.label}</b><small>${day.questions}题/${day.accuracy}%</small></div>`).join("");

  const weak=engine.weakSkills(12);
  $("#masteryList").innerHTML=weak.length?weak.map(item=>`<div class="mastery-row"><b>${escapeHTML(item.name)}</b><div class="mastery-bar"><i style="width:${item.score}%"></i></div><span>${item.score}%</span></div>`).join(""):"完成诊断和练习后，这里会按知识点显示真正的掌握程度。";
  $("#independentNote").textContent=`独立指标从Build010起记录：${independent.correct}/${independent.total}题无提示首次答对；讲解、引导题不计入。旧版记录继续保留。`;
  const reflections=reflectionSummary(state);
  $("#parentAdvice").innerHTML=reflections.length?reflections.map(row=>`<div class="parent-advice"><b>${escapeHTML(row.label)} · ${row.count}次</b><p>${escapeHTML(row.advice)}</p></div>`).join(""):"答错后可请峻峻自选卡点；这里会据此给出陪学建议，不把系统猜测当作事实。";
  const creations=state.explorations||[];
  $("#explorationReport").innerHTML=creations.length?creations.slice(0,5).map(row=>`<div class="parent-advice"><b>${escapeHTML(row.title)} · ${row.correct?"已解出":"继续探索"}</b><p>${escapeHTML(row.prompt)}</p><small>峻峻的想法：${escapeHTML(row.note||"未记录口述或文字想法")}</small></div>`).join(""):"还没有探索记录。可以从首页的数学探索工坊开始，不限时、不计正确率。";
  const tasks=state.verificationTasks||[];
  const pending=tasks.filter(row=>row.status!=="passed");
  $("#verificationReport").innerHTML=tasks.length?tasks.slice(0,12).map(row=>`<div class="parent-advice"><b>${escapeHTML(verificationLabel(row.status))}</b><p>${escapeHTML(row.prompt)}</p></div>`).join(""):"纠错后会安排数字不同、结构相同的变式；无提示首次答对才记录本次独立通过。";
  $("#verificationStart").textContent=pending.length?`继续独立验证（${pending.length}项待验证）`:"暂无待验证内容";
  $("#verificationStart").disabled=!pending.length;
  const coaching=state.coachingRecords||[];
  $("#coachingReport").innerHTML=coaching.length?coaching.slice(0,5).map(row=>`<div class="parent-advice"><b>${escapeHTML(REFLECTIONS[row.reason]?.label||"思路记录")}</b><p>${escapeHTML(row.note)}</p><small>文字由孩子或家长记录，系统不自动判定思路正确。</small></div>`).join(""):"选择卡点后可以记录条件、所问、计算检查或图示想法。";
  const reasons=engine.errorReasons();
  const hands=state.manipulativeRecords||[];
  const vertical=store.state.verticalRecords.map(restoreVerticalRound).filter(Boolean);
  $("#verticalReport").innerHTML=vertical.length?vertical.slice(0,8).map(round=>{
    const summary=verticalSummary(round);
    return `<div class="parent-advice"><b>竖式测试 · ${round.digits}位数 · ${summary.correct}/${summary.total}题全对</b><p>未用提示全对 ${summary.independent}/${summary.total}题；加减检查进退位，乘除检查计算步骤。</p><small>${escapeHTML(round.questions.map(q=>`${q.a}${q.op}${q.b}`).join("；"))}</small></div>`;
  }).join(""):"还没有完成的竖式测试，可从首页开始每组5题。";
  $("#manipulativeReport").innerHTML=hands.length?hands.slice(0,8).map(row=>`<div class="parent-advice"><b>${escapeHTML(row.title)} · ${row.completed?"本次图示练习完成":"正在探索"}</b><p>${escapeHTML(row.prompt||"")}</p><p>${Number(row.moves)||0}次操作 · ${Number(row.undoCount)||0}次撤回 · ${row.hintUsed?"使用过提示":"未使用提示按钮"}</p><small>想法：${escapeHTML(row.note||"未记录")}</small><details><summary>最近操作</summary><ol>${(Array.isArray(row.events)?row.events:[]).slice(-6).map(event=>`<li>${escapeHTML(event?.text||"")}</li>`).join("")}</ol></details></div>`).join(""):"还没有图示操作记录。可以从首页打开数学实验台，探索逐层代换与等式天平。";
  $("#errorReasons").innerHTML=reasons.length?reasons.slice(0,10).map(item=>`<span class="error-chip">${escapeHTML(item.reason)}<b>${item.count}</b></span>`).join(""):"暂时没有可分析的错因。";
  $("#mistakeList").innerHTML=state.mistakes.length?state.mistakes.slice(0,12).map(item=>{
    const review=state.reviews[item.qid];
    return `<div class="mistake-item"><b>${escapeHTML(item.course)}</b><span>系统推测：${escapeHTML(item.reason||"待分析")}${item.reflection?` · 孩子自述：${escapeHTML(REFLECTIONS[item.reflection]?.label||"")}`:""}</span><p>${escapeHTML(item.prompt||item.q)}</p><small>正确答案：${escapeHTML(item.correct||item.a)} · ${review?`复习日 ${review.dueDate}`:"已加入复习"}</small></div>`;
  }).join(""):"🎉 暂时没有错题。";
}

function startCourse(courseId,mode){
  if(mode==="learning")session=engine.buildLearningSession(courseId);
  else if(mode==="random")session=engine.buildRandomSession(courseId);
  else session=engine.buildAdaptiveSession(courseId);
  beginSession();
}
function startDiagnostic(){
  session=engine.buildDiagnostic(store.state.profile.grade);
  beginSession();
}
function startReview(){
  session=engine.buildReviewSession();
  if(!session.items.length){
    const recommended=engine.recommendedCourse();
    if(recommended)session=engine.buildAdaptiveSession(recommended.id);
  }
  beginSession();
}
function smartStart(){
  const plan=engine.dailyPlan();
  if(plan.diagnosticPending){startDiagnostic();return}
  if(plan.due){startReview();return}
  if(!plan.recommended)return;
  const mode=store.state.settings.practiceMode;
  if(mode==="review"){startReview();return}
  startCourse(plan.recommended.id,mode);
}
function beginSession(){
  if(!session||!session.items.length){alert("暂时没有可练习的题目");return}
  itemIndex=0;
  sessionResults=[];
  $("#emptyGame").classList.add("hidden");
  $("#gameCard").classList.remove("hidden");
  navigate("game");
  showItem();
}

function stageMeta(stage){
  const map={
    teach:["👀","讲解"],
    guided:["🧑‍🏫","引导"],
    independent:["✍️","独立"],
    transfer:["🚀","迁移"],
    diagnostic:["🩺","诊断"],
    review:["🔁","复习"],
    verification:["🔎","独立验证"]
  };
  return map[stage]||["🎯","练习"];
}
function renderStageRail(currentStage){
  if(session.type!=="learning"||currentStage==="verification"){
    const [icon,name]=stageMeta(currentStage);
    $("#stageRail").innerHTML=`<div class="stage-step active"><span>${icon}</span>${name}</div>`;
    $("#stageRail").style.gridTemplateColumns="1fr";
    return;
  }
  $("#stageRail").style.gridTemplateColumns="";
  const stages=cfg.stagePlan||[];
  const order=stages.map(stage=>stage.id);
  const current=order.indexOf(currentStage);
  $("#stageRail").innerHTML=stages.map((stage,index)=>`<div class="stage-step ${index===current?"active":index<current?"done":""}"><span>${stage.icon}</span>${stage.name}</div>`).join("");
}

function showItem(){
  equationKeyboard?.destroy();equationKeyboard=null;
  if(itemIndex>=session.items.length){finishSession();return}
  const item=session.items[itemIndex];
  const q=item.question;
  firstAttemptDone=false;
  retrying=false;
  finalized=false;
  selectedWrong=new Set();
  hints=0;
  hintLevel=0;
  firstWrongEntry=null;
  checkpointPassed=false;
  typed="";
  parts=["",""];
  activePart=0;
  currentDescriptor=answerDescriptor(q);
  currentEquationPlan=store.state.settings.equationPractice?equationPlan(q):null;
  currentMode=chooseAnswerMode(item);
  $("#sessionType").textContent=session.type==="learning"?(session.route?.compact?"已掌握，直接迁移挑战":"四阶段学习"):session.type==="diagnostic"?"能力诊断":session.type==="review"?"间隔复习":session.type==="random"?"随机练习":"智能强化";
  $("#gameTitle").textContent=`${session.course.icon} ${session.course.title}`;
  $("#questionCount").textContent=`${itemIndex+1}/${session.items.length}`;
  $("#gameProgress").style.width=itemIndex/session.items.length*100+"%";
  renderStageRail(item.stage);
  $("#questionSkill").textContent=`${q.kind||q.kindName} · ${stageMeta(item.stage)[1]}阶段`;
  $("#questionText").textContent=q.prompt;
  $("#feedback").textContent=item.stage==="verification"?"这是一道换了数字的同类题。先独立填写；如果需要提示，也可以使用，记录会如实区分。":item.example?"先看懂这道例题的完整过程，不需要作答。":item.stage==="guided"?"跟着步骤做，先理解再计算。":"认真读题，尽量独立完成。";
  $("#nextQuestion").classList.add("hidden");
  $("#nextQuestion").textContent=item.example?"我懂了，开始练习 ➜":"下一题 ➜";
  $("#checkpointCard").classList.add("hidden");
  $("#tutorPanel").classList.add("hidden");
  $("#answerArea").innerHTML="";
  const lesson=buildTutor(q,{stage:item.stage,reveal:item.example,hintLevel:0});
  if(item.example){
    renderTutor(lesson,"这是讲解例题，重点看方法");
    $("#answerArea").innerHTML='<div class="example-note">👀 这题不计分。看懂步骤后再进入引导练习。</div>';
    $("#nextQuestion").classList.remove("hidden");
  }else{
    if(item.stage==="guided"){
      renderTutor(lesson,"引导阶段会给方法，但不直接公布答案");
      if(lesson.checkpoint&&!currentEquationPlan)renderCheckpoint(lesson.checkpoint);
    }
    renderAnswerArea();
  }
  questionStartedAt=Date.now();
}

function chooseAnswerMode(item){
  if(currentEquationPlan)return "input";
  if(item.stage==="verification")return "input";
  if(store.state.settings.answerMode==="choice")return "choice";
  if(store.state.settings.answerMode==="input")return currentDescriptor.supported?"input":"choice";
  if(!currentDescriptor.supported)return "choice";
  if(item.stage==="guided")return Math.random()<.5?"choice":"input";
  return "input";
}

function renderCheckpoint(checkpoint){
  $("#checkpointCard").classList.remove("hidden");
  $("#checkpointExpression").textContent=`${checkpoint.left} = ？`;
  $("#checkpointInput").value="";
  $("#checkpointInput").disabled=false;
  $("#checkpointCheck").disabled=false;
  $("#checkpointFeedback").textContent="";
  $("#checkpointCheck").onclick=()=>{
    const value=$("#checkpointInput").value.trim();
    if(!value){$("#checkpointFeedback").textContent="请先填写第一步的答案。";return}
    if(/^[+-]?\d+(?:\.\d+)?$/.test(value)&&Number(value)===checkpoint.answer){
      checkpointPassed=true;
      $("#checkpointFeedback").textContent="✅ 第一步正确，再完成最后的问题。";
      $("#checkpointInput").disabled=true;
      $("#checkpointCheck").disabled=true;
      play("correct");
    }else{
      $("#checkpointFeedback").textContent="再看一次讲解中的第一步。";
      hintLevel=Math.max(1,hintLevel);
      hints++;
      showTutor(false);
      play("wrong");
    }
  };
}

function renderTutor(lesson,modeText){
  $("#tutorTitle").textContent=lesson.title;
  $("#tutorMode").textContent=modeText;
  $("#tutorSteps").innerHTML=lesson.steps.map((step,index)=>`<div class="tutor-step ${String(step).startsWith("🔎")?"recovery":""}"><i>${index+1}</i><span>${escapeHTML(step)}</span></div>`).join("");
  $("#tutorVisual").innerHTML=lesson.visual||"";
  $("#moreHint").classList.toggle("hidden",!lesson.canShowMore);
  $("#tutorPanel").classList.remove("hidden");
  $("#speakTutor").onclick=()=>speak(lesson.speech);
}
function feedbackTutorHTML(q){
  const lesson=buildTutor(q,{stage:"teach",reveal:true,hintLevel:10});
  const steps=lesson.allSteps;
  return `<div class="feedback-solution"><b>${escapeHTML(lesson.title)}</b>${steps.map(step=>`<span>${escapeHTML(step)}</span>`).join("")}</div>`;
}
function showTutor(reveal=false){
  const item=session.items[itemIndex];
  const mistakeEntry=!reveal?firstWrongEntry:null;
  const mistakeReason=mistakeEntry?engine.classifyError(item.question,mistakeEntry):"";
  const lesson=buildTutor(item.question,{stage:item.stage,reveal,hintLevel,mistakeEntry,mistakeReason});
  renderTutor(lesson,reveal?"完整讲解与答案":lesson.recoveryApplied?"针对刚才答案的纠错提示":"只显示方法，不直接公布答案");
  if(retrying&&!reveal&&$("#checkpointCard").classList.contains("hidden")){
    const guided=buildTutor(item.question,{stage:"guided",reveal:false,hintLevel:0});
    if(guided.checkpoint&&!currentEquationPlan)renderCheckpoint(guided.checkpoint);
  }
  $("#tutorPanel").scrollIntoView({behavior:"smooth",block:"nearest"});
}

function numericPad(){
  return `<div class="keypad">${[1,2,3,4,5,6,7,8,9].map(number=>`<button data-key="${number}">${number}</button>`).join("")}<button class="action" data-action="clear">清除</button><button data-key="0">0</button><button class="submit" data-action="submit">确定</button></div>`;
}
function expressionPad(){
  const keys=["1","2","3","+","4","5","6","-","7","8","9","×","0","(",")","÷"];
  return `<div class="keypad expression-pad">${keys.map(key=>`<button data-key="${key}">${key}</button>`).join("")}<button class="action" data-key="=">=</button><button class="action" data-action="backspace">←</button><button class="action" data-action="clear">清除</button><button class="submit" data-action="submit">确定</button></div>`;
}
function renderAnswerArea(){
  equationKeyboard?.destroy();equationKeyboard=null;
  const q=session.items[itemIndex].question;
  if(currentMode==="choice"){
    $("#answerArea").innerHTML=`<div class="choice-grid">${q.options.map((option,index)=>`<button class="choice-button" data-option="${index}">${escapeHTML(option)}</button>`).join("")}</div>`;
    $$("[data-option]").forEach(button=>button.onclick=()=>submitChoice(Number(button.dataset.option)));
    return;
  }
  if(currentEquationPlan){
    $("#answerArea").innerHTML=`<div class="fill-wrap equation-wrap"><div class="fill-label">把算式和结果都填完整</div><small>点选填写位置，用下方键盘输入。数字键直接写数，运算符接到第二个数，＝键跳到结果。</small>${currentEquationPlan.map((_,i)=>`<div class="equation-step">${currentEquationPlan.length>1?`<b>第${i+1}步</b>`:""}<div class="equation-row" data-equation-row="${i}"><input type="text" inputmode="none" readonly maxlength="12" autocomplete="off" data-equation-field="a" aria-label="第${i+1}步第一个数" placeholder="数"><input type="text" inputmode="none" readonly maxlength="1" data-equation-field="op" aria-label="第${i+1}步运算符" placeholder="符号"><input type="text" inputmode="none" readonly maxlength="12" autocomplete="off" data-equation-field="b" aria-label="第${i+1}步第二个数" placeholder="数"><span>=</span><input type="text" inputmode="none" readonly maxlength="12" autocomplete="off" data-equation-field="result" aria-label="第${i+1}步结果" placeholder="结果"></div></div>`).join("")}${screenKeyboardHTML({operators:true})}<div class="equation-actions"><button data-equation-clear>清空算式</button><button class="primary" data-equation-submit>检查算式和结果</button></div></div>`;
    $("[data-equation-submit]").onclick=submitInput;
    $("[data-equation-clear]").onclick=()=>{if(!finalized){$$("[data-equation-field]").forEach(input=>input.value="");equationKeyboard?.selectFirst()}};
    equationKeyboard=mountScreenKeyboard($("#answerArea"),{selector:"[data-equation-field]",operators:true});
    $$("[data-equation-field]").forEach(input=>input.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();submitInput()}}));
    return;
  }
  if(currentDescriptor.type==="compound"){
    $("#answerArea").innerHTML=`<div class="fill-wrap"><div class="fill-label">两个空都要自己填写</div><div class="compound-row"><div class="compound-box active" data-part="0">＿</div><span>${escapeHTML(currentDescriptor.labels[0])}</span><div class="compound-box" data-part="1">＿</div><span>${escapeHTML(currentDescriptor.labels[1])}</span></div>${numericPad()}</div>`;
  }else if(currentDescriptor.type==="relation"){
    $("#answerArea").innerHTML='<div class="fill-wrap"><div class="fill-label">自己选择应填写的数学符号</div><div class="relation-pad"><button data-relation=">">&gt;</button><button data-relation="=">=</button><button data-relation="<">&lt;</button></div></div>';
  }else if(currentDescriptor.type==="expression"){
    const label=currentDescriptor.comparison==="multiplication-factors"
      ?"请写出乘法算式（交换两个因数也算正确）"
      :"请自己写出算式";
    $("#answerArea").innerHTML=`<div class="fill-wrap"><div class="fill-label">${label}</div><div id="answerDisplay" class="answer-display">＿</div>${expressionPad()}</div>`;
  }else{
    $("#answerArea").innerHTML=`<div class="fill-wrap"><div class="fill-label">请自己算出答案，不能靠选项猜</div><div id="answerDisplay" class="answer-display">＿${currentDescriptor.unit?`<small>${escapeHTML(currentDescriptor.unit)}</small>`:""}</div>${numericPad()}</div>`;
  }
  bindInput();
}
function bindInput(){
  $$("[data-key]").forEach(button=>button.onclick=()=>appendKey(button.dataset.key));
  $$("[data-action]").forEach(button=>button.onclick=()=>{
    if(button.dataset.action==="clear")clearEntry();
    else if(button.dataset.action==="backspace"){typed=typed.slice(0,-1);updateEntry()}
    else if(button.dataset.action==="submit")submitInput();
  });
  $$("[data-part]").forEach(box=>box.onclick=()=>{activePart=Number(box.dataset.part);updateEntry()});
  $$("[data-relation]").forEach(button=>button.onclick=()=>grade(compareAnswer(currentDescriptor,{value:button.dataset.relation}),{value:button.dataset.relation,selectedValue:button.dataset.relation}));
}
function appendKey(key){
  if(finalized)return;
  if(currentDescriptor.type==="compound"){
    if(parts[activePart].length<7)parts[activePart]+=key;
  }else if(typed.length<18)typed+=key;
  updateEntry();
}
function clearEntry(){
  if(currentDescriptor.type==="compound")parts[activePart]="";
  else typed="";
  updateEntry();
}
function updateEntry(){
  if(currentDescriptor.type==="compound"){
    $$(".compound-box").forEach((box,index)=>{box.textContent=parts[index]||"＿";box.classList.toggle("active",index===activePart)});
  }else{
    const display=$("#answerDisplay");
    if(display)display.innerHTML=`${escapeHTML(typed||"＿")}${currentDescriptor.unit?`<small>${escapeHTML(currentDescriptor.unit)}</small>`:""}`;
  }
}
function submitInput(){
  if(finalized)return;
  if(currentEquationPlan){
    const rows=$$("[data-equation-row]").map(row=>Object.fromEntries([...row.querySelectorAll("[data-equation-field]")].map(input=>[input.dataset.equationField,input.value])));
    const result=checkEquationPlan(currentEquationPlan,rows);
    if(result.incomplete){$("#feedback").textContent="请把每行的两个数、运算符和结果都填完整。";return}
    grade(result.correct,result.entry);return;
  }

  if(currentDescriptor.type==="compound"){
    if(parts.some(value=>value==="")){$("#feedback").textContent="请把两个空都填好。";return}
    const entry={values:parts.map(Number),value:parts.join("/")};
    grade(compareAnswer(currentDescriptor,entry),entry);
  }else{
    if(!typed){$("#feedback").textContent="请先填写答案。";return}
    const entry={value:currentDescriptor.type==="expression"?normalizeExpression(typed):typed};
    grade(compareAnswer(currentDescriptor,entry),entry);
  }
}
function submitChoice(index){
  if(finalized||selectedWrong.has(index))return;
  const q=session.items[itemIndex].question;
  const entry={selectedIndex:index,selectedValue:q.options[index],value:q.options[index]};
  grade(index===q.answer,entry);
}

function markChoice(index,className,disable=false){
  const button=$(`[data-option="${index}"]`);
  if(button){button.classList.add(className);if(disable)button.disabled=true}
}
function disableAnswers(){
  $("#answerArea").querySelectorAll("button,input,select").forEach(element=>element.disabled=true);
}
function revealCorrect(entry,correct){
  const item=session.items[itemIndex];
  const q=item.question;
  if(currentMode==="choice"){
    $$("[data-option]").forEach((button,index)=>{
      button.disabled=true;
      if(index===q.answer)button.classList.add("good");
      if(entry?.selectedIndex===index&&!correct)button.classList.add("bad");
    });
  }else{
    const display=$("#answerDisplay");
    if(display)display.classList.add(correct?"good":"bad");
  }
}
function resetForRetry(){
  if(currentEquationPlan){$$("[data-equation-field]").forEach(input=>input.value="");equationKeyboard?.selectFirst();return}

  if(currentMode==="choice"){
    if(firstWrongEntry?.selectedIndex!=null){
      selectedWrong.add(firstWrongEntry.selectedIndex);
      markChoice(firstWrongEntry.selectedIndex,"bad",true);
    }
  }else{
    typed="";
    parts=["",""];
    updateEntry();
  }
}
function grade(ok,entry){
  if(finalized)return;
  if(!$("#checkpointCard").classList.contains("hidden")&&!checkpointPassed){
    $("#feedback").textContent="先完成黄色卡片里的第一步，再提交最后答案。";
    $("#checkpointCard").scrollIntoView({behavior:"smooth",block:"nearest"});
    return;
  }
  if(!firstAttemptDone){
    firstAttemptDone=true;
    if(ok){finalizeAnswer({firstCorrect:true,recovered:false,entry});return}
    firstWrongEntry=entry;
    if(store.state.settings.firstRetry){
      retrying=true;
      resetForRetry();
      hints++;
      hintLevel=Math.max(1,hintLevel);
      $("#feedback").innerHTML='<div class="retry-feedback">还没对，但先不公布答案。看提示后自己再改一次。</div>';
      showTutor(false);
      play("wrong");
      return;
    }
    finalizeAnswer({firstCorrect:false,recovered:false,entry});
    return;
  }
  if(retrying){
    if(ok)finalizeAnswer({firstCorrect:false,recovered:true,entry});
    else finalizeAnswer({firstCorrect:false,recovered:false,entry});
  }
}
function finalizeAnswer({firstCorrect,recovered,entry}){
  finalized=true;
  retrying=false;
  const item=session.items[itemIndex];
  const q=item.question;
  const result={
    firstCorrect,
    recovered,
    elapsedMs:Date.now()-questionStartedAt,
    hints,
    entry,
    firstWrongEntry
  };
  const updated=engine.recordResult(item,result);
  sessionResults.push({skillId:q.skillId,firstCorrect,recovered,stage:item.stage,qid:q.qid,elapsedMs:Math.max(0,Math.min(600000,result.elapsedMs))});
  revealCorrect(entry,firstCorrect||recovered);
  disableAnswers();
  if(firstCorrect){
    $("#feedback").innerHTML=`✅ 首次答对！这个题型的练习表现估计为 <b>${updated.skillMastery}%</b>。${feedbackTutorHTML(q)}`;
    play("correct");celebrate(11);speak("答对了，真厉害");
  }else if(recovered){
    $("#feedback").innerHTML=`🛠️ 自己改对了！首次错误仍会保留在统计里，但已记录“自主纠错”。${feedbackTutorHTML(q)}`;
    play("correct");celebrate(8);speak("自己改对了，这才是真正的进步");
  }else{
    $("#feedback").innerHTML=`💡 正确答案：<b>${escapeHTML(q.options[q.answer])}</b><br>系统推测（待核实）：<b>${escapeHTML(engine.classifyError(q,firstWrongEntry||entry))}</b>${feedbackTutorHTML(q)}`;
    hintLevel=10;
    showTutor(true);
    play("wrong");speak("这题先弄明白，系统会安排同类题复习");
  }
  if(item.verificationOf){
    const task=store.state.verificationTasks.find(row=>row.sourceQid===item.verificationOf);
    $("#feedback").insertAdjacentHTML("afterbegin",`<p class="verification-status">🔎 ${escapeHTML(verificationLabel(task?.status))}。一次验证不代表全部掌握。</p>`);
  }else if(!firstCorrect){
    const task=engine.queueVerification(session,item,itemIndex);
    if(task)$("#feedback").insertAdjacentHTML("beforeend",`<p class="verification-status">${task.variantQid?"本轮稍后会换一道数字不同的同类题，看看能否独立完成。":"已记下待验证内容，可从家长报告继续；没有合适变式时不会标成通过。"}</p>`);
  }
  if(!firstCorrect)renderReflection(q);
  $("#nextQuestion").classList.remove("hidden");
  header();
}

function renderReflection(q){
  $("#feedback").insertAdjacentHTML("beforeend",`<div class="reflection-box"><b>刚才卡在哪里？（可以跳过）</b><div class="reflection-options">${Object.entries(REFLECTIONS).map(([id,row])=>`<button data-reflection="${id}">${escapeHTML(row.label)}</button>`).join("")}</div><small id="reflectionSaved" role="status">系统推测只供参考，你的想法更重要。</small></div>`);
  $$("[data-reflection]").forEach(button=>button.onclick=()=>{
    const id=button.dataset.reflection;
    const stats=store.state.questionStats[q.qid];
    stats.reflections=stats.reflections||{};
    stats.reflections[id]=Number(stats.reflections[id]||0)+1;
    const mistake=store.state.mistakes.find(row=>row.qid===q.qid);
    if(mistake)mistake.reflection=id;
    store.save();
    $$("[data-reflection]").forEach(b=>{b.disabled=true;b.classList.toggle("active",b===button)});
    $("#reflectionSaved").textContent="已记下，下面用适合这个卡点的方法再想一想。";
    const task=store.state.verificationTasks.find(row=>row.sourceQid===q.qid);
    if(task)task.reflection=id;
    renderCoaching(q,id);
  });
}

function renderCoaching(q,reason){
  $("#coachingCard")?.remove();
  const lesson=buildTutor(q,{stage:"guided",reveal:false,hintLevel:0});
  const prompts={reading:["先找条件，再找问题","把已知数量和所问分别说出来。","已知什么？","题目问什么？"],calculation:["先说列式理由，再检查计算","可以拆数、画点，或用相反运算验算。","我是这样计算的","我准备怎样检查"],concept:["把关系画出来或摆出来","先摆已知的，再表示它们之间的关系，最后指出所求。","我用什么表示已知量","它们之间有什么关系"],unsure:["先说说你刚才怎么想","可以写、画，或请家长代记，不急着贴标签。","我先想到了什么","我卡在这里"]};
  const [title,copy,first,second]=prompts[reason]||prompts.unsure;
  $("#feedback").insertAdjacentHTML("beforeend",`<div id="coachingCard" class="coaching-card"><h3>${escapeHTML(title)}</h3><p>${escapeHTML(copy)}</p>${reason==="concept"?lesson.visual||"":""}${reason==="calculation"?`<p>${lesson.methodSteps.slice(0,2).map(escapeHTML).join("<br>")}</p>`:""}<label for="coachFirst">${escapeHTML(first)}</label><textarea id="coachFirst" rows="2" maxlength="300"></textarea><label for="coachSecond">${escapeHTML(second)}</label><textarea id="coachSecond" rows="2" maxlength="300"></textarea><button id="coachSave">记下我的思路</button><small id="coachSaved" role="status">这份表达由孩子或家长记录，系统不自动判分。</small></div>`);
  $("#coachSave").onclick=()=>{
    const a=$("#coachFirst").value.trim(),b=$("#coachSecond").value.trim();
    if(!a&&!b){$("#coachSaved").textContent="先写下一点想法，也可以请家长代记。";return}
    const record={qid:q.qid,reason,note:`${first}：${a}\n${second}：${b}`,at:Date.now()};
    store.state.coachingRecords=[record,...store.state.coachingRecords.filter(row=>row.qid!==q.qid||row.reason!==reason)].slice(0,60);
    store.save();$("#coachSaved").textContent="已记录；接下来换一道题，看看能否独立完成。";
  };
  store.save();
}

function nextItem(){
  if(!session)return;
  if(session.items[itemIndex]?.example){
    itemIndex++;
    showItem();
    return;
  }
  if(!finalized)return;
  itemIndex++;
  showItem();
}
function finishSession(){
  if(session.completedAt)return;
  const total=sessionResults.length;
  const firstCorrect=sessionResults.filter(result=>result.firstCorrect).length;
  const recovered=sessionResults.filter(result=>result.recovered).length;
  const score=total?Math.round(firstCorrect/total*100):0;
  const minutes=Math.round(sessionResults.reduce((sum,result)=>sum+Number(result.elapsedMs||0),0)/60000);
  engine.completeSession(session,{score,firstCorrect,recovered,total,minutes,results:sessionResults});
  $("#gameProgress").style.width="100%";
  $("#stageRail").innerHTML="";
  $("#questionSkill").textContent="本轮学习完成";
  $("#questionText").innerHTML=`🏆 闯关成功<br><small>首次答对 ${firstCorrect}/${total} · 自主纠错 ${recovered}题</small>`;
  $("#checkpointCard").classList.add("hidden");
  $("#tutorPanel").classList.add("hidden");
  $("#answerArea").innerHTML=`<div class="finish-actions"><button id="finishReport">查看学习报告</button><button id="finishAgain">再练一组</button><button id="finishHome">返回学习地图</button></div>`;
  $("#feedback").textContent=`首次正确率 ${score}% · 学习${minutes}分钟 · 完成奖励5颗星星。系统已经安排下一次间隔复习。`;
  $("#nextQuestion").classList.add("hidden");
  $("#finishReport").onclick=()=>navigate("report");
  $("#finishHome").onclick=()=>{session=null;renderAll();navigate("home")};
  $("#finishAgain").onclick=()=>{
    if(session.type==="verification"){
      const next=engine.buildVerificationSession();
      if(next.items.length){session=next;beginSession()}else navigate("report");
      return;
    }
    const courseId=session.course.id;
    if(engine.getCourse(courseId))startCourse(courseId,"adaptive");
    else startReview();
  };
  play("finish");celebrate(30);speak("闯关成功，今天的知识已经安排好复习");
  renderAll();
}

function showSettings(){
  const settings=store.state.settings;
  openModal("⚙️","V12学习设置",`<div class="settings">
    <div class="setting"><b>默认学习方式</b><div class="segments">
      <button data-setting="practiceMode" data-value="learning" class="${settings.practiceMode==="learning"?"active":""}">四阶段</button>
      <button data-setting="practiceMode" data-value="adaptive" class="${settings.practiceMode==="adaptive"?"active":""}">智能强化</button>
      <button data-setting="practiceMode" data-value="review" class="${settings.practiceMode==="review"?"active":""}">间隔复习</button>
      <button data-setting="practiceMode" data-value="random" class="${settings.practiceMode==="random"?"active":""}">随机</button>
    </div></div>
    <div class="setting"><b>每组题量</b><div class="segments">${[8,12,16,20].map(number=>`<button data-setting="roundSize" data-value="${number}" class="${settings.roundSize===number?"active":""}">${number}题</button>`).join("")}</div></div>
    <div class="setting"><b>其他题的答题方式</b><div class="segments">
      <button data-setting="answerMode" data-value="smart" class="${settings.answerMode==="smart"?"active":""}">智能防猜</button>
      <button data-setting="answerMode" data-value="input" class="${settings.answerMode==="input"?"active":""}">尽量填空</button>
      <button data-setting="answerMode" data-value="choice" class="${settings.answerMode==="choice"?"active":""}">只做选择</button>
    </div></div>
    ${toggleSetting("equationPractice","列式并计算","适合列式的题填写完整算式；其他题沿用答题方式设置",settings.equationPractice)}
    ${toggleSetting("firstRetry","答错先自己改一次","第一次答错不马上公布答案",settings.firstRetry)}
    ${toggleSetting("sound","朗读与答题音效","关闭后完全静音",settings.sound)}
    ${toggleSetting("focusMode","学习时专注模式","进入题目后收起顶部大图",settings.focusMode)}
  </div>`);
  $$("[data-setting]").forEach(button=>button.onclick=()=>{
    const key=button.dataset.setting;
    store.state.settings[key]=key==="roundSize"?Number(button.dataset.value):button.dataset.value;
    store.save();showSettings();renderAll();
  });
  $$("[data-toggle]").forEach(button=>button.onclick=()=>{
    const key=button.dataset.toggle;
    store.state.settings[key]=!store.state.settings[key];
    store.save();showSettings();renderAll();
  });
}
function toggleSetting(key,title,copy,value){
  return `<div class="setting toggle-setting"><div><b>${title}</b><small>${copy}</small></div><button class="toggle ${value?"on":""}" data-toggle="${key}">${value?"开":"关"}</button></div>`;
}

function showReward(){
  const claimed=store.state.rewards.lastDate===today();
  if(claimed){showAchievements();return}
  const next=Math.min(5+store.state.rewards.streak*2,20);
  openModal("🎁","每日奖励",`<div class="reward-box"><div>🎁</div><b>今天可领取 ${next} 颗星星</b><p>当前连续学习 ${store.state.rewards.streak} 天</p><button id="claimReward" class="claim-button">立即领取</button></div>`);
  $("#claimReward").onclick=()=>{
    const gain=store.claimDailyReward();
    play("finish");celebrate(22);
    $("#modalContent").innerHTML=`<div class="reward-box"><div>🌟</div><b>获得 ${gain} 颗星星</b><p>连续学习 ${store.state.rewards.streak} 天</p><button id="showAchievements" class="claim-button">查看成就</button></div>`;
    $("#showAchievements").onclick=showAchievements;
    renderAll();
  };
}
function achievements(){
  const state=store.state;
  return [
    ["🌱","开始冒险","完成第1道题",state.stats.attempts>=1],
    ["⚡","百题勇士","累计完成100题",state.stats.attempts>=100],
    ["🛠️","纠错能手","自主纠正10题",state.stats.recovered>=10],
    ["🧠","知识达人","总体掌握度达到80%",state.stats.attempts>=30&&engine.overallMastery()>=80],
    ["🚀","迁移高手","完成5次四阶段学习",state.sessions.filter(item=>item.mode==="learning").length>=5],
    ["🔁","复习达人","完成20个间隔复习",Object.values(state.reviews).filter(item=>item.box>=2).length>=20],
    ["🎯","精准射手","满30题且首次正确率90%",state.stats.attempts>=30&&state.stats.firstCorrect/state.stats.attempts>=.9],
    ["⭐","星星收藏家","拥有200颗星星",state.stats.stars>=200]
  ];
}
function showAchievements(){
  const items=achievements();
  openModal("🏆","我的成就",`<div class="achievement-list">${items.map(([icon,name,desc,done])=>`<div class="achievement ${done?"done":""}"><span>${done?icon:"🔒"}</span><div><b>${name}</b><small>${desc}</small></div><em>${done?"已解锁":"未解锁"}</em></div>`).join("")}</div>`);
}

function showVertical(){
  openModal("🧮","竖式测试",'<div id="verticalRoot"></div>');
  activeLabDispose=mountVertical($("#verticalRoot"),{draft:store.state.verticalDraft,onSave:(draft,completed)=>{
    store.state.verticalDraft=draft;
    if(completed)store.state.verticalRecords=[completed,...store.state.verticalRecords.filter(r=>r.id!==completed.id)].slice(0,30);
    store.save();
  }});
}

function showMathLab(){
  openModal("⚖️","峻峻的数学实验台",'<div id="mathLabRoot"></div>');
  activeLabDispose=mountLab($("#mathLabRoot"),{
    draft:store.state.manipulativeDraft,
    onSave:(record,draft)=>{
      store.state.manipulativeDraft=draft;
      if(record.moves||record.note||record.completed||record.hintUsed){
        store.state.manipulativeRecords=[record,...store.state.manipulativeRecords.filter(row=>row.id!==record.id)].slice(0,40);
      }
      store.save();
      $("#labResumeNote").textContent="已保留上次操作，打开即可继续。";
      if($("#report").classList.contains("active"))renderReport();
    }
  });
}

function showOpenChallenge(kind="multiple"){
  const challenge=createOpenChallenge(kind);
  const solutions=[];
  let missingRecognized=false;
  openModal("💭",challenge.title,`<div class="exploration"><div class="segments"><button id="openMultiple">找多个答案</button><button id="openMissing">补一个条件</button></div><p class="explore-prompt">${escapeHTML(challenge.prompt)}</p>${kind==="missing"?'<button id="recognizeMissing">不能唯一确定，还需要条件</button><p id="missingFeedback" role="status"></p>':""}<div class="creator-fields"><label>🍎的值<input id="openApple" inputmode="numeric"></label><label>${kind==="missing"?"补上条件：🍐＝":"🍐的值"}<input id="openPear" inputmode="numeric"></label></div><button id="openCheck">检查这一组</button><p id="openFeedback" role="status"></p><div id="openSolutions"></div><label for="openNote">我发现了什么？还可以提出什么问题？</label><textarea id="openNote" rows="3" maxlength="500"></textarea><button id="openSave">保存我的探索</button><p id="openSaved" role="status"></p><small>只检查数值是否满足条件，不自动评价解释；不计入考试正确率。</small></div>`);
  const save=()=>{
    const note=$("#openNote").value.trim();
    const row={id:challenge.id,title:challenge.title,prompt:challenge.prompt,correct:kind==="missing"?missingRecognized&&solutions.length>0:solutions.length>=2,note:[...solutions.map(s=>`🍎=${s.apple}，🍐=${s.pear}`),note].filter(Boolean).join("；"),kind,missingRecognized,at:Date.now()};
    store.state.explorations=[row,...store.state.explorations.filter(item=>item.id!==row.id)].slice(0,40);
    store.save();$("#openSaved").textContent="已保存到家长报告。";
  };
  $("#openMultiple").onclick=()=>{save();showOpenChallenge("multiple")};
  $("#openMissing").onclick=()=>{save();showOpenChallenge("missing")};
  if(kind==="missing")$("#recognizeMissing").onclick=()=>{missingRecognized=true;$("#missingFeedback").textContent="对，只知道和不能确定每个数。请补一个条件，并填出两个数。"};
  $("#openCheck").onclick=()=>{
    const result=checkOpenChallenge(challenge,[$("#openApple").value,$("#openPear").value],solutions);
    $("#openFeedback").textContent=result.message;
    if(!result.ok)return;
    solutions.push(result);
    $("#openSolutions").textContent=solutions.map(row=>`🍎=${row.apple}，🍐=${row.pear}`).join("；");
    save();
  };
  $("#openSave").onclick=save;
}

function showExploration(level=1,values){
  const puzzle=createExploration(level,values);
  let correct=false;
  let hintUsed=false;
  openModal("🔭","数学探索工坊",`<div class="exploration">
    <p>不计时、不计入正确率。可以画图、摆实物，或把想法说给家长听。</p>
    <div class="segments explore-levels">${[1,2,3].map(n=>`<button data-explore-level="${n}" class="${n===puzzle.level?"active":""}">${n} · ${["","一层","连续","反推"][n]}</button>`).join("")}</div>
    <h3>${escapeHTML(puzzle.title)}</h3><p class="explore-prompt">${escapeHTML(puzzle.prompt)}</p>
    <div class="explore-answer"><label for="exploreAnswer">我的答案</label><input id="exploreAnswer" inputmode="numeric" autocomplete="off"><button id="exploreCheck">试试看</button></div>
    <p id="exploreFeedback" role="status">先想一想：哪个量是已知的？</p>
    <button id="exploreHint">给我第一步提示</button>
    <div id="exploreStep" class="hidden"><p>${escapeHTML(puzzle.firstPrompt)}</p><label for="exploreFirst">第一步答案</label><input id="exploreFirst" inputmode="numeric"><button id="exploreFirstCheck">检查第一步</button><p id="exploreFirstFeedback" role="status"></p></div>
    <div id="exploreMethods" class="hidden"></div>
    <label class="explore-note" for="exploreNote">我的想法 / 我出的新问题（也可由家长代记）</label><textarea id="exploreNote" rows="3" maxlength="500" placeholder="我是这样想的……还有别的解法吗？"></textarea>
    <div class="explore-actions"><button id="exploreSave">保存探索记录</button><button id="exploreNext">换一道</button></div><p id="exploreSaved" role="status"></p>
    <details><summary>我来出一道题</summary><p>试着改一改数字，看看答案怎样变化。生成新题前，记得先保存当前想法。</p><div class="creator-fields"><label>一个🍎的数值（1～9）<input id="createA" type="number" min="1" max="9" value="${puzzle.a}"></label><label>🍐有几个🍎（2～5）<input id="createB" type="number" min="2" max="5" value="${puzzle.b}"></label>${puzzle.level===3?`<label>🍇比🍐多多少（1～9）<input id="createC" type="number" min="1" max="9" value="${puzzle.c}"></label>`:""}</div><button id="createPuzzle">生成我的题目</button><p id="createFeedback" role="status"></p></details>
  </div>`);
  const save=()=>{
    const row={id:puzzle.id,title:puzzle.title,prompt:puzzle.prompt,level:puzzle.level,correct,hintUsed,note:$("#exploreNote").value.trim().slice(0,500),date:Date.now()};
    store.state.explorations=[row,...(store.state.explorations||[]).filter(item=>item.id!==puzzle.id)].slice(0,40);
    store.save();
    $("#exploreSaved").textContent="已保存，可在家长报告里查看。";
  };
  $("#exploreCheck").onclick=()=>{
    if(!$("#exploreAnswer").value.trim()){$("#exploreFeedback").textContent="先填一个答案，再一起检查。";return}
    correct=checkExploration($("#exploreAnswer").value,puzzle.answer);
    $("#exploreFeedback").textContent=correct?"✅ 解出来了！看看两种方法，再说说你用了哪一种。":"还没对。先找已知量，再沿着关系换一层；可以点第一步提示。";
    if(correct){
      $("#exploreMethods").innerHTML=`<h4>两种解法，哪种更像你的想法？</h4>${puzzle.methods.map(method=>`<p>${escapeHTML(method)}</p>`).join("")}`;
      $("#exploreMethods").classList.remove("hidden");
      save();
    }
  };
  $("#exploreHint").onclick=()=>{hintUsed=true;$("#exploreStep").classList.remove("hidden")};
  $("#exploreFirstCheck").onclick=()=>{
    const value=$("#exploreFirst").value;
    $("#exploreFirstFeedback").textContent=!value.trim()?"请先填写第一步答案。":checkExploration(value,puzzle.firstAnswer)?`✅ 第一步对了：${puzzle.firstSolution}。再回到最后的问题。`:"试着画出相同的几组，或者把总数平均分。";
  };
  $("#exploreSave").onclick=save;
  $("#exploreNext").onclick=()=>{save();showExploration(puzzle.level)};
  $$("[data-explore-level]").forEach(button=>button.onclick=()=>{save();showExploration(Number(button.dataset.exploreLevel))});
  $("#createPuzzle").onclick=()=>{
    const a=Number($("#createA").value),b=Number($("#createB").value),c=puzzle.level===3?Number($("#createC").value):puzzle.c;
    if(!Number.isInteger(a)||a<1||a>9||!Number.isInteger(b)||b<2||b>5||!Number.isInteger(c)||c<1||c>9){$("#createFeedback").textContent="请按标注范围填写整数。";return}
    save();showExploration(puzzle.level,{a,b,c});
  };
}

function showMathTools(){
  openModal("🧰","数学工具箱",`<div class="math-tools">
    <div class="tool-card"><b>🔢 数位分解</b><p>输入0～9999的整数</p><input id="placeValueInput" type="number" min="0" max="9999" value="2368" inputmode="numeric"><div id="placeValueResult" class="tool-result"></div></div>
    <div class="tool-card"><b>📏 厘米换算</b><p>把厘米换成米和厘米</p><input id="lengthInput" type="number" min="0" value="168" inputmode="numeric"><div id="lengthResult" class="tool-result"></div></div>
    <div class="tool-card"><b>💰 角换算</b><p>把总角数换成元和角</p><input id="moneyInput" type="number" min="0" value="27" inputmode="numeric"><div id="moneyResult" class="tool-result"></div></div>
    <div class="tool-card"><b>⏰ 分钟换算</b><p>把总分钟换成小时和分钟</p><input id="timeInput" type="number" min="0" value="135" inputmode="numeric"><div id="timeResult" class="tool-result"></div></div>
  </div>`);
  const safeWhole=(selector,max=999999)=>Math.max(0,Math.min(max,Math.floor(Number($(selector).value)||0)));
  const update=()=>{
    const number=safeWhole("#placeValueInput",9999);
    $("#placeValueResult").innerHTML=`<span>${Math.floor(number/1000)}<small>千</small></span><span>${Math.floor(number%1000/100)}<small>百</small></span><span>${Math.floor(number%100/10)}<small>十</small></span><span>${number%10}<small>个</small></span>`;
    const cm=safeWhole("#lengthInput");
    $("#lengthResult").textContent=`${cm}厘米 ＝ ${Math.floor(cm/100)}米 ${cm%100}厘米`;
    const jiao=safeWhole("#moneyInput");
    $("#moneyResult").textContent=`${jiao}角 ＝ ${Math.floor(jiao/10)}元 ${jiao%10}角`;
    const minutes=safeWhole("#timeInput");
    $("#timeResult").textContent=`${minutes}分钟 ＝ ${Math.floor(minutes/60)}小时 ${minutes%60}分钟`;
  };
  $$("#modalContent input").forEach(input=>input.oninput=update);
  update();
}

function exportRecord(){
  const payload=store.exportPayload(cfg.version);
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const link=document.createElement("a");
  link.href=URL.createObjectURL(blob);
  link.download=`峻峻数学V12学习记录_${today()}.json`;
  link.click();
  setTimeout(()=>URL.revokeObjectURL(link.href),1000);
}
function importRecord(file){
  if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      store.importPayload(JSON.parse(String(reader.result||"")));
      alert("学习记录导入成功，页面将重新加载。");
      location.reload();
    }catch(error){alert(error.message||"这不是有效的学习记录。")}
  };
  reader.readAsText(file);
}
function resetRecord(){
  const pin=prompt("请输入家长密码");
  if(pin!==(cfg.parentPin||"2026"))return;
  if(confirm("确定清除全部V12学习记录吗？")){
    try{store.reset();location.reload()}catch(error){alert(error.message)}
  }
}

function renderAll(){
  header();
  renderHome();
  renderPlan();
  if($("#report").classList.contains("active"))renderReport();
}

function bindEvents(){
  window.addEventListener("junjun-storage-status",renderStorageStatus);
  $$(".nav-button").forEach(button=>button.onclick=()=>navigate(button.dataset.panel));
  $$("[data-go-home]").forEach(button=>button.onclick=()=>navigate("home"));
  $$(".grade-switch button").forEach(button=>button.onclick=()=>{
    store.state.profile.grade=Number(button.dataset.grade);
    store.save();
    renderAll();
  });
  $("#smartStart").onclick=smartStart;
  $("#diagnosticStart").onclick=startDiagnostic;
  $("#reviewStart").onclick=()=>{
    if(engine.dueReviews().length){startReview();return}
    const course=engine.recommendedCourse();
    if(course)startCourse(course.id,"adaptive");
  };
  $("#weakStart").onclick=()=>{
    const weak=engine.weakSkills(1)[0];
    const course=weak?engine.getCourse(weak.courseId):engine.recommendedCourse();
    if(course)startCourse(course.id,"adaptive");
  };
  $("#rewardBtn").onclick=showReward;
  $("#toolsBtn").onclick=showMathTools;
  $("#exploreStart").onclick=()=>showExploration(1);
  $("#openStart").onclick=()=>showOpenChallenge("multiple");
  $("#verticalStart").onclick=showVertical;
  $("#labStart").onclick=showMathLab;
  $("#verificationStart").onclick=()=>{
    session=engine.buildVerificationSession();
    if(!session.items.length){openModal("🔎","暂时没有合适的验证题","<p>待验证内容继续保留，未标记为通过。可以先回完整课程巩固。</p>");return}
    beginSession();
  };
  $("#symbolStart").onclick=()=>showCourseChoice("g2u11");
  $("#settingsBtn").onclick=showSettings;
  $("#voiceTest").onclick=()=>speak("你好，我是普通话语音。峻峻，我们一起学习数学吧。");
  $("#modalClose").onclick=closeModal;
  $$("[data-close-modal]").forEach(element=>element.onclick=closeModal);
  $("#hintBtn").onclick=()=>{
    if(!session||session.items[itemIndex]?.example||finalized)return;
    hints++;
    hintLevel++;
    showTutor(false);
  };
  $("#moreHint").onclick=()=>{
    if(!session||finalized||session.items[itemIndex]?.example)return;
    hints++;hintLevel++;showTutor(false);
  };
  $("#closeTutor").onclick=()=>$("#tutorPanel").classList.add("hidden");
  $("#nextQuestion").onclick=nextItem;
  $("#exportRecord").onclick=exportRecord;
  $("#importRecord").onclick=()=>$("#recordFile").click();
  $("#recordFile").onchange=event=>importRecord(event.target.files?.[0]);
  $("#resetRecord").onclick=resetRecord;
  $("#restoreImport").onclick=()=>{
    if(!confirm("恢复上次导入前的记录？当前记录会作为新的备份保留。建议先导出当前记录。"))return;
    try{store.restoreImportBackup();location.reload()}catch(error){alert(error.message)}
  };
  $("#exportRecovery").onclick=()=>{
    if(!store.recoveryRaw)return;
    const link=document.createElement("a");link.href=URL.createObjectURL(new Blob([store.recoveryRaw],{type:"text/plain;charset=utf-8"}));link.download="峻峻数学_异常记录原文.txt";link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
  };
  document.addEventListener("keydown",event=>{
    if(event.target?.matches?.("input,textarea,select,[contenteditable=true]")||!$("#modal").classList.contains("hidden"))return;
    if(currentEquationPlan||!session||finalized||currentMode!=="input"||!$("#game").classList.contains("active"))return;
    if(/^\d$/.test(event.key)){appendKey(event.key);event.preventDefault()}
    else if(["+","-","=","(",")"].includes(event.key)){appendKey(event.key);event.preventDefault()}
    else if(event.key==="Backspace"){
      if(currentDescriptor.type==="compound")parts[activePart]=parts[activePart].slice(0,-1);
      else typed=typed.slice(0,-1);
      updateEntry();event.preventDefault();
    }
    else if(event.key==="Enter"){submitInput();event.preventDefault()}
  });
}

function runtimeSelfTest(){
  const stats=engine.bankStats();
  const audit=engine.catalogAudit();
  const problems=[];
  if(!window.MATH_V12_CONFIG)problems.push("V12配置未加载");
  if(!window.MATH_COURSES)problems.push("课程未加载");
  if(!window.MATH_QUESTIONS)problems.push("外接题库未加载");
  if(!window.MATH_V12_SKILL_MAP)problems.push("知识图谱未加载");
  if(stats.courses!==26)problems.push(`课程数异常：${stats.courses}`);
  if(stats.rawQuestions!==22456)problems.push(`原题数异常：${stats.rawQuestions}`);
  if(stats.questions!==21509)problems.push(`有效题数异常：${stats.questions}`);
  if(stats.exactDuplicatesRemoved!==947)problems.push(`完全重复题审计异常：${stats.exactDuplicatesRemoved}`);
  if(stats.fillable!==20627)problems.push(`防猜作答题数异常：${stats.fillable}`);
  if(stats.repairedQuestions!==4744||stats.semanticRepairs!==4786)problems.push(`旧题语义修正数异常：${stats.repairedQuestions}/${stats.semanticRepairs}`);
  if(!audit.qidsUnique||audit.qidCount!==21509)problems.push("有效题编号不唯一");
  if(audit.invalidQuestions||audit.duplicateOptions||audit.negativeAnswers||audit.languageIssues)problems.push("题库质量审计未通过");
  if(audit.qidCollisionsResolved)problems.push(`发现题号哈希冲突：${audit.qidCollisionsResolved}`);
  if(audit.multiplicationExpressionQuestions!==25)problems.push(`乘法交换律题数异常：${audit.multiplicationExpressionQuestions}`);
  const intro=engine.getQuestion((engine.byCourse.get("g2u11")||[])[0]?.qid);
  if(intro?.prompt!=="🍎＝3，🍐＝3个🍎。🍐等于多少？")problems.push("等量代换首页题未锁定");
  if(intro&&buildTutor(intro,{stage:"teach"}).methodId!=="symbol-substitution")problems.push("等量代换教学流程异常");
  const reverse=engine.catalog.find(question=>question.prompt.includes("□×6-6=60"));
  if(reverse&&buildTutor(reverse,{stage:"teach"}).methodId!=="reverse-operation")problems.push("逆向运算教学流程异常");
  const sumDifference=engine.catalog.find(question=>/和是32，大数比小数多2/.test(question.prompt));
  if(sumDifference&&buildTutor(sumDifference,{stage:"teach"}).methodId!=="sum-difference")problems.push("和差问题教学流程异常");
  const dedicatedSamples=[/最接近哪个整十数/,/里面有几个十和几个一/,/余数是多少/,/从1连续加到/]
    .map(pattern=>engine.catalog.find(question=>pattern.test(question.prompt))).filter(Boolean);
  if(dedicatedSamples.some(question=>buildTutor(question,{stage:"teach"}).methodId==="concept"))problems.push("专属教学流程抽检异常");
  const multiplicationResult=engine.catalog.find(question=>question.prompt==="哪个算式的得数是48？"&&question.options[question.answer]==="8×6");
  if(!multiplicationResult)problems.push("乘法交换律测试题缺失");
  else{
    const descriptor=answerDescriptor(multiplicationResult);
    if(!compareAnswer(descriptor,{value:"6×8"})
      ||!compareAnswer(descriptor,{value:"6×8=48"})
      ||compareAnswer(descriptor,{value:"6×8=47"})
      ||compareAnswer(descriptor,{value:"12×4"}))problems.push("乘法交换律判题异常");
  }
  const requestedCase=answerDescriptor({prompt:"哪个算式的得数是32？",options:["4×8"],answer:0});
  if(!compareAnswer(requestedCase,{value:"8×4"})
    ||!compareAnswer(requestedCase,{value:"8×4=32"})
    ||compareAnswer(requestedCase,{value:"8×4=31"})
    ||compareAnswer(requestedCase,{value:"2×16"}))problems.push("4×8与8×4回归测试异常");
  const contextualDescriptor=answerDescriptor({prompt:"4行，每行8个，应列哪个算式？",options:["4×8"],answer:0});
  if(compareAnswer(contextualDescriptor,{value:"8×4"}))problems.push("情境列式顺序保护异常");
  const subtractionDescriptor=answerDescriptor({prompt:"哪个算式的得数是4？",options:["8-4"],answer:0});
  const divisionDescriptor=answerDescriptor({prompt:"哪个算式的得数是2？",options:["8÷4"],answer:0});
  if(compareAnswer(subtractionDescriptor,{value:"4-8"})||compareAnswer(divisionDescriptor,{value:"4÷8"}))problems.push("非交换运算顺序保护异常");
  return problems;
}

function renderStorageStatus(){
  const text=store.storageError||store.notice;
  $("#storageStatus").textContent=text;
  $("#storageStatus").classList.toggle("hidden",!text);
}

function init(){
  const problems=runtimeSelfTest();
  if(problems.length){
    $("#loadError").innerHTML=`<b>V12启动自检未通过。</b><br>${problems.map(escapeHTML).join("<br>")}`;
    $("#loadError").classList.remove("hidden");
    return;
  }
  bindEvents();
  renderStorageStatus();
  initOffline();
  loadVoices();
  if(window.speechSynthesis)speechSynthesis.onvoiceschanged=loadVoices;
  renderAll();
  let migrationSeen=true;
  try{migrationSeen=localStorage.getItem("junjun_v12_migration_seen");if(store.state.migratedFromV11&&!migrationSeen)localStorage.setItem("junjun_v12_migration_seen","1")}catch{}
  if(store.state.migratedFromV11&&!migrationSeen){
    openModal("✅","旧版记录已保留",`<div class="reward-box"><div>🧳</div><b>V11学习记录已迁移到V12</b><p>星星、成绩、错题、课程练习和设置均继续保留；V11原记录没有被删除。</p><button id="migrationDone" class="claim-button">开始使用V12</button></div>`);
    $("#migrationDone").onclick=closeModal;
  }
}

init();
