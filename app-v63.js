
(function(){
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const cfg=window.MATH_CONFIG||{}, courses=window.MATH_COURSES||[], bank=window.MATH_QUESTIONS||{};
const KEY="junjun_math_v6";
let st=JSON.parse(localStorage.getItem(KEY)||'{"stars":0,"done":[],"attempts":0,"correct":0,"mistakes":[]}');
let grade=2, course=null, qs=[], idx=0, session=0, sound=true, locked=false;
let voiceLang=localStorage.getItem("junjun_math_voice_lang_v63")||"zh-CN";
let ttsAudio=null;
const ROUND_SIZE=10;
const snd={click:new Audio("./click.wav"),correct:new Audio("./correct.wav"),wrong:new Audio("./wrong.wav"),finish:new Audio("./finish.wav")};
function play(x){if(!sound)return;try{snd[x].currentTime=0;snd[x].play()}catch(e){}}
function updateVoiceStatus(msg){
 const el=$("#voiceStatus"); if(!el)return;
 el.textContent=msg||`当前：${voiceLang==="yue"?"广东话":"普通话"}｜在线语音优先，系统语音仅作后备`;
}
function applyVoiceLang(lang){
 voiceLang=lang==="yue"?"yue":"zh-CN";
 localStorage.setItem("junjun_math_voice_lang_v63",voiceLang);
 updateVoiceStatus();
}
function systemFallback(text,onDone){
 if(!window.speechSynthesis){if(onDone)onDone();return;}
 speechSynthesis.cancel();
 const u=new SpeechSynthesisUtterance(String(text));
 u.lang=voiceLang==="yue"?"zh-HK":"zh-CN";
 u.rate=cfg.speechRate||.9; u.pitch=cfg.speechPitch||1;
 const voices=speechSynthesis.getVoices()||[];
 const wanted=voiceLang==="yue"?["zh-HK","yue-HK"]:["zh-CN","cmn-CN"];
 const v=voices.find(x=>wanted.some(k=>String(x.lang||"").toLowerCase().startsWith(k.toLowerCase())));
 if(v)u.voice=v;
 u.onend=()=>onDone&&onDone(); u.onerror=()=>onDone&&onDone();
 speechSynthesis.speak(u);
}
function say(text,onDone){
 if(!sound)return;
 const t=String(text||"").trim(); if(!t)return;
 try{if(ttsAudio){ttsAudio.pause();ttsAudio.src="";}}catch(e){}
 const tl=voiceLang==="yue"?"yue":"zh-CN";
 const url="https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl="+encodeURIComponent(tl)+"&q="+encodeURIComponent(t.slice(0,180));
 const a=new Audio(); ttsAudio=a; a.preload="auto"; a.src=url;
 let fellBack=false;
 const fallback=()=>{if(fellBack)return;fellBack=true;updateVoiceStatus(`在线${tl==="yue"?"广东话":"普通话"}暂不可用，已使用系统后备语音`);systemFallback(t,onDone)};
 a.onplay=()=>updateVoiceStatus(`正在使用在线${tl==="yue"?"广东话":"普通话"}语音`);
 a.onended=()=>{updateVoiceStatus();onDone&&onDone()};
 a.onerror=fallback;
 const pr=a.play(); if(pr&&pr.catch)pr.catch(fallback);
}
function save(){localStorage.setItem(KEY,JSON.stringify(st));header()}
function header(){$("#title").textContent=cfg.appName||"峻峻数学大冒险";$("#ver").textContent=cfg.version||"V3.0 简体版";$("#stars").textContent=st.stars;$("#done").textContent=st.done.length;$("#acc").textContent=st.attempts?Math.round(st.correct/st.attempts*100)+"%":"—"}
function tab(id){$$(".tab").forEach(x=>x.classList.toggle("active",x.dataset.tab===id));$$(".panel").forEach(x=>x.classList.toggle("active",x.id===id));if(id==="report")report()}
function chooseGrade(g){grade=g;$("#gradeSelect").classList.add("hidden");$("#courseArea").classList.remove("hidden");$("#gradeTitle").textContent=g+"年级课程";renderCourses();play("click")}
function backGrades(){$("#gradeSelect").classList.remove("hidden");$("#courseArea").classList.add("hidden")}
function renderCourses(){const list=courses.filter(c=>c.grade===grade);$("#courses").innerHTML=list.map(c=>`<button class="course ${st.done.includes(c.id)?"done":""}" data-id="${c.id}"><div class="ico">${c.icon}</div><h3>${c.title}</h3><p>${c.desc}</p></button>`).join("");$$(".course").forEach(b=>b.onclick=()=>start(b.dataset.id))}
function start(id){course=courses.find(c=>c.id===id);const all=[...(bank[course.set]||[])];if(!all.length){alert("外接题库未加载");return}const hk="history_"+course.set;const recent=JSON.parse(localStorage.getItem(hk)||"[]");let pool=all.map((q,i)=>({q,i})).filter(x=>!recent.includes(x.i));if(pool.length<ROUND_SIZE)pool=all.map((q,i)=>({q,i}));pool.sort(()=>Math.random()-.5);const picked=pool.slice(0,Math.min(ROUND_SIZE,pool.length));qs=picked.map(x=>x.q);localStorage.setItem(hk,JSON.stringify([...recent,...picked.map(x=>x.i)].slice(-300)));idx=0;session=0;tab("game");show()}
function show(){locked=false;const q=qs[idx];$("#gameTitle").textContent=course.icon+" "+course.title;$("#count").textContent=(idx+1)+"/"+qs.length;$("#fill").style.width=(idx/qs.length*100)+"%";$("#question").textContent=q.prompt;$("#options").innerHTML=q.options.map((x,i)=>`<button class="opt" data-i="${i}">${x}</button>`).join("");$("#feedback").textContent="题型："+(q.kind||"同步训练")+"｜难度："+(q.difficulty||"提高")+"。请选择答案，或点击“读题”。";$("#next").classList.add("hidden");$$(".opt").forEach(b=>b.onclick=()=>answer(+b.dataset.i));setTimeout(()=>say(q.prompt),250)}
function answer(i){if(locked)return;locked=true;const q=qs[idx],ok=i===q.answer;st.attempts++;$$(".opt").forEach((b,n)=>{b.disabled=true;if(n===q.answer)b.classList.add("good");if(n===i&&!ok)b.classList.add("bad")});if(ok){st.correct++;st.stars+=2;session++;$("#feedback").innerHTML="✅ 答对了！"+q.explain;play("correct");say("答对了，真厉害")}else{st.mistakes.unshift({course:course.title,q:q.prompt,a:q.options[q.answer]});st.mistakes=st.mistakes.slice(0,20);$("#feedback").innerHTML="💡 正确答案：<b>"+q.options[q.answer]+"</b><br>"+q.explain;play("wrong");say("差一点，正确答案是"+q.options[q.answer])}save();$("#next").classList.remove("hidden")}
function next(){idx++;if(idx>=qs.length)return finish();show()}
function finish(){if(!st.done.includes(course.id))st.done.push(course.id);st.stars+=5;save();$("#fill").style.width="100%";$("#question").innerHTML="🏆 闯关成功<br><small>答对 "+session+" / "+qs.length+" 题</small>";$("#options").innerHTML="";$("#feedback").textContent="完成奖励：5颗星星！";$("#next").classList.add("hidden");play("finish");say("闯关成功，峻峻太棒了");renderCourses()}
function report(){const a=st.attempts?Math.round(st.correct/st.attempts*100):0;$("#reportStats").innerHTML=`<div class="rbox"><b>${st.attempts}</b>答题</div><div class="rbox"><b>${a}%</b>正确率</div><div class="rbox"><b>${st.stars}</b>星星</div><div class="rbox"><b>${st.done.length}</b>完成关卡</div>`;$("#mistakes").innerHTML=st.mistakes.length?st.mistakes.map(m=>`<p><b>${m.course}</b><br>${m.q}<br>答案：${m.a}</p>`).join("<hr>"):"🎉 暂时没有错题"}
document.addEventListener("DOMContentLoaded",()=>{
header();
const voiceSel=$("#voiceLang");voiceSel.value=voiceLang;
voiceSel.onchange=()=>{applyVoiceLang(voiceSel.value);say(voiceLang==="yue"?"你好，我係廣東話語音":"你好，我是普通话语音")};
$("#voiceTest").onclick=()=>say(voiceLang==="yue"?"你好，我係廣東話，語音切換成功":"你好，我是普通话，语音切换成功");
applyVoiceLang(voiceLang);
if(!window.MATH_CONFIG||!window.MATH_COURSES||!window.MATH_QUESTIONS){$("#loadError").classList.remove("hidden");return}
$$(".tab").forEach(b=>b.onclick=()=>tab(b.dataset.tab));
$$(".grade").forEach(b=>b.onclick=()=>chooseGrade(+b.dataset.grade));
$("#back").onclick=backGrades;$("#next").onclick=next;$("#read").onclick=()=>say(qs[idx]?.prompt||"");
$("#sound").onclick=()=>{sound=!sound;$("#sound").textContent=sound?"🔊 声音开":"🔇 声音关";if(sound){play("click");say("声音已开启")}};
$("#reset").onclick=()=>{const p=prompt("请输入家长密码");if(p===(cfg.parentPin||"2026")&&confirm("确定清除全部学习记录吗？")){localStorage.removeItem(KEY);location.reload()}};
});
})();
