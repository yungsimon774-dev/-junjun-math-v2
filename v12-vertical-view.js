import {screenKeyboardHTML,mountScreenKeyboard} from './v12-screen-keyboard.js?v=120170';
import {verticalProblem,checkVertical,createVerticalRound,restoreVerticalRound,verticalSummary} from './v12-vertical.js?v=120170';
import {escapeHTML as esc} from './v12-tutor.js?v=120170';
export function mountVertical(root,{draft,onSave}={}){
  let round=restoreVerticalRound(draft),submitted=Boolean(round?.pending),feedback='';let selection=round?.op||'mixed',digits=round?.digits||2;
  let keyboard=null;
  const save=()=>onSave?.(round,round?.answers.length===5?round:null);
  const read=()=>Object.fromEntries([...root.querySelectorAll('[data-vfield]')].map(el=>[el.dataset.vfield,el.value]));
  const render=()=>{
    keyboard?.destroy();keyboard=null;
    const index=round?.answers.length||0;const summary=round?verticalSummary(round):null;
    root.innerHTML=`<div class="vertical-practice"><p>每组5题，检查完整竖式过程。只有所有格填齐才会提交；第一次提交后计分。使用提示会单独记录。</p><div class="vertical-controls"><label>运算<select id="verticalOp">${[['mixed','四则混合'],['+','加法'],['-','减法'],['×','乘法（多位数×一位数）'],['÷','除法（一位数除数）']].map(([v,t])=>`<option value="${v}" ${v===selection?'selected':''}>${t}</option>`).join('')}</select></label><label>范围<select id="verticalDigits"><option value="2" ${digits===2?'selected':''}>两位数</option><option value="3" ${digits===3?'selected':''}>三位数</option></select></label><button id="verticalNew">${round?'重新出5题':'开始5题测试'}</button></div><small>竖式测试单独保存，不计入课程掌握率或星星奖励。</small><div id="verticalBody"></div></div>`;
    root.querySelector('#verticalOp').onchange=e=>selection=e.target.value;
    root.querySelector('#verticalDigits').onchange=e=>digits=Number(e.target.value);
    root.querySelector('#verticalNew').onclick=()=>{
      if(round&&round.answers.length<5&&!confirm('重新出题会替换这组未完成的测试，继续吗？'))return;
      round=createVerticalRound(selection,digits);submitted=false;feedback='';save();render();
    };
    const body=root.querySelector('#verticalBody');if(!round)return;
    if(index===5){
      body.innerHTML=`<h3>本组完成：${summary.correct}/5题竖式全对</h3><p>其中未用提示全对 ${summary.independent}/5题。</p><div class="vertical-review">${round.questions.map((q,i)=>{const p=verticalProblem(q.op,q.a,q.b);const r=checkVertical(p,round.answers[i].values);return `<details><summary>第${i+1}题：${esc(p.title)} · ${r.correct?'全对':'需要复习'}${round.answers[i].hintUsed?' · 用过提示':''}</summary><p>结果：${p.result}${p.remainder?'，余'+p.remainder:''}</p>${board(p,round.answers[i].values,true)}<p>${esc(p.hint)}</p>${r.wrong.length?`<p>需复习的格：${r.wrong.map(k=>esc(p.rows.flatMap(r=>r.cells).find(c=>c.key===k)?.label)+' 应填 '+p.fields[k]).join('；')}</p>`:''}</details>`}).join('')}</div>`;return;
    }
    const q=round.questions[index],p=verticalProblem(q.op,q.a,q.b);
    if(submitted){round.values=round.pending.values;feedback=checkVertical(p,round.values).correct?'✅ 竖式过程和结果都正确。':'这次竖式有需要复习的格，完成本组后可以看解析。'}
    body.innerHTML=`<h3>第${index+1}/5题：${esc(p.title)}</h3><p>${p.op==='-'?'上方“调整后”一行填写退位处理后用于相减的数（可能大于9）。':p.op==='÷'?'先填上方的商，再填各步相乘结果和相减余数；蓝色数字是落下的一位。':'上方小格填写向该数位的进位，没有进位填0。'}</p>${board(p,round.values,submitted)}${!submitted?screenKeyboardHTML():""}<div class="vertical-actions"><button id="verticalHint">解题提示</button>${submitted?'<button id="verticalNext">下一题</button>':'<button id="verticalCheck">提交本题竖式</button>'}</div><p id="verticalFeedback" role="status">${esc(feedback)}</p><p id="verticalHintText">${round.hintUsed?esc(p.hint):''}</p>`;
    if(submitted)checkVertical(p,round.values).wrong.forEach(k=>root.querySelector(`[data-vfield="${k}"]`).classList.add('v-wrong'));
    root.querySelectorAll('[data-vfield]').forEach(el=>{
      el.oninput=()=>{round.values=read();el.classList.remove('v-wrong');save()};
      el.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();root.querySelector('#verticalCheck')?.click()}};
    });
    if(!submitted)keyboard=mountScreenKeyboard(body,{selector:'[data-vfield]',autoAdvance:true});
    root.querySelector('#verticalHint').onclick=()=>{round.hintUsed=true;root.querySelector('#verticalHintText').textContent=p.hint;save()};
    root.querySelector('#verticalCheck')?.addEventListener('click',()=>{
      round.values=read();const result=checkVertical(p,round.values);
      if(!result.complete){root.querySelector('#verticalFeedback').textContent='请把全部数字格填完整（没有进位填0）。';result.missing.forEach(k=>root.querySelector(`[data-vfield="${k}"]`).classList.add('v-wrong'));return}
      round.pending={values:{...round.values},hintUsed:round.hintUsed};submitted=true;feedback=result.correct?'✅ 竖式过程和结果都正确。':'这次竖式有需要复习的格，红框表示该格需要检查。本题已记录，完成本组后可以看解析。';
      // Submitted answer is kept in the current draft until Next is selected.
      save();render();
      result.wrong.forEach(k=>root.querySelector(`[data-vfield="${k}"]`).classList.add('v-wrong'));
    });
    if(index===4&&submitted)root.querySelector('#verticalNext').textContent='完成并看结果';
    root.querySelector('#verticalNext')?.addEventListener('click',()=>{
      round.answers.push(round.pending);round.pending=null;round.values={};round.hintUsed=false;submitted=false;feedback='';save();render();
    });
  };
  function board(p,values,locked){
    return `<div class="vertical-board" style="--vcols:${p.width}" role="group" aria-label="${esc(p.title)}竖式">${p.rows.map(row=>`<div class="vertical-line ${row.cls||''}"><span class="vertical-label">${esc(row.label)}</span>${row.cells.map(c=>c.key?`<input data-vfield="${c.key}" aria-label="${esc(c.label)}" type="text" inputmode="none" readonly autocomplete="off" maxlength="${c.key.startsWith('work')?2:1}" value="${esc(typeof values[c.key]==='string'?values[c.key]:'')}" ${locked?'disabled':''}>`:`<span class="vertical-digit ${c.down?'vertical-down':''}">${esc(c.text)}</span>`).join('')}</div>`).join('')}</div>`;
  }
  render();return ()=>keyboard?.destroy();
}
