
(function(){
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const cfg=window.MATH_CONFIG||{}, courses=window.MATH_COURSES||[], bank=window.MATH_QUESTIONS||{};
const KEY="junjun_math_v6";
let st=JSON.parse(localStorage.getItem(KEY)||'{"stars":0,"done":[],"attempts":0,"correct":0,"mistakes":[]}');
let grade=2, course=null, qs=[], idx=0, session=0, sound=true, locked=false;
let voiceProfile=localStorage.getItem("junjun_math_voice_profile_v61")||"zh-CN-female";
let voiceLang=voiceProfile.startsWith("zh-HK-")?"zh-HK":"zh-CN";
let voiceGender=voiceProfile.includes("-male")?"male":"female";
let voiceReady=false;
const ROUND_SIZE=10;
const snd={click:new Audio("./click.wav"),correct:new Audio("./correct.wav"),wrong:new Audio("./wrong.wav"),finish:new Audio("./finish.wav")};
function play(x){if(!sound)return;try{snd[x].currentTime=0;snd[x].play()}catch(e){}}
function normLang(x){return String(x||"").replace("_","-").toLowerCase()}
function voicesFor(lang){
 const target=normLang(lang), voices=(window.speechSynthesis?speechSynthesis.getVoices():[]);
 // 只允许同一地区语言，普通话绝不回退到粤语，粤语也绝不回退到普通话。
 return voices.filter(v=>{
   const l=normLang(v.lang);
   if(target==="zh-cn") return l==="zh-cn"||l==="cmn-cn"||l==="zh-hans-cn";
   if(target==="zh-hk") return l==="zh-hk"||l==="yue-hk"||l==="zh-hant-hk";
   return l===target;
 });
}
function pickVoice(lang,gender){
 const list=voicesFor(lang);
 if(!list.length)return null;
 const male=/\bmale\b|yunxi|yunyang|kangkang|daniel|aaron|li-mu|li mu|yunze|yun jian/i;
 const female=/\bfemale\b|tingting|ting-ting|sinji|sin-ji|meijia|mei-jia|xiaoxiao|huihui|yaoyao|sandy|li na|lina/i;
 const matcher=gender==="male"?male:female;
 return list.find(v=>matcher.test(v.name+" "+v.voiceURI))||list[gender==="male"&&list.length>1?1:0]||list[0];
}
function voiceLabel(v){return v?`${v.name}（${v.lang}）`:"系统未提供对应语音"}
function updateVoiceStatus(){
 const el=$("#voiceStatus");if(!el)return;
 const v=pickVoice(voiceLang,voiceGender);
 el.textContent=`当前：${voiceLang==="zh-HK"?"广东话":"普通话"}·${voiceGender==="male"?"男声":"女声"}｜实际：${voiceLabel(v)}`;
}
function applyVoiceProfile(profile){
 voiceProfile=profile;
 voiceLang=profile.startsWith("zh-HK-")?"zh-HK":"zh-CN";
 voiceGender=profile.includes("-male")?"male":"female";
 localStorage.setItem("junjun_math_voice_profile_v61",profile);
 updateVoiceStatus();
}
function say(t,onDone){
 if(!sound||!window.speechSynthesis)return;
 speechSynthesis.cancel();
 const u=new SpeechSynthesisUtterance(String(t));
 u.lang=voiceLang;u.rate=cfg.speechRate||.9;u.pitch=cfg.speechPitch||1;
 const v=pickVoice(voiceLang,voiceGender);
 if(v)u.voice=v; // 找不到时不指定 voice，只用 u.lang 让系统按正确语言选择。
 u.onend=()=>{if(onDone)onDone(v)};
 u.onerror=()=>{if(onDone)onDone(v)};
 speechSynthesis.speak(u);
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
const voiceSel=$("#voiceLang");voiceSel.value=voiceProfile;
voiceSel.onchange=()=>{applyVoiceProfile(voiceSel.value);const text=voiceLang==="zh-HK"?(voiceGender==="male"?"你好，我係廣東話男聲":"你好，我係廣東話女聲"):(voiceGender==="male"?"你好，我是普通话男声":"你好，我是普通话女声");say(text)};
$("#voiceTest").onclick=()=>{const text=voiceLang==="zh-HK"?(voiceGender==="male"?"你好，我係廣東話男聲，語音切換成功":"你好，我係廣東話女聲，語音切換成功"):(voiceGender==="male"?"你好，我是普通话男声，语音切换成功":"你好，我是普通话女声，语音切换成功");say(text,updateVoiceStatus)};
if(window.speechSynthesis){
 const refresh=()=>{voiceReady=true;updateVoiceStatus()};
 speechSynthesis.getVoices();speechSynthesis.onvoiceschanged=refresh;
 setTimeout(refresh,300);setTimeout(refresh,1200);
}
applyVoiceProfile(voiceProfile);
if(!window.MATH_CONFIG||!window.MATH_COURSES||!window.MATH_QUESTIONS){$("#loadError").classList.remove("hidden");return}
$$(".tab").forEach(b=>b.onclick=()=>tab(b.dataset.tab));
$$(".grade").forEach(b=>b.onclick=()=>chooseGrade(+b.dataset.grade));
$("#back").onclick=backGrades;$("#next").onclick=next;$("#read").onclick=()=>say(qs[idx]?.prompt||"");
$("#sound").onclick=()=>{sound=!sound;$("#sound").textContent=sound?"🔊 声音开":"🔇 声音关";if(sound){play("click");say("声音已开启")}};
$("#reset").onclick=()=>{const p=prompt("请输入家长密码");if(p===(cfg.parentPin||"2026")&&confirm("确定清除全部学习记录吗？")){localStorage.removeItem(KEY);location.reload()}};
});
})();
