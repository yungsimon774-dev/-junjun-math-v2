import {createLab,restoreLab,changeLab,labSolved,labRecord,balanceDifference} from "./v12-lab.js?v=120130";
import {escapeHTML} from "./v12-tutor.js?v=120130";

export function mountLab(root,{draft=null,type="substitution",onSave=()=>{}}={}){
  let lab=restoreLab(draft)||createLab(type);
  let message="先观察已知关系，再动手试。点按也可以完成全部操作。";
  let selectedUnit=false,drag=null,ghost=null,suppressClickUntil=0;
  const doc=root.ownerDocument,w=doc.defaultView;
  const persist=()=>onSave(labRecord(lab),JSON.parse(JSON.stringify(lab)));
  const announce=text=>{message=text;const status=root.querySelector("#labStatus");if(status)status.textContent=text};
  const unit=(side,index)=>`<button type="button" class="lab-unit" data-drag-side="${side}" data-focus="${side}-unit-${index}" aria-label="${side==="left"?"左":"右"}盘单位块，点击拿走1个" data-lab-action="remove" data-side="${side}">1</button>`;
  const action=(text,op,extra="")=>`<button type="button" data-lab-action="${op}" data-focus="${op}-${extra.includes('"left"')?"left":extra.includes('"right"')?"right":"both"}" ${extra}>${text}</button>`;

  function render(){
    const focused=doc.activeElement?.getAttribute("data-focus");
    const diff=lab.type==="balance"?balanceDifference(lab):0;
    const balanceState=diff===0?"两边平衡":diff>0?"左盘较重，左边下沉":"右盘较重，右边下沉";
    const board=lab.type==="substitution"?`
      <div class="lab-known">已知：🍎＝${lab.a}个单位块；🍐＝${lab.b}个🍎</div>
      <p>把“1个🍐和${lab.c}个单位块”全部换成单位块，最后数出总量。</p>
      <div class="lab-token-board" role="group" aria-label="当前数量表示">${lab.board.tokens.map(token=>token.kind==="unit"?'<span class="lab-unit lab-unit-static" aria-label="1个单位块">1</span>':`<button type="button" class="lab-fruit" data-lab-action="expand" data-token="${token.id}" data-drag-expand="${token.id}" data-focus="fruit-${token.id}" aria-label="把这个${token.kind==="pear"?"梨换成等量苹果":"苹果换成等量单位块"}">${token.kind==="pear"?"🍐":"🍎"}<small>点我代换</small></button>`).join("")}</div>
      <div class="lab-exchange-zone" data-expand-zone="true">也可以把水果拖到这里，换成等量的小份</div>
      <label for="labAnswer">最后共有几个单位块？</label>`:`
      <p>起初，左盘有1个🍎和${lab.c}个单位块，右盘有${lab.a+lab.c}个单位块。请保持等量，最后让左盘只剩1个🍎。</p>
      <button type="button" id="labPalette" class="lab-palette" data-drag-palette="true" data-focus="palette" aria-pressed="${selectedUnit}">🧱 单位块1：拖入盘中，或点选后选择左/右盘</button>
      <div class="lab-scale" aria-label="${balanceState}"><div class="lab-beam" style="--lab-tilt:${diff===0?0:diff>0?-6:6}deg"></div><div class="lab-stand"></div></div>
      <p class="lab-balance-status" aria-live="polite">${balanceState}</p>
      <div class="lab-pans">${["left","right"].map(side=>{
        const n=lab.board[side==="left"?"leftUnits":"rightUnits"];
        const down=diff===0?0:(diff>0)===(side==="left")?8:-8;
        return `<section class="lab-pan" data-drop-side="${side}" style="--lab-down:${down}px" aria-label="${side==="left"?"左":"右"}盘"><b>${side==="left"?"左盘 · 1个🍎":"右盘"}</b><div class="lab-pan-tokens">${side==="left"?'<span class="lab-apple" aria-label="一个待求数值的苹果">🍎</span>':""}${Array.from({length:n},(_,i)=>unit(side,i)).join("")||'<span class="lab-empty">暂时没有单位块</span>'}</div><small>${n}个单位块${side==="left"?"，还有1个苹果":""}</small><div class="lab-pan-actions">${action("加1","add",`data-side="${side}"`)}${action("拿走1","remove",`data-side="${side}"`)}</div><button type="button" data-place-side="${side}" data-focus="place-${side}" ${selectedUnit?"":"disabled"}>把选中的1放到这里</button></section>`;
      }).join("")}</div>
      <div class="lab-both">${action("两边同时加1","bothAdd")}${action("两边同时拿走1","bothRemove")}</div>
      <label for="labAnswer">一个🍎等于几个单位块？</label>`;
    root.innerHTML=`<div class="lab-workshop"><div class="lab-tabs"><button type="button" data-lab-mode="substitution" aria-pressed="${lab.type==="substitution"}">🍐 逐层代换</button><button type="button" data-lab-mode="balance" aria-pressed="${lab.type==="balance"}">⚖️ 等式天平</button></div><small>图示练习 · 不限时 · 不计入独立答题正确率</small>${board}<div class="lab-answer-row"><input id="labAnswer" inputmode="numeric" autocomplete="off" maxlength="8" value="${escapeHTML(lab.answer)}"><button type="button" id="labCheck">检查我的发现</button></div><p id="labStatus" role="status" aria-live="polite">${escapeHTML(message)}</p><div class="lab-controls"><button type="button" data-lab-action="undo" data-focus="undo" ${lab.history.length?"":"disabled"}>↶ 撤回一步</button><button type="button" id="labHint">给我一个提示</button><button type="button" id="labNew">换一题</button></div><label for="labNote">我发现了什么？（可由家长代记）</label><textarea id="labNote" rows="3" maxlength="500" placeholder="我发现两边同时拿走相同数量……">${escapeHTML(lab.note)}</textarea><button type="button" id="labSave">保存图示学习记录</button><small id="labSaved" role="status">操作自动保留，关闭后可以继续。文字想法不自动判分。</small><details><summary>看看刚才的操作</summary><ol>${lab.events.slice(-8).map(event=>`<li>${escapeHTML(event.text)}</li>`).join("")||"<li>还没有操作</li>"}</ol></details></div>`;
    root.querySelector("#labAnswer").oninput=event=>{lab.answer=event.target.value.slice(0,8);lab.completed=false;persist()};
    root.querySelector("#labNote").oninput=event=>{lab.note=event.target.value.slice(0,500);persist()};
    root.querySelector("#labCheck").onclick=()=>{
      lab.answer=root.querySelector("#labAnswer").value.slice(0,8);
      const result=labSolved(lab);lab.checks++;lab.completed=result.ok;persist();announce(result.message);
    };
    root.querySelector("#labHint").onclick=()=>{
      lab.hintUsed=true;persist();announce(lab.type==="balance"?"先观察两边共有多少个单位块。试试“两边同时拿走1”，让左边只留下苹果。":"先把梨换成题目规定的几个苹果，再把每个苹果换成单位块；总量始终不变。");
    };
    root.querySelector("#labNew").onclick=()=>{persist();lab=createLab(lab.type);selectedUnit=false;message="换了一题，先看看新的已知关系。";persist();render()};
    root.querySelector("#labSave").onclick=()=>{persist();root.querySelector("#labSaved").textContent="已保存，可在家长报告里查看操作和想法。"};
    root.querySelectorAll("[data-lab-mode]").forEach(button=>button.onclick=()=>{
      if(button.dataset.labMode===lab.type)return;
      persist();lab=createLab(button.dataset.labMode);selectedUnit=false;message="换一个方式探索等量关系。";persist();render();
    });
    root.querySelectorAll("[data-lab-action]").forEach(button=>button.onclick=()=>perform({type:button.dataset.labAction,id:Number(button.dataset.token),side:button.dataset.side}));
    root.querySelectorAll("[data-place-side]").forEach(button=>button.onclick=()=>{
      if(selectedUnit){selectedUnit=false;perform({type:"add",side:button.dataset.placeSide})}
    });
    const palette=root.querySelector("#labPalette");
    if(palette)palette.onclick=()=>{selectedUnit=!selectedUnit;message=selectedUnit?"已经选中1个单位块，请选择放入左盘或右盘。":"已取消选择。";render()};
    if(focused){
      const button=[...root.querySelectorAll("[data-focus]")].find(b=>b.getAttribute("data-focus")===focused);
      const next=button||(focused.startsWith("fruit-")?root.querySelector(".lab-fruit")||root.querySelector("#labAnswer"):null);
      next?.focus({preventScroll:true});
    }
  }

  function perform(action){
    const result=changeLab(lab,action);message=result.message;
    if(result.ok)persist();render();
  }

  function endDrag(){drag=null;ghost?.remove();ghost=null;root.querySelectorAll(".lab-drop-active").forEach(el=>el.classList.remove("lab-drop-active"))}
  function onPointerDown(event){
    if(drag)return;
    if(event.button!=null&&event.button!==0)return;
    const source=event.target.closest?.("[data-drag-expand],[data-drag-palette],[data-drag-side]");
    if(!source||!root.contains(source))return;
    drag={id:event.pointerId,source,x:event.clientX,y:event.clientY,moved:false};
  }
  function onPointerMove(event){
    if(!drag||event.pointerId!==drag.id)return;
    if(!drag.moved&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<8)return;
    drag.moved=true;event.preventDefault();
    if(!ghost){ghost=doc.createElement("div");ghost.className="lab-drag-ghost";ghost.textContent=drag.source.hasAttribute("data-drag-expand")?drag.source.textContent.replace("点我代换",""):"1";doc.body.appendChild(ghost)}
    ghost.style.left=`${event.clientX}px`;ghost.style.top=`${event.clientY}px`;
    root.querySelectorAll(".lab-drop-active").forEach(el=>el.classList.remove("lab-drop-active"));
    const target=doc.elementFromPoint?.(event.clientX,event.clientY)?.closest("[data-drop-side],[data-expand-zone]");
    if(target&&root.contains(target))target.classList.add("lab-drop-active");
  }
  function onPointerUp(event){
    if(!drag||event.pointerId!==drag.id)return;
    if(drag.moved){
      event.preventDefault();suppressClickUntil=Date.now()+400;
      const source=drag.source,target=doc.elementFromPoint?.(event.clientX,event.clientY)?.closest("[data-drop-side],[data-expand-zone]");
      if(target&&root.contains(target)){
        if(source.hasAttribute("data-drag-expand")&&target.hasAttribute("data-expand-zone"))perform({type:"expand",id:Number(source.dataset.dragExpand)});
        else if(source.hasAttribute("data-drag-palette")&&target.dataset.dropSide)perform({type:"add",side:target.dataset.dropSide});
        else if(source.dataset.dragSide&&target.dataset.dropSide)perform({type:"move",from:source.dataset.dragSide,to:target.dataset.dropSide});
      }else announce("没有放到操作区，数量没有改变。你也可以直接点按按钮。");
    }
    endDrag();
  }
  const cancel=()=>endDrag();
  const suppress=event=>{if(Date.now()<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation()}};
  root.addEventListener("pointerdown",onPointerDown);
  root.addEventListener("click",suppress,true);
  w.addEventListener("pointermove",onPointerMove,{passive:false});
  w.addEventListener("pointerup",onPointerUp);
  w.addEventListener("pointercancel",cancel);
  w.addEventListener("blur",cancel);
  render();
  return ()=>{persist();endDrag();root.removeEventListener("pointerdown",onPointerDown);root.removeEventListener("click",suppress,true);w.removeEventListener("pointermove",onPointerMove);w.removeEventListener("pointerup",onPointerUp);w.removeEventListener("pointercancel",cancel);w.removeEventListener("blur",cancel)};
}
