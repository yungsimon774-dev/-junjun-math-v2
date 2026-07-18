(function(){
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const cfg=window.MATH_CONFIG||{}, courses=window.MATH_COURSES||[], bank=window.MATH_QUESTIONS||{};
const KEY="junjun_math_v7";
let st=JSON.parse(localStorage.getItem(KEY)||'{"stars":0,"done":[],"attempts":0,"correct":0,"mistakes":[]}');
let grade=2, course=null, qs=[], idx=0, session=0, sound=true, locked=false;
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
function save(){localStorage.setItem(KEY,JSON.stringify(st));header()}
function header(){
 const title=$("#title"); if(title && !title.querySelector("span")) title.textContent=cfg.appName||"峻峻数学大冒险";
 $("#ver").textContent=cfg.version||"V7.0 儿童游戏界面";
 $("#stars").textContent=st.stars;$("#done").textContent=st.done.length;$("#acc").textContent=st.attempts?Math.round(st.correct/st.attempts*100)+"%":"—";
 const ps=$("#profileStars");if(ps)ps.textContent=st.stars;
}
function tab(id){$$('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===id));$$('.panel').forEach(x=>x.classList.toggle('active',x.id===id));if(id==='report')report()}
function chooseGrade(g){grade=g;$("#gradeSelect").classList.add("hidden");$("#courseArea").classList.remove("hidden");$("#gradeTitle").textContent=g+"年级课程";renderCourses();play("click")}
function backGrades(){$("#gradeSelect").classList.remove("hidden");$("#courseArea").classList.add("hidden")}
function renderCourses(){const list=courses.filter(c=>c.grade===grade);$("#courses").innerHTML=list.map(c=>`<button class="course ${st.done.includes(c.id)?"done":""}" data-id="${c.id}"><div class="ico">${c.icon}</div><h3>${c.title}</h3><p>${c.desc}</p><div class="course-progress"><i style="width:${st.done.includes(c.id)?100:6}%"></i></div></button>`).join("");$$('.course').forEach(b=>b.onclick=()=>start(b.dataset.id))}
function start(id){course=courses.find(c=>c.id===id);const all=[...(bank[course.set]||[])];if(!all.length){alert("外接题库未加载");return}const hk="history_"+course.set;const recent=JSON.parse(localStorage.getItem(hk)||"[]");let pool=all.map((q,i)=>({q,i})).filter(x=>!recent.includes(x.i));if(pool.length<ROUND_SIZE)pool=all.map((q,i)=>({q,i}));pool.sort(()=>Math.random()-.5);const picked=pool.slice(0,Math.min(ROUND_SIZE,pool.length));qs=picked.map(x=>x.q);localStorage.setItem(hk,JSON.stringify([...recent,...picked.map(x=>x.i)].slice(-300)));idx=0;session=0;tab("game");show()}
function show(){locked=false;const q=qs[idx];$("#gameTitle").textContent=course.icon+" "+course.title;$("#count").textContent=(idx+1)+"/"+qs.length;$("#fill").style.width=(idx/qs.length*100)+"%";$("#question").textContent=q.prompt;$("#options").innerHTML=q.options.map((x,i)=>`<button class="opt" data-i="${i}">${x}</button>`).join("");$("#feedback").textContent="题型："+(q.kind||"同步训练")+"｜难度："+(q.difficulty||"提高")+"。请选择答案，或点击“普通话读题”。";$("#next").classList.add("hidden");$$('.opt').forEach(b=>b.onclick=()=>answer(+b.dataset.i))}
function answer(i){if(locked)return;locked=true;const q=qs[idx],ok=i===q.answer;st.attempts++;$$('.opt').forEach((b,n)=>{b.disabled=true;if(n===q.answer)b.classList.add("good");if(n===i&&!ok)b.classList.add("bad")});if(ok){st.correct++;st.stars+=2;session++;$("#feedback").innerHTML="✅ 答对了！"+q.explain;play("correct");celebrate(12);say("答对了，真厉害")}else{st.mistakes.unshift({course:course.title,q:q.prompt,a:q.options[q.answer]});st.mistakes=st.mistakes.slice(0,20);$("#feedback").innerHTML="💡 正确答案：<b>"+q.options[q.answer]+"</b><br>"+q.explain;play("wrong");say("差一点，正确答案是"+q.options[q.answer])}save();$("#next").classList.remove("hidden")}
function next(){idx++;if(idx>=qs.length)return finish();show()}
function celebrate(n=18){const box=$("#celebration");if(!box)return;const icons=["⭐","🎉","✨","🎈","🏅"];for(let i=0;i<n;i++){const e=document.createElement("span");e.className="confetti";e.textContent=icons[i%icons.length];e.style.left=Math.random()*100+"%";e.style.animationDelay=Math.random()*.35+"s";box.appendChild(e);setTimeout(()=>e.remove(),1900)}}
function finish(){celebrate(30);if(!st.done.includes(course.id))st.done.push(course.id);st.stars+=5;save();$("#fill").style.width="100%";$("#question").innerHTML="🏆 闯关成功<br><small>答对 "+session+" / "+qs.length+" 题</small>";$("#options").innerHTML="";$("#feedback").textContent="完成奖励：5颗星星！";$("#next").classList.add("hidden");play("finish");say("闯关成功，峻峻太棒了");renderCourses()}
function report(){const a=st.attempts?Math.round(st.correct/st.attempts*100):0;$("#reportStats").innerHTML=`<div class="rbox"><b>${st.attempts}</b>答题</div><div class="rbox"><b>${a}%</b>正确率</div><div class="rbox"><b>${st.stars}</b>星星</div><div class="rbox"><b>${st.done.length}</b>完成关卡</div>`;$("#mistakes").innerHTML=st.mistakes.length?st.mistakes.map(m=>`<p><b>${m.course}</b><br>${m.q}<br>答案：${m.a}</p>`).join("<hr>"):"🎉 暂时没有错题"}
document.addEventListener("DOMContentLoaded",()=>{
 header();loadVoices();if(window.speechSynthesis)speechSynthesis.onvoiceschanged=loadVoices;
 if(!window.MATH_CONFIG||!window.MATH_COURSES||!window.MATH_QUESTIONS){$("#loadError").classList.remove("hidden");return}
 $$('.tab').forEach(b=>b.onclick=()=>tab(b.dataset.tab));$$('.grade').forEach(b=>b.onclick=()=>chooseGrade(+b.dataset.grade));
 $("#back").onclick=backGrades;$("#next").onclick=next;$("#read").onclick=()=>say(qs[idx]?.prompt||"请先选择一道题");
 $("#voiceTest").onclick=()=>say("你好，我是普通话语音。峻峻，我们一起学数学吧。");
 $("#sound").onclick=()=>{sound=!sound;$("#sound").textContent=sound?"🔊 声音开":"🔇 声音关";if(sound){play("click");say("声音已开启")}};
 $("#reset").onclick=()=>{const p=prompt("请输入家长密码");if(p===(cfg.parentPin||"2026")&&confirm("确定清除全部学习记录吗？")){localStorage.removeItem(KEY);location.reload()}};
});
})();
