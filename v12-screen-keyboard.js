// Always rendered in the page. Read-only fields suppress mobile native keyboards.
export function screenKeyboardHTML({operators=false}={}){
  const key=(value,label=value)=>`<button type="button" data-screen-key="${value}" aria-label="输入${label}">${label}</button>`;
  return `<div class="screen-keyboard" role="group" aria-label="屏幕数学键盘"><div class="screen-target" aria-live="polite">点选要填写的格子</div><div class="screen-digits">${['1','2','3','4','5','6','7','8','9','0'].map(n=>key(n)).join('')}</div>${operators?`<div class="screen-operators">${['+','-','×','÷','='].map(n=>key(n,n==='-'?'−':n)).join('')}</div>`:''}<div class="screen-edit ${operators?'with-decimals':''}">${operators?key('.')+key('±'):''}<button type="button" data-screen-action="backspace" aria-label="删除一位">⌫</button><button type="button" data-screen-action="clear">清空本格</button><button type="button" data-screen-action="next">下一格 →</button></div></div>`;
}
export function mountScreenKeyboard(root,{selector,operators=false,autoAdvance=false}={}){
  const pad=root.querySelector('.screen-keyboard');
  if(!pad)return {destroy(){},selectFirst(){},refresh(){}};
  let active=null;
  const fields=()=>[...root.querySelectorAll(selector)].filter(el=>!el.disabled);
  const isOp=el=>el?.dataset.equationField==='op';
  const event=()=>new root.ownerDocument.defaultView.Event('input',{bubbles:true});
  const refresh=()=>{
    root.querySelectorAll(selector).forEach(el=>{const selected=el===active&&!el.disabled;el.classList.toggle('screen-active',selected);el.setAttribute('aria-current',String(selected))});
    pad.querySelector('.screen-target').textContent=active&&!active.disabled?'正在填写：'+active.getAttribute('aria-label'):'本题已提交';
    pad.querySelectorAll('button').forEach(button=>button.disabled=!fields().length);
  };
  const select=el=>{if(el&&!el.disabled){active=el;refresh()}};
  const next=()=>{const list=fields();if(list.length)select(list[(list.indexOf(active)+1)%list.length])};
  const write=value=>{if(!active||active.disabled)return;active.value=value;active.dispatchEvent(event());refresh()};
  const key=value=>{
    if(!active||active.disabled)select(fields()[0]);if(!active||active.disabled)return;
    if(value==='='){
      if(operators)select(active.closest('[data-equation-row]')?.querySelector('[data-equation-field="result"]'));
      return;
    }
    if(['+','-','×','÷'].includes(value)){
      if(!operators)return;
      const op=active.closest('[data-equation-row]')?.querySelector('[data-equation-field="op"]');
      if(!op||op.disabled)return;select(op);write(value);select(op.closest('[data-equation-row]').querySelector('[data-equation-field="b"]'));return;
    }
    if(isOp(active)){if(!/^\d$/.test(value))return;next()}
    const old=active.value||'';let updated=old;
    if(/^\d$/.test(value))updated=old+value;
    else if(value==='.'&&operators&&!old.includes('.'))updated=old?old+'.':'0.';
    else if(value==='±'&&operators)updated=old.startsWith('-')?old.slice(1):'-'+old;
    else return;
    const limit=Number(active.maxLength)>0?Number(active.maxLength):12;
    if(updated.length>limit)return;write(updated);
    if(autoAdvance&&updated.length===limit)next();
  };
  const action=value=>{
    if(!active||active.disabled)select(fields()[0]);if(!active||active.disabled)return;
    if(value==='next')next();
    else if(value==='clear')write('');
    else if(value==='backspace')write(active.value.slice(0,-1));
  };
  const click=e=>{
    const field=e.target.closest(selector);if(field&&root.contains(field))select(field);
    const button=e.target.closest('[data-screen-key],[data-screen-action]');if(!button||!pad.contains(button)||button.disabled)return;
    if(button.hasAttribute('data-screen-key'))key(button.dataset.screenKey);else action(button.dataset.screenAction);
  };
  const focus=e=>{if(e.target.matches?.(selector))select(e.target)};
  const down=e=>{
    if(!e.target.matches?.(selector)&&!pad.contains(e.target))return;
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    const normalized=({'x':'×','X':'×','*':'×','/':'÷','−':'-','Delete':'clear','Backspace':'backspace','ArrowRight':'next'})[e.key]||e.key;
    if(/^\d$/.test(normalized)||['+','-','×','÷','=','.', '±'].includes(normalized)){e.preventDefault();key(normalized)}
    else if(['clear','backspace','next'].includes(normalized)){e.preventDefault();action(normalized)}
  };
  root.addEventListener('click',click);root.addEventListener('focusin',focus);root.addEventListener('keydown',down);
  select(fields()[0]);refresh();
  return {refresh,selectFirst:()=>select(fields()[0]),destroy(){root.removeEventListener('click',click);root.removeEventListener('focusin',focus);root.removeEventListener('keydown',down)}};
}
