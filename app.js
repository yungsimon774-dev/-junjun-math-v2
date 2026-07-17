
(function(){
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const cfg=window.MATH_CONFIG||{}, courses=window.MATH_COURSES||[], bank=window.MATH_QUESTIONS||{};
const KEY="junjun_math_v2";
let st=JSON.parse(localStorage.getItem(KEY)||'{"stars":0,"done":[],"attempts":0,"correct":0,"mistakes":[]}');
let grade=2, course=null, qs=[], idx=0, session=0, sound=true, locked=false;
const snd={click:new Audio("./click.wav"),correct:new Audio("./correct.wav"),wrong:new Audio("./wrong.wav"),finish:new Audio("./finish.wav")};
function play(x){if(!sound)return;try{snd[x].currentTime=0;snd[x].play()}catch(e){}}
function say(t){if(!sound||!window.speechSynthesis)return; speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang="zh-HK";u.rate=cfg.speechRate||.9;u.pitch=cfg.speechPitch||1;speechSynthesis.speak(u)}
function save(){localStorage.setItem(KEY,JSON.stringify(st));header()}
function header(){$("#title").textContent=cfg.appName||"峻峻數學大冒險";$("#ver").textContent=cfg.version||"V2.0";$("#stars").textContent=st.stars;$("#done").textContent=st.done.length;$("#acc").textContent=st.attempts?Math.round(st.correct/st.attempts*100)+"%":"—"}
function tab(id){$$(".tab").forEach(x=>x.classList.toggle("active",x.dataset.tab===id));$$(".panel").forEach(x=>x.classList.toggle("active",x.id===id));if(id==="report")report()}
function chooseGrade(g){grade=g;$("#gradeSelect").classList.add("hidden");$("#courseArea").classList.remove("hidden");$("#gradeTitle").textContent=g+"年級課程";renderCourses();play("click")}
function backGrades(){$("#gradeSelect").classList.remove("hidden");$("#courseArea").classList.add("hidden")}
function renderCourses(){const list=courses.filter(c=>c.grade===grade);$("#courses").innerHTML=list.map(c=>`<button class="course ${st.done.includes(c.id)?"done":""}" data-id="${c.id}"><div class="ico">${c.icon}</div><h3>${c.title}</h3><p>${c.desc}</p></button>`).join("");$$(".course").forEach(b=>b.onclick=()=>start(b.dataset.id))}
function start(id){course=courses.find(c=>c.id===id);qs=[...(bank[course.set]||[])].sort(()=>Math.random()-.5);if(!qs.length){alert("此外接題庫未載入");return}idx=0;session=0;tab("game");show()}
function show(){locked=false;const q=qs[idx];$("#gameTitle").textContent=course.icon+" "+course.title;$("#count").textContent=(idx+1)+"/"+qs.length;$("#fill").style.width=(idx/qs.length*100)+"%";$("#question").textContent=q.prompt;$("#options").innerHTML=q.options.map((x,i)=>`<button class="opt" data-i="${i}">${x}</button>`).join("");$("#feedback").textContent="請選答案，或按「讀題」。";$("#next").classList.add("hidden");$$(".opt").forEach(b=>b.onclick=()=>answer(+b.dataset.i));setTimeout(()=>say(q.prompt),250)}
function answer(i){if(locked)return;locked=true;const q=qs[idx],ok=i===q.answer;st.attempts++;$$(".opt").forEach((b,n)=>{b.disabled=true;if(n===q.answer)b.classList.add("good");if(n===i&&!ok)b.classList.add("bad")});if(ok){st.correct++;st.stars+=2;session++;$("#feedback").innerHTML="✅ 答對了！"+q.explain;play("correct");say("答對了，真厲害")}else{st.mistakes.unshift({course:course.title,q:q.prompt,a:q.options[q.answer]});st.mistakes=st.mistakes.slice(0,20);$("#feedback").innerHTML="💡 正確答案：<b>"+q.options[q.answer]+"</b><br>"+q.explain;play("wrong");say("差一點，正確答案是"+q.options[q.answer])}save();$("#next").classList.remove("hidden")}
function next(){idx++;if(idx>=qs.length)return finish();show()}
function finish(){if(!st.done.includes(course.id))st.done.push(course.id);st.stars+=5;save();$("#fill").style.width="100%";$("#question").innerHTML="🏆 闖關成功<br><small>答對 "+session+" / "+qs.length+" 題</small>";$("#options").innerHTML="";$("#feedback").textContent="完成獎勵：5顆星星！";$("#next").classList.add("hidden");play("finish");say("闖關成功，峻峻太棒了");renderCourses()}
function report(){const a=st.attempts?Math.round(st.correct/st.attempts*100):0;$("#reportStats").innerHTML=`<div class="rbox"><b>${st.attempts}</b>答題</div><div class="rbox"><b>${a}%</b>正確率</div><div class="rbox"><b>${st.stars}</b>星星</div><div class="rbox"><b>${st.done.length}</b>完成關卡</div>`;$("#mistakes").innerHTML=st.mistakes.length?st.mistakes.map(m=>`<p><b>${m.course}</b><br>${m.q}<br>答案：${m.a}</p>`).join("<hr>"):"🎉 暫時沒有錯題"}
document.addEventListener("DOMContentLoaded",()=>{
header();
if(!window.MATH_CONFIG||!window.MATH_COURSES||!window.MATH_QUESTIONS){$("#loadError").classList.remove("hidden");return}
$$(".tab").forEach(b=>b.onclick=()=>tab(b.dataset.tab));
$$(".grade").forEach(b=>b.onclick=()=>chooseGrade(+b.dataset.grade));
$("#back").onclick=backGrades;$("#next").onclick=next;$("#read").onclick=()=>say(qs[idx]?.prompt||"");
$("#sound").onclick=()=>{sound=!sound;$("#sound").textContent=sound?"🔊 聲音開":"🔇 聲音關";if(sound){play("click");say("聲音已開啟")}};
$("#reset").onclick=()=>{const p=prompt("輸入家長密碼");if(p===(cfg.parentPin||"2026")&&confirm("清除全部紀錄？")){localStorage.removeItem(KEY);location.reload()}};
});
})();
