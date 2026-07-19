(function(){
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const cfg=window.MATH_CONFIG||{}, courses=window.MATH_COURSES||[], bank=window.MATH_QUESTIONS||{};
const KEY="junjun_math_v10"; // 保留旧学习记录
const legacyKeys=["junjun_math_v8","junjun_math_v7"];
if(!localStorage.getItem(KEY)){for(const k of legacyKeys){const v=localStorage.getItem(k);if(v){localStorage.setItem(KEY,v);break}}}

let st=JSON.parse(localStorage.getItem(KEY)||'{"stars":0,"done":[],"attempts":0,"correct":0,"mistakes":[]}');
st={stars:0,done:[],attempts:0,correct:0,mistakes:[],rewardDate:"",rewardStreak:0,claimedAchievements:[],teacherStats:{help:0,types:{}},daily:{date:"",attempts:0,correct:0,courses:0,rewarded:false},courseStats:{},activity:[],...st};st.teacherStats=st.teacherStats||{help:0,types:{}};st.daily=st.daily||{date:"",attempts:0,correct:0,courses:0,rewarded:false};st.courseStats=st.courseStats||{};st.activity=st.activity||[];
let grade=2, course=null, qs=[], idx=0, session=0, sessionAttempts=0, sound=true, locked=false;
let mandarinVoice=null, voicesReady=false;
const ROUND_SIZE=10;
const snd={click:new Audio("./click.wav"),correct:new Audio("./correct.wav"),wrong:new Audio("./wrong.wav"),finish:new Audio("./finish.wav")};
function play(x){if(!sound)return;try{snd[x].currentTime=0;snd[x].play()}catch(e){}}
function updateVoiceStatus(msg){const el=$("#voiceStatus");if(el)el.textContent=msg||"只使用普通话；找不到普通话系统语音时不会改用广东话。"}
function loadVoices(){
 const voices=(window.speechSynthesis&&speechSynthesis.getVoices())||[];
 // 严格只接受普通话标记，绝不接受 zh-HK / yue。
 const exact=voices.filter(v=>/^(zh-CN|cmn-CN)(-|$)/i.test(String(v.lang||"")));
 const mainland=voices.filter(v=>/^zh(-|_)CN$/i.test(String(v.lang||"")));
 mandarinVoice=exact[0]||mainland[0]||null;
 voicesReady=true;
 if(mandarinVoice) updateVoiceStatus(`普通话语音已就绪：${mandarinVoice.name}（${mandarinVoice.lang}）`);
 else updateVoiceStatus("本机暂未提供普通话网页语音；已关闭题目朗读，不会播放广东话。答题音效仍可正常使用。");
}
function say(text,onDone){
 if(!sound){onDone&&onDone();return;}
 const t=String(text||"").trim();if(!t){onDone&&onDone();return;}
 if(!window.speechSynthesis){updateVoiceStatus("此浏览器不支持普通话朗读；不会改用广东话。");onDone&&onDone();return;}
 if(!voicesReady)loadVoices();
 if(!mandarinVoice){updateVoiceStatus("未找到普通话系统语音，因此本次不朗读；不会改用广东话。");onDone&&onDone();return;}
 speechSynthesis.cancel();
 const u=new SpeechSynthesisUtterance(t);u.lang="zh-CN";u.voice=mandarinVoice;u.rate=cfg.speechRate||.9;u.pitch=cfg.speechPitch||1;
 u.onstart=()=>updateVoiceStatus(`正在使用普通话：${mandarinVoice.name}`);
 u.onend=()=>{updateVoiceStatus();onDone&&onDone()};u.onerror=()=>{updateVoiceStatus("普通话朗读失败；已停止，不会改用广东话。");onDone&&onDone()};
 speechSynthesis.speak(u);
}


function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function teacherType(q){
 const t=(q.kind||"")+" "+(q.prompt||"")+" "+(q.explain||"");
 if(/退位|不够减/.test(t))return "退位减法";
 if(/进位/.test(t))return "进位加法";
 if(/应用|一共|还剩|原来|又|买|飞走|送给|共有/.test(t))return "应用题";
 if(/[＋+]/.test(t))return "加法";
 if(/[－-]/.test(t))return "减法";
 return q.kind||"综合题";
}
function extractArithmetic(q){
 const prompt=String(q.prompt||"");
 const explain=String(q.explain||"");
 const normalize=s=>s.replace(/[－—–]/g,"-").replace(/[＋]/g,"+").replace(/[×xX＊*]/g,"×").replace(/[÷]/g,"÷");
 let text=normalize(prompt);
 let m=text.match(/(\d{1,5})\s*([+\-×÷])\s*(\d{1,5})\s*(?:=|＝)?\s*\??/);
 if(m){
   const a=+m[1],op=m[2],b=+m[3];
   const ans=op==="+"?a+b:op==="-"?a-b:op==="×"?a*b:(b?Math.floor(a/b):null);
   return {a,op,b,ans,source:"prompt"};
 }
 text=normalize(explain);
 m=text.match(/(\d{1,5})\s*([+\-×÷])\s*(\d{1,5})\s*=\s*(\d{1,6})/);
 if(m)return {a:+m[1],op:m[2],b:+m[3],ans:+m[4],source:"explain"};
 return null;
}
function numberLineHTML(a,b,op){
 let from,to,marks=[];
 if(op==="+"){from=a;to=a+b;for(let i=0;i<=Math.min(b,20);i++)marks.push(a+i)}
 else{from=a-b;to=a;for(let i=0;i<=Math.min(b,20);i++)marks.push(a-b+i)}
 return `<div class="teach-label">数轴演示</div><div class="teach-numberline">${marks.map(n=>`<span class="${n===a||n===(op==="+"?a+b:a-b)?"active":""}">${n}</span>`).join("")}</div><small>${op==="+"?"向右走，数越来越大":"向左走，数越来越小"}</small>`;
}
function placeValueHTML(n){
 n=Math.max(0,Number(n)||0);
 const h=Math.floor(n/100),t=Math.floor(n%100/10),o=n%10;
 return `<div class="teach-label">数位盒</div><div class="place-box">
 <div><b>${h}</b><small>百位</small></div><div><b>${t}</b><small>十位</small></div><div><b>${o}</b><small>个位</small></div></div>`;
}
function buildArithmeticLesson(x,q){
 const {a,b,op}=x;
 const optionAnswer=q.options&&q.options[q.answer]!=null?Number(q.options[q.answer]):null;
 const answer=Number.isFinite(x.ans)?x.ans:optionAnswer;
 let steps=[],visual="";
 if(op==="+"){
   steps.push(`先看原题：${a} 加 ${b}。`);
   if(a<21&&b<21){
     steps.push(`从 ${a} 开始，在数轴上向右走 ${b} 步。`);
     steps.push(`最后走到 ${answer}，所以 ${a}+${b}=${answer}。`);
     visual=numberLineHTML(a,b,"+");
   }else{
     const maxLen=Math.max(String(a).length,String(b).length);
     let carry=0;
     const names=["个位","十位","百位","千位","万位"];
     for(let i=0;i<maxLen;i++){
       const da=Math.floor(a/10**i)%10, db=Math.floor(b/10**i)%10;
       const sum=da+db+carry, oldCarry=carry;
       carry=Math.floor(sum/10);
       if(oldCarry)steps.push(`${names[i]}：${da}+${db}+进位1=${sum}，写${sum%10}${carry?"，再向前一位进1":""}。`);
       else steps.push(`${names[i]}：${da}+${db}=${sum}，写${sum%10}${carry?"，向前一位进1":""}。`);
     }
     if(carry)steps.push(`最高位再写进位的1。`);
     steps.push(`所以 ${a}+${b}=${answer}。`);
     visual=placeValueHTML(answer);
   }
 }else if(op==="-"){
   steps.push(`先看原题：${a} 减 ${b}。`);
   if(a<21&&b<21){
     steps.push(`从 ${a} 开始，在数轴上向左退 ${b} 步。`);
     steps.push(`最后走到 ${answer}，所以 ${a}-${b}=${answer}。`);
     visual=numberLineHTML(a,b,"-");
   }else{
     const names=["个位","十位","百位","千位","万位"];
     const digitsA=String(a).split("").reverse().map(Number);
     const digitsB=String(b).split("").reverse().map(Number);
     while(digitsB.length<digitsA.length)digitsB.push(0);
     for(let i=0;i<digitsA.length;i++){
       let top=digitsA[i], bottom=digitsB[i]||0;
       if(top<bottom){
         let j=i+1;
         while(j<digitsA.length&&digitsA[j]===0)j++;
         if(j<digitsA.length){
           digitsA[j]-=1;
           for(let k=j-1;k>i;k--)digitsA[k]=9;
           digitsA[i]+=10;
           if(j===i+1)steps.push(`${names[i]}上 ${top} 不够减 ${bottom}，向${names[j]}借1，${top}变成${digitsA[i]}。`);
           else steps.push(`${names[i]}上 ${top} 不够减 ${bottom}，要连续借位：先从${names[j]}借1，中间的0变成9，${names[i]}变成${digitsA[i]}。`);
         }
       }
       steps.push(`${names[i]}：${digitsA[i]}-${bottom}=${digitsA[i]-bottom}。`);
     }
     steps.push(`按百位、十位、个位依次写下来，答案是 ${answer}。`);
     steps.push(`最后验算：${answer}+${b}=${a}，所以答案正确。`);
     visual=placeValueHTML(answer);
   }
 }else if(op==="×"){
   steps=[`先看原题：${a} 乘 ${b}。`,`乘法表示把相同的数重复相加。`,`可以理解为 ${b} 连加 ${a} 次，结果是 ${answer}。`];
 }else{
   steps=[`先看原题：${a} 除以 ${b}。`,`除法表示平均分。`,`把 ${a} 平均分成 ${b} 份，每份是 ${answer}。`];
 }
 return {steps,visual};
}
function buildLesson(q){
 const x=extractArithmetic(q);
 if(x)return buildArithmeticLesson(x,q);
 const answer=q.options&&q.options[q.answer]!=null?q.options[q.answer]:"";
 const prompt=q.prompt||"";
 let steps=[];
 if(/一共|共有|合计|总共/.test(prompt))steps.push("题目问“一共”或“共有”，通常要把两部分合起来，先考虑加法。");
 else if(/还剩|飞走|用去|送给|少了/.test(prompt))steps.push("题目问“还剩”，要从原来的数量里去掉一部分，先考虑减法。");
 else if(/每组|每份|几倍/.test(prompt))steps.push("先找清楚：有几组、每组有多少，或者要平均分成几份。");
 else steps.push("先圈出题目中的数字，再看清楚题目最后问什么。");
 steps.push("把没有用的信息暂时放在一边，只保留和问题有关的条件。");
 steps.push(`这道题可以这样理解：${q.explain||"按题目的数量关系逐步判断。"}`);
 steps.push(`再对照选项，正确答案是：${answer}。`);
 return {steps,visual:`<div class="story-guide"><b>应用题三步法</b><span>① 找数字</span><span>② 找问题</span><span>③ 选加减乘除</span></div>`};
}
function showTeacher(){
 if(!course||!qs.length)return;
 const q=qs[idx],lesson=buildLesson(q),type=teacherType(q);
 st.teacherStats.help++;st.teacherStats.types[type]=(st.teacherStats.types[type]||0)+1;save();
 $("#teacherSteps").innerHTML=lesson.steps.map((s,i)=>`<div class="teach-step"><i>${i+1}</i><span>${esc(s)}</span></div>`).join("");
 $("#teacherVisual").innerHTML=lesson.visual||"";
 $("#teacherPanel").classList.remove("hidden");
 $("#teacherPanel").scrollIntoView({behavior:"smooth",block:"nearest"});
}
function closeTeacher(){$("#teacherPanel").classList.add("hidden")}
function speakTeacher(){
 const txt=[...document.querySelectorAll("#teacherSteps .teach-step span")].map(x=>x.textContent).join("。");
 say(txt);
}

function localDay(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function yesterdayDay(){const d=new Date();d.setDate(d.getDate()-1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function ensureDaily(){
 const today=localDay();
 if(st.daily.date!==today)st.daily={date:today,attempts:0,correct:0,courses:0,rewarded:false};
}
function missionState(){
 ensureDaily();
 return [
  {icon:"✏️",name:"完成5道题",value:st.daily.attempts,target:5},
  {icon:"🎯",name:"答对3道题",value:st.daily.correct,target:3},
  {icon:"🏁",name:"完成1个关卡",value:st.daily.courses,target:1}
 ];
}
function renderMissionCard(){
 const box=$("#missionMini");if(!box)return;const ms=missionState(),done=ms.filter(x=>x.value>=x.target).length;
 box.innerHTML=ms.map(x=>`<span class="${x.value>=x.target?"done":""}">${x.value>=x.target?"✅":x.icon} ${x.name} ${Math.min(x.value,x.target)}/${x.target}</span>`).join("");
 $("#missionFill").style.width=(done/ms.length*100)+"%";
 $("#missionSummary").textContent=done===ms.length?(st.daily.rewarded?"今日任务已全部完成":"全部完成，领取10颗星星"): `已完成 ${done}/${ms.length}`;
}
function showMissions(){
 const ms=missionState(),all=ms.every(x=>x.value>=x.target);
 const rows=ms.map(x=>`<div class="mission-row ${x.value>=x.target?"done":""}"><span>${x.value>=x.target?"✅":x.icon}</span><div><b>${x.name}</b><small>${Math.min(x.value,x.target)} / ${x.target}</small></div></div>`).join("");
 openModal("✅","今日任务",`<div class="mission-list">${rows}</div><button id="claimMission" class="claim-button" ${!all||st.daily.rewarded?"disabled":""}>${st.daily.rewarded?"奖励已领取":all?"领取10颗星星":"完成全部任务后领取"}</button>`);
 const b=$("#claimMission");if(b&&all&&!st.daily.rewarded)b.onclick=()=>{st.daily.rewarded=true;st.stars+=10;save();celebrate(25);play("finish");showMissions()};
}
function openModal(icon,title,html){$("#modalIcon").textContent=icon;$("#modalTitle").textContent=title;$("#modalContent").innerHTML=html;$("#featureModal").classList.remove("hidden");document.body.classList.add("modal-open")}
function closeModal(){$("#featureModal").classList.add("hidden");document.body.classList.remove("modal-open")}
function showDailyReward(){
 const claimed=st.rewardDate===localDay();
 const next=Math.min(5+st.rewardStreak*2,20);
 openModal("🎁","每日奖励",`<div class="reward-box"><div class="reward-chest">${claimed?"✅":"🎁"}</div><h3>${claimed?"今天已经领取":"今天可领取"}</h3><p>连续打卡 <b>${st.rewardStreak}</b> 天</p><div class="reward-stars">⭐ ${claimed?"明天再来":"+"+next+"颗星星"}</div><button id="claimReward" class="claim-button" ${claimed?"disabled":""}>${claimed?"已领取":"立即领取"}</button><small>每天打开一次即可领取，连续领取奖励会增加。</small></div>`);
 const b=$("#claimReward");if(b&&!claimed)b.onclick=claimDailyReward;
}
function claimDailyReward(){
 const today=localDay();if(st.rewardDate===today)return showDailyReward();
 st.rewardStreak=st.rewardDate===yesterdayDay()?st.rewardStreak+1:1;
 const gain=Math.min(5+(st.rewardStreak-1)*2,20);st.stars+=gain;st.rewardDate=today;save();play("finish");celebrate(25);
 $("#modalContent").innerHTML=`<div class="reward-box"><div class="reward-chest reward-pop">🌟</div><h3>领取成功！</h3><div class="reward-stars">获得 ${gain} 颗星星</div><p>连续打卡 ${st.rewardStreak} 天</p><button id="rewardDone" class="claim-button">太棒啦</button></div>`;$("#rewardDone").onclick=closeModal;
}
const ACHIEVEMENTS=[
 {id:"first",icon:"🌱",name:"冒险起步",desc:"完成第1道题",ok:()=>st.attempts>=1},
 {id:"ten",icon:"⚡",name:"口算新星",desc:"累计答题10道",ok:()=>st.attempts>=10},
 {id:"fifty",icon:"🚀",name:"数学飞船",desc:"累计答题50道",ok:()=>st.attempts>=50},
 {id:"hundred",icon:"👑",name:"百题勇士",desc:"累计答题100道",ok:()=>st.attempts>=100},
 {id:"course1",icon:"🏅",name:"首关通关",desc:"完成1个课程关卡",ok:()=>st.done.length>=1},
 {id:"course5",icon:"🏆",name:"闯关达人",desc:"完成5个课程关卡",ok:()=>st.done.length>=5},
 {id:"accurate",icon:"🎯",name:"精准射手",desc:"答题满20道且正确率达到90%",ok:()=>st.attempts>=20&&st.correct/st.attempts>=.9},
 {id:"stars",icon:"🌟",name:"星星收藏家",desc:"累计拥有100颗星星",ok:()=>st.stars>=100}
];
function showAchievements(){
 const unlocked=ACHIEVEMENTS.filter(a=>a.ok()).length;
 const cards=ACHIEVEMENTS.map(a=>{const ok=a.ok();return `<div class="achievement-card ${ok?"unlocked":"locked"}"><div class="achievement-icon">${ok?a.icon:"🔒"}</div><div><b>${a.name}</b><p>${a.desc}</p></div><span>${ok?"已解锁":"未解锁"}</span></div>`}).join("");
 openModal("🏆","我的成就",`<div class="achievement-summary"><b>${unlocked}/${ACHIEVEMENTS.length}</b><span>已解锁成就</span></div><div class="achievement-list">${cards}</div>`);
}

function save(){ensureDaily();localStorage.setItem(KEY,JSON.stringify(st));header();renderMissionCard()}
function header(){
 const title=$("#title"); if(title && !title.querySelector("span")) title.textContent=cfg.appName||"峻峻数学大冒险";
 $("#ver").textContent=cfg.version||"V7.0 儿童游戏界面";
 $("#stars").textContent=st.stars;$("#done").textContent=st.done.length;$("#acc").textContent=st.attempts?Math.round(st.correct/st.attempts*100)+"%":"—";
 const ps=$("#profileStars");if(ps)ps.textContent=st.stars;
}
function tab(id){$$('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===id));$$('.panel').forEach(x=>x.classList.toggle('active',x.id===id));if(id==='report')report()}
function chooseGrade(g){grade=g;$("#gradeSelect").classList.add("hidden");$("#courseArea").classList.remove("hidden");$("#gradeTitle").textContent=g+"年级课程";renderCourses();play("click")}
function backGrades(){$("#gradeSelect").classList.remove("hidden");$("#courseArea").classList.add("hidden")}
function renderCourses(){const list=courses.filter(c=>c.grade===grade);$("#courses").innerHTML=list.map(c=>{const cs=st.courseStats[c.id]||{};const best=Number(cs.best||0);const played=Number(cs.rounds||0);return `<button class="course ${st.done.includes(c.id)?"done":""}" data-id="${c.id}"><div class="ico">${c.icon}</div><h3>${c.title}</h3><p>${c.desc}</p><div class="course-meta"><span>${played?`已练 ${played} 次`:`尚未练习`}</span><b>${played?`最佳 ${best}%`:"开始"}</b></div><div class="course-progress"><i style="width:${played?Math.max(6,best):6}%"></i></div></button>`}).join("");$$('.course').forEach(b=>b.onclick=()=>start(b.dataset.id))}
function start(id){course=courses.find(c=>c.id===id);if(!course){alert("课程入口不存在");return}const all=[...(bank[course.set]||[])];if(!all.length){alert("外接题库未加载");return}const hk="history_"+course.set;const recent=JSON.parse(localStorage.getItem(hk)||"[]");let picked=[];if(course.set==="g2_symbol"){const first={q:all[0],i:0};let pool=all.map((q,i)=>({q,i})).filter(x=>x.i!==0&&!recent.includes(x.i));if(pool.length<ROUND_SIZE-1)pool=all.map((q,i)=>({q,i})).filter(x=>x.i!==0);pool.sort(()=>Math.random()-.5);picked=[first,...pool.slice(0,Math.min(ROUND_SIZE-1,pool.length))];}else{let pool=all.map((q,i)=>({q,i})).filter(x=>!recent.includes(x.i));if(pool.length<ROUND_SIZE)pool=all.map((q,i)=>({q,i}));pool.sort(()=>Math.random()-.5);picked=pool.slice(0,Math.min(ROUND_SIZE,pool.length));}qs=picked.map(x=>x.q);localStorage.setItem(hk,JSON.stringify([...recent,...picked.map(x=>x.i)].slice(-300)));idx=0;session=0;sessionAttempts=0;tab("game");show()}
function show(){locked=false;closeTeacher();const q=qs[idx];$("#gameTitle").textContent=course.icon+" "+course.title;$("#count").textContent=(idx+1)+"/"+qs.length;$("#fill").style.width=(idx/qs.length*100)+"%";$("#question").textContent=q.prompt;$("#options").innerHTML=q.options.map((x,i)=>`<button class="opt" data-i="${i}">${x}</button>`).join("");$("#feedback").textContent="题型："+(q.kind||"同步训练")+"｜难度："+(q.difficulty||"提高")+"。请选择答案，或点击“普通话读题”。";$("#next").classList.add("hidden");$$('.opt').forEach(b=>b.onclick=()=>answer(+b.dataset.i))}
function answer(i){if(locked)return;locked=true;const q=qs[idx],ok=i===q.answer;ensureDaily();st.attempts++;st.daily.attempts++;sessionAttempts++;const cs=st.courseStats[course.id]||(st.courseStats[course.id]={attempts:0,correct:0,rounds:0,best:0});cs.attempts++;$$('.opt').forEach((b,n)=>{b.disabled=true;if(n===q.answer)b.classList.add("good");if(n===i&&!ok)b.classList.add("bad")});if(ok){st.correct++;st.daily.correct++;st.stars+=2;session++;cs.correct++;if(course.id==="mistake_retry"&&q.mistakeKey)st.mistakes=st.mistakes.filter(m=>m.key!==q.mistakeKey);$("#feedback").innerHTML="✅ 答对了！"+esc(q.explain||"");play("correct");celebrate(12);say("答对了，真厉害")}else{const key=[course.id,q.prompt,(q.options||[]).join("|")].join("::");const item={key,courseId:course.id,course:course.title,q:q.prompt,options:[...(q.options||[])],answer:q.answer,a:q.options[q.answer],explain:q.explain||"",kind:q.kind||"综合题",difficulty:q.difficulty||"巩固",wrongAt:Date.now()};st.mistakes=[item,...st.mistakes.filter(m=>(m.key||[m.courseId,m.q].join("::"))!==key)].slice(0,50);$("#feedback").innerHTML="💡 先别急，点“教我”看一步一步讲解。<br>正确答案：<b>"+esc(q.options[q.answer])+"</b><br>"+esc(q.explain||"");play("wrong");say("差一点，点教我，我们一步一步来")}save();$("#next").classList.remove("hidden")}
function next(){idx++;if(idx>=qs.length)return finish();show()}
function celebrate(n=18){const box=$("#celebration");if(!box)return;const icons=["⭐","🎉","✨","🎈","🏅"];for(let i=0;i<n;i++){const e=document.createElement("span");e.className="confetti";e.textContent=icons[i%icons.length];e.style.left=Math.random()*100+"%";e.style.animationDelay=Math.random()*.35+"s";box.appendChild(e);setTimeout(()=>e.remove(),1900)}}
function finish(){celebrate(30);ensureDaily();st.daily.courses++;const score=sessionAttempts?Math.round(session/sessionAttempts*100):0;const cs=st.courseStats[course.id]||(st.courseStats[course.id]={attempts:0,correct:0,rounds:0,best:0});cs.rounds=(cs.rounds||0)+1;cs.best=Math.max(Number(cs.best||0),score);cs.lastScore=score;cs.lastPlayed=Date.now();st.activity.unshift({date:Date.now(),course:course.title,score,correct:session,total:sessionAttempts});st.activity=st.activity.slice(0,30);if(!st.done.includes(course.id))st.done.push(course.id);st.stars+=5;save();$("#fill").style.width="100%";$("#question").innerHTML="🏆 闯关成功<br><small>答对 "+session+" / "+sessionAttempts+" 题 · 正确率 "+score+"%</small>";$("#options").innerHTML="";$("#feedback").textContent="完成奖励：5颗星星！课程最佳成绩已保存。";$("#next").classList.add("hidden");play("finish");say("闯关成功，峻峻太棒了");renderCourses()}
function report(){ensureDaily();const a=st.attempts?Math.round(st.correct/st.attempts*100):0;$("#reportStats").innerHTML=`<div class="rbox"><b>${st.attempts}</b>答题</div><div class="rbox"><b>${a}%</b>正确率</div><div class="rbox"><b>${st.stars}</b>星星</div><div class="rbox"><b>${st.done.length}</b>完成关卡</div>`;const ranked=Object.entries(st.courseStats).filter(([id,x])=>id!=="mistake_retry"&&x.attempts).map(([id,x])=>{const c=courses.find(z=>z.id===id);return {title:c?c.title:id,rate:Math.round(x.correct/x.attempts*100),attempts:x.attempts,best:x.best||0}}).sort((x,y)=>x.rate-y.rate).slice(0,3);const weak=ranked.length?`<div class="weak-box"><h3>需要优先巩固</h3>${ranked.map(x=>`<p><b>${esc(x.title)}</b><span>累计正确率 ${x.rate}% · 最佳 ${x.best}%</span></p>`).join("")}</div>`:"";$("#mistakes").innerHTML=weak+(st.mistakes.length?st.mistakes.slice(0,10).map(m=>`<div class="mistake-item"><b>${esc(m.course)}</b><p>${esc(m.q)}</p><small>正确答案：${esc(m.a)}</small></div>`).join(""):"🎉 暂时没有错题")}
function retryMistakes(){
 if(!st.mistakes.length){alert("暂时没有错题");return}
 const items=st.mistakes.slice(0,10).map(m=>{const opts=Array.isArray(m.options)&&m.options.length?m.options:[m.a,"再想一想","无法判断","以上都不对"];const ans=Number.isInteger(m.answer)?m.answer:Math.max(0,opts.indexOf(m.a));return {prompt:m.q,options:[...opts],answer:ans,explain:m.explain||("正确答案是："+m.a),kind:m.kind||"错题重练",difficulty:"巩固",mistakeKey:m.key}});
 course={id:"mistake_retry",icon:"🔁",title:"错题重练",set:"mistakes"};qs=items.sort(()=>Math.random()-.5);idx=0;session=0;sessionAttempts=0;tab("game");show();
}
function showQuickPractice(){openModal("🎯","口算训练",`<div class="tool-grid"><button data-quick="g1_addsub">一年级100以内加减</button><button data-quick="g2_mul">二年级乘法口诀</button><button data-quick="g2_div">除法与余数</button></div><p>选择后直接随机开始10题专项训练。</p>`);document.querySelectorAll("[data-quick]").forEach(b=>b.onclick=()=>{closeModal();const c=courses.find(x=>x.set===b.dataset.quick);if(c)start(c.id)})}
function startSymbolCourse(){const c=courses.find(x=>x.set==="g2_symbol");if(c)start(c.id);else alert("等量代换课程未加载")}
function showThinking(){openModal("🧠","思维拓展",`<div class="feature-copy"><h3>等量代换完整课程 · 1800道题</h3><p>包含8个层级：一层代换、连续代换、反向推理、混合计算、生活情境、天平、图形方程和综合挑战。</p><button id="startThinking" class="claim-button">开始等量代换挑战</button></div>`);setTimeout(()=>{const b=document.querySelector("#startThinking");if(b)b.onclick=()=>{closeModal();const c=courses.find(x=>x.set==="g2_symbol");if(c)start(c.id)}},0)}
function showTools(){openModal("🧮","数学工具",`<div class="achievement-list"><div class="achievement-card unlocked"><div class="achievement-icon">🔢</div><div><b>数位表</b><p>个位、十位、百位的组成练习。</p></div></div><div class="achievement-card unlocked"><div class="achievement-icon">📏</div><div><b>单位小助手</b><p>米、厘米、元、角、分和时间换算提示。</p></div></div><div class="achievement-card unlocked"><div class="achievement-icon">🧾</div><div><b>版本信息</b><p>V11长期版 Build005 学习系统版；共22680+道题、26个课程，新增每日任务、连续打卡、原题错题重练、课程正确率与最佳成绩，启动时自动检查题库结构。</p></div></div></div>`)}

function runtimeSelfTest(){
 const problems=[];
 if(!Array.isArray(courses)||!courses.length)problems.push("课程未加载");
 if(!bank||typeof bank!=="object")problems.push("题库未加载");
 for(const c of courses){const arr=bank[c.set];if(!Array.isArray(arr)||!arr.length)problems.push(c.title+"缺少题目");}
 return problems;
}
document.addEventListener("DOMContentLoaded",()=>{
 header();renderMissionCard();loadVoices();if(window.speechSynthesis)speechSynthesis.onvoiceschanged=loadVoices;
 if(!window.MATH_CONFIG||!window.MATH_COURSES||!window.MATH_QUESTIONS){$("#loadError").classList.remove("hidden");return}
 const selfProblems=runtimeSelfTest();if(selfProblems.length){$("#loadError").innerHTML="<b>启动自检未通过。</b><br>"+selfProblems.join("<br>");$("#loadError").classList.remove("hidden");return}
 $$('.tab').forEach(b=>b.onclick=()=>tab(b.dataset.tab));$$('.grade').forEach(b=>b.onclick=()=>chooseGrade(+b.dataset.grade));
 $("#back").onclick=backGrades;$("#next").onclick=next;$("#read").onclick=()=>say(qs[idx]?.prompt||"请先选择一道题");
 $("#voiceTest").onclick=()=>say("你好，我是普通话语音。峻峻，我们一起学数学吧。");
 $("#sound").onclick=()=>{sound=!sound;$("#sound").textContent=sound?"🔊 声音开":"🔇 声音关";if(sound){play("click");say("声音已开启")}};
 $("#dailyReward").onclick=showDailyReward;$("#rewardQuick").onclick=showDailyReward;
 $("#achievementBtn").onclick=showAchievements;$("#achievementQuick").onclick=showAchievements;
 $("#modalClose").onclick=closeModal;$("#featureModal").querySelectorAll("[data-close-modal]").forEach(x=>x.onclick=closeModal);
 const om=$("#openMissions");if(om)om.onclick=showMissions;const mtb=$("#missionTab");if(mtb)mtb.onclick=showMissions;const rm=$("#retryMistakes");if(rm)rm.onclick=retryMistakes;
 const ex=$("#exportRecord");if(ex)ex.onclick=()=>{const blob=new Blob([JSON.stringify({app:cfg.appName,version:cfg.version,exportedAt:new Date().toISOString(),data:st},null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="峻峻数学学习记录_"+localDay()+".json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
 const qp=$("#quickPractice");if(qp)qp.onclick=showQuickPractice;const th=$("#thinkingExpand");if(th)th.onclick=showThinking;const sd=$("#symbolDirectCard");if(sd){sd.onclick=startSymbolCourse;sd.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();startSymbolCourse()}}}const dst=$("#directSymbolTab");if(dst)dst.onclick=startSymbolCourse;const mt=$("#mathTools");if(mt)mt.onclick=showTools;
 $("#reset").onclick=()=>{const p=prompt("请输入家长密码");if(p===(cfg.parentPin||"2026")&&confirm("确定清除全部学习记录吗？")){localStorage.removeItem(KEY);location.reload()}};
});

const teachBtn=$("#teach"),teacherSpeak=$("#teacherSpeak"),teacherClose=$("#teacherClose");
if(teachBtn)teachBtn.onclick=showTeacher;
if(teacherSpeak)teacherSpeak.onclick=speakTeacher;
if(teacherClose)teacherClose.onclick=closeTeacher;

})();
