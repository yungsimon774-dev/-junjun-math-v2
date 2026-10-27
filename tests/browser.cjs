// Run: NODE_PATH=<directory containing playwright> node tests/build010.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
  const outputDir=process.env.TEST_OUTPUT_DIR||require('node:os').tmpdir();
  const root=path.resolve(__dirname,'..');
  let corruptRelease=false;
  const fontRoot=process.env.TEST_FONT_ROOT;
  const server=require('node:http').createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(fontRoot&&pathname.startsWith('/__test-fonts/')){
      const parts=pathname.split('/');
      if(['noto-sans-sc','noto-emoji'].includes(parts[2])&&/^[a-zA-Z0-9_.-]+$/.test(parts[3]||'')){
        try{res.setHeader('Content-Type','font/woff2');res.end(fs.readFileSync(path.join(fontRoot,parts[2],'files',parts[3])));return}catch{}
      }
      res.writeHead(404).end();return;
    }
    const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
    try{const ext=path.extname(file);res.setHeader('Content-Type',({'.js':'application/javascript','.html':'text/html; charset=utf-8','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.wav':'audio/wav'})[ext]||'application/octet-stream');const bytes=fs.readFileSync(file);res.end(corruptRelease&&pathname==='/v12-config.js'?Buffer.concat([bytes,Buffer.from('\n// Simulated mixed deployment\n')]):bytes)}catch{res.writeHead(404).end()}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const testUrl=process.env.TEST_URL||`http://127.0.0.1:${server.address().port}/`;
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--disable-gpu','--disable-software-rasterizer']});
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,isMobile:true});
  const fonts=async()=>{
    if(!fontRoot)return;
    const css=['noto-sans-sc','noto-emoji'].map(name=>fs.readFileSync(path.join(fontRoot,name,'400.css'),'utf8').replaceAll('./files/',`/__test-fonts/${name}/`)).join('\n')+"\n*{font-family:'Noto Sans SC','Noto Emoji',sans-serif!important}";
    await page.addStyleTag({content:css});await page.evaluate(()=>document.fonts.ready);
  };
  const screenFill=async(selector,value)=>{
    await page.locator(selector).tap();const pad=page.locator('.screen-keyboard:visible');
    await pad.locator('[data-screen-action="clear"]').tap();
    for(const key of String(value))await pad.locator(`[data-screen-key="${key}"]`).tap();
  };
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>{
    if(!localStorage.getItem('junjun_math_v12'))localStorage.setItem('junjun_math_v12',JSON.stringify({schema:12,profile:{name:'峻峻',grade:2},stats:{stars:123,attempts:10,firstCorrect:8},settings:{sound:false,autoRead:true,equationPractice:false,answerMode:'choice',roundSize:8},mistakes:[],sessions:[]}));
  });
  await page.goto(testUrl);
  await fonts();
  await page.waitForFunction(()=>document.querySelectorAll('.course-card').length===14);
  assert.match(await page.locator('#version').innerText(),/Build017/);
  assert.equal(await page.locator('#loadError').isVisible(),false);
  assert.equal(await page.locator('#statStars').innerText(),'123');
  assert.equal(await page.locator('#readQuestion').count(),0);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('junjun_math_v12')).settings.autoRead),false);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);

  const core=await page.evaluate(async()=>{
    const {LearningEngine}=await import('/v12-engine.js?v=120170');
    const {V12Store}=await import('/v12-store.js?v=120170');
    const {hasSecureEvidence,independentSummary}=await import('/v12-progress.js?v=120170');
    const {createExploration,checkExploration}=await import('/v12-explore.js?v=120170');
    const state=new V12Store().snapshot();
    const store={state,save(){}};
    const e=new LearningEngine(store);
    const bank=e.bankStats(),audit=e.catalogAudit();
    const baseline=e.buildLearningSession('g2u11');
    const skills=[...new Set(e.byCourse.get('g1u2').map(q=>q.skillId))];
    const proof=Array.from({length:5},(_,i)=>({qid:'proof'+i,at:Date.now(),stage:i===4?'transfer':'independent',independent:true,firstCorrect:true,hints:0}));
    const secure=hasSecureEvidence({recentEvidence:proof});
    const rejects=[proof.slice(0,4),proof.map(r=>({...r,qid:'same'})),proof.map(r=>({...r,hints:1})),proof.map(r=>({...r,stage:'independent'})),proof.map(r=>({...r,at:Date.now()-15*86400000})),[...proof.slice(0,4),{...proof[4],firstCorrect:false}]].every(recentEvidence=>!hasSecureEvidence({recentEvidence}));
    for(const id of skills)state.skillStats[id]={recentEvidence:proof};
    state.unitStats={};for(const unit of e.unitsByCourse.get("g1u2"))state.unitStats[unit.id]={recentEvidence:proof};
    const compact=e.buildLearningSession('g1u2');
    const q=compact.items[0].question;
    state.reviews[q.qid]={qid:q.qid,dueDate:'2000-01-01',box:0};
    const dueRoute=e.buildLearningSession('g1u2');
    // Guided correctness cannot establish independent success.
    e.recordResult({question:q,stage:'guided'},{firstCorrect:true,hints:0,entry:{value:q.options[q.answer]}});
    const guidedExcluded=independentSummary(state).total===0;
    e.recordResult({question:q,stage:'independent'},{firstCorrect:true,hints:0,entry:{value:q.options[q.answer]}});
    const independentRecorded=independentSummary(state).rate===100;
    e.recordResult({question:q,stage:'independent'},{firstCorrect:false,recovered:true,hints:1,firstWrongEntry:{value:'999'},entry:{value:q.options[q.answer]}});
    const firstErrorRetained=state.mistakes[0].firstEntry.value==='999';
    state.reviews[q.qid].dueDate='2000-01-01';
    const review=e.buildReviewSession();
    const source=review.items.find(item=>item.reviewOriginalQid===q.qid);
    let reviewAdvanced=false;
    if(source){
      e.recordResult(source,{firstCorrect:true,hints:0,entry:{value:source.question.options[source.question.answer]}});
      reviewAdvanced=state.reviews[q.qid].dueDate!=='2000-01-01'&&!state.mistakes.some(row=>row.qid===q.qid);
    }
    let generated=0;
    for(let level=1;level<=3;level++)for(let a=1;a<=9;a++)for(let b=2;b<=5;b++)for(let c=1;c<=9;c++){
      const puzzle=createExploration(level,{a,b,c});
      const expected=level===1?a*b:level===2?a*b+a:a*b+c;
      if(puzzle.answer!==expected||!checkExploration(String(expected),expected)||checkExploration('',expected)||checkExploration(String(expected+1),expected))throw new Error('Exploration arithmetic regression');
      generated++;
    }
    const roundtrip=new V12Store();
    const payload=roundtrip.exportPayload('test');
    payload.data.explorations=[{id:'saved',note:'我先画图'}];
    roundtrip.importPayload(payload);
    const compatible=roundtrip.state.stats.stars===123&&roundtrip.state.explorations[0].note==='我先画图';
    return {bank,audit,baseline:baseline.items.length,secure,rejects,compact:compact.items.length,compactStages:compact.items.every(item=>item.stage==='transfer'),dueProtected:!dueRoute.route.compact,guidedExcluded,independentRecorded,firstErrorRetained,reviewAdvanced,generated,compatible};
  });
  assert.equal(core.bank.questions,21509);assert.equal(core.bank.rawQuestions,22456);
  for(const key of ['secure','rejects','compactStages','dueProtected','guidedExcluded','independentRecorded','firstErrorRetained','reviewAdvanced','compatible'])assert.equal(core[key],true,key);
  assert.equal(core.compact,4);assert.equal(core.generated,972);
  for(const key of ['invalidQuestions','duplicateOptions','negativeAnswers','languageIssues'])assert.equal(core.audit[key],0,key);

  await page.locator('#exploreStart').click();
  await page.locator('#exploreCheck').click();
  assert.match(await page.locator('#exploreFeedback').innerText(),/先填/);
  await page.locator('[data-explore-level="3"]').click();
  await page.locator('summary').click();
  await page.locator('#createA').fill('3');await page.locator('#createB').fill('4');await page.locator('#createC').fill('2');
  await page.locator('#createPuzzle').click();
  assert.match(await page.locator('.explore-prompt').innerText(),/🍎＋🍎＝6/);
  await page.locator('#exploreHint').click();await page.locator('#exploreFirstCheck').click();
  assert.match(await page.locator('#exploreFirstFeedback').innerText(),/先填写/);
  await page.locator('#exploreFirst').fill('3');await page.locator('#exploreFirstCheck').click();
  assert.match(await page.locator('#exploreFirstFeedback').innerText(),/第一步对了/);
  await page.locator('#exploreAnswer').fill('14');await page.locator('#exploreCheck').click();
  assert.equal(await page.locator('#exploreMethods').isVisible(),true);
  await page.locator('#exploreNote').fill('我先把两个苹果平均分，再换成梨。');await page.locator('#exploreSave').click();
  await page.locator('#modalClose').click();await page.locator('[data-panel="report"]').click();
  assert.match(await page.locator('#explorationReport').innerText(),/平均分/);
  await page.reload();await page.locator('[data-panel="report"]').click();
  assert.match(await page.locator('#explorationReport').innerText(),/平均分/);
  await page.locator('[data-panel="home"]').click();
  await fonts();await page.screenshot({path:path.join(outputDir,'build017-mobile.png'),fullPage:true});
  // Wrong answer -> correction -> voluntary reflection -> report.
  await page.locator('[data-grade="1"]').click();
  await page.locator('.course-card[data-course="g1u2"]').click();await page.locator('[data-course-mode="random"]').click();
  const answer=await page.evaluate(async()=>{
    const {LearningEngine}=await import('/v12-engine.js?v=120170');
    const q=new LearningEngine({state:JSON.parse(localStorage.getItem('junjun_math_v12'))}).catalog.find(q=>q.prompt===document.querySelector('#questionText').textContent);
    return {index:q.answer,options:q.options};
  });
  await page.locator(`[data-option="${(answer.index+1)%answer.options.length}"]`).click();
  if(await page.locator('#checkpointCard').isVisible()){
    const value=await page.evaluate(async()=>{
      const {LearningEngine}=await import('/v12-engine.js?v=120170');const {buildTutor}=await import('/v12-tutor.js?v=120170');
      const q=new LearningEngine({state:JSON.parse(localStorage.getItem('junjun_math_v12'))}).catalog.find(q=>q.prompt===document.querySelector('#questionText').textContent);
      return String(buildTutor(q,{stage:'guided'}).checkpoint.answer);
    });
    await page.locator('#checkpointInput').fill(value);await page.locator('#checkpointCheck').click();
  }
  await page.locator(`[data-option="${answer.index}"]`).click();
  await page.locator('[data-reflection="reading"]').click();
  assert.match(await page.locator('#reflectionSaved').innerText(),/已记下/);
  await page.locator('[data-panel="report"]').click();
  assert.match(await page.locator('#parentAdvice').innerText(),/已知什么/);
  assert.match(await page.locator('#mistakeList').innerText(),/孩子自述/);
  // Interactive diagrams in an actual browser, including a real touch drag.
  await page.locator('[data-panel="home"]').click();await page.locator('#labStart').click();
  while(await page.locator('[data-lab-action="expand"]').count())await page.locator('[data-lab-action="expand"]').first().click();
  await page.locator('[data-lab-action="undo"]').click();await page.locator('[data-lab-action="expand"]').first().click();
  const units=await page.locator('.lab-unit-static').count();
  await page.locator('#labAnswer').fill(String(units));await page.locator('#labCheck').click();
  assert.match(await page.locator('#labStatus').innerText(),/单位块是对的/);
  await page.locator('[data-lab-mode="balance"]').click();
  const initial=await page.evaluate(()=>JSON.parse(localStorage.getItem('junjun_math_v12')).manipulativeDraft);
  await page.locator('[data-lab-action="add"][data-side="left"]').click();assert.match(await page.locator('.lab-balance-status').innerText(),/左盘较重/);
  await page.locator('[data-lab-action="undo"]').click();
  await page.locator('#labPalette').scrollIntoViewIfNeeded();
  const from=await page.locator('#labPalette').boundingBox(),to=await page.locator('[data-drop-side="left"]').boundingBox();
  await page.screenshot({path:path.join(outputDir,'build017-before-touch.png')});
  const cdp=await page.context().newCDPSession(page);
  const x=from.x+from.width/2,y=from.y+from.height/2,tx=to.x+to.width/2,ty=to.y+to.height/2;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let step=1;step<=6;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+(tx-x)*step/6,y:y+(ty-y)*step/6}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('junjun_math_v12')).manipulativeDraft.board.leftUnits),initial.board.leftUnits+1);
  await cdp.detach();
  await page.locator('#modalClose').click();await page.locator('#labStart').click();await page.locator('[data-lab-action="undo"]').click();
  for(let i=0;i<initial.c;i++)await page.locator('[data-lab-action="bothRemove"]').click();
  await page.locator('#labAnswer').fill(String(initial.a));await page.locator('#labCheck').click();assert.match(await page.locator('#labStatus').innerText(),/一个苹果的值/);
  await page.locator('.modal-sheet').evaluate(el=>el.scrollTop=0);
  assert.equal(await page.locator('.modal-sheet').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  await page.screenshot({path:path.join(outputDir,'build017-lab.png')});
  await page.locator('#modalClose').click();
  // Tablet/desktop fit and clear startup are retained.
  await page.setViewportSize({width:1280,height:900});await page.reload();
  await fonts();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(outputDir,'build017-desktop.png')});
  // A complete, hash-checked release must work after network access is removed.
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
  await page.context().setOffline(true);await page.reload();
  await page.waitForFunction(()=>document.querySelectorAll('.course-card').length>0);
  assert.match(await page.locator('#version').innerText(),/Build017/);
  await page.locator('#labStart').click();assert.equal(await page.locator('#labAnswer').inputValue(),String(initial.a));await page.locator('#modalClose').click();
  await page.context().setOffline(false);
  // A partially deployed asset must prevent activation of the new offline set.
  corruptRelease=true;
  const badContext=await browser.newContext();const badPage=await badContext.newPage();
  await badPage.goto(testUrl);
  await badPage.waitForFunction(()=>document.querySelector('#offlineStatus').textContent.includes('未完成'));
  assert.equal(await badPage.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration())?.active)),false);
  corruptRelease=false;await badContext.close();
  await page.setViewportSize({width:390,height:844});await fonts();
  await page.locator('#settingsBtn').click();await page.locator('[data-toggle="equationPractice"]').click();await page.locator('#modalClose').click();
  await page.locator('[data-panel="home"]').click();await page.locator('[data-grade="1"]').click();
  await page.locator('[data-course="g1u2"]').click();await page.evaluate(()=>{window.__savedRandom=Math.random;Math.random=()=>.999999});await page.locator('[data-course-mode="random"]').click();await page.evaluate(()=>{Math.random=window.__savedRandom;delete window.__savedRandom});
  const equation=await page.evaluate(async()=>{const {LearningEngine}=await import('/v12-engine.js?v=120170');const {equationPlan}=await import('/v12-equation.js?v=120170');const e=new LearningEngine({state:JSON.parse(localStorage.getItem('junjun_math_v12'))});return equationPlan(e.catalog.find(q=>q.prompt===document.querySelector('#questionText').textContent));});
  assert.ok(equation?.length);
  assert.equal(await page.locator('[data-equation-field]').evaluateAll(els=>els.every(el=>el.readOnly&&el.inputMode==='none')),true);
  assert.equal(await page.locator('#answerArea select').count(),0);
  assert.equal(await page.locator('.screen-digits button').count(),10);
  assert.equal(await page.locator('.screen-digits').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  await page.setViewportSize({width:320,height:720});
  assert.equal(await page.locator('.screen-digits').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-equation-submit]').click();assert.match(await page.locator('#feedback').innerText(),/都填完整/);
  for(const [i,row] of equation.entries()){
    for(const key of ['a','b','result'])await screenFill(`[data-equation-row="${i}"] [data-equation-field="${key}"]`,row[key]);
    await screenFill(`[data-equation-row="${i}"] [data-equation-field="op"]`,row.op);
  }
  await screenFill('[data-equation-row="0"] [data-equation-field="op"]',equation[0].op==='+'?'-':'+');
  await page.locator('[data-equation-submit]').click();assert.match(await page.locator('#feedback').innerText(),/还没对/);
  for(const [i,row] of equation.entries()){
    for(const key of ['a','b','result'])await screenFill(`[data-equation-row="${i}"] [data-equation-field="${key}"]`,row[key]);
    await screenFill(`[data-equation-row="${i}"] [data-equation-field="op"]`,row.op);
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(outputDir,'build017-equation.png'),fullPage:true});
  await page.locator('[data-equation-submit]').click();assert.equal(await page.locator('[data-equation-field="op"]').first().isDisabled(),true);
  await page.locator('[data-panel="home"]').click();
  const statsBeforeVertical=await page.evaluate(()=>JSON.parse(localStorage.getItem('junjun_math_v12')).stats);
  await page.locator('#verticalStart').click();await page.locator('#verticalDigits').selectOption('3');await page.locator('#verticalNew').click();
  await page.locator('#verticalCheck').click();assert.match(await page.locator('#verticalFeedback').innerText(),/填完整/);
  for(let i=0;i<5;i++){
    const problem=await page.evaluate(async()=>{const {verticalProblem}=await import('/v12-vertical.js?v=120170');const r=JSON.parse(localStorage.getItem('junjun_math_v12')).verticalDraft;const q=r.questions[r.answers.length];return verticalProblem(q.op,q.a,q.b);});
    for(const [key,value] of Object.entries(problem.fields))await screenFill(`[data-vfield="${key}"]`,value);
    assert.equal(await page.locator('[data-vfield]').evaluateAll(els=>els.every(el=>el.readOnly)),true);
    if(i===0){const key=Object.keys(problem.fields)[0];await screenFill(`[data-vfield="${key}"]`,String((Number(problem.fields[key])+1)%10));}
    if(i===1)await page.locator('#verticalHint').click();
    await page.screenshot({path:path.join(outputDir,`build017-vertical-${i}.png`),fullPage:true});
    assert.equal(await page.locator('.modal-sheet').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
    await page.locator('#verticalCheck').click();
    if(i===0){
      assert.match(await page.locator('#verticalFeedback').innerText(),/需要复习/);
      await page.context().setOffline(true);await page.reload();await page.locator('#verticalStart').click();
      assert.equal(await page.locator('[data-vfield]').first().isDisabled(),true);assert.ok(await page.locator('.v-wrong').count()>0);
      await page.context().setOffline(false);await fonts();
    }
    await page.locator('#verticalNext').click();
  }
  assert.match(await page.locator('#verticalBody').innerText(),/4\/5题竖式全对/);assert.match(await page.locator('#verticalBody').innerText(),/3\/5题/);
  const verticalState=await page.evaluate(()=>JSON.parse(localStorage.getItem('junjun_math_v12')));
  assert.equal(verticalState.verticalRecords.length,1);assert.deepEqual(verticalState.stats,statsBeforeVertical);
  await page.locator('#modalClose').click();await page.locator('[data-panel="report"]').click();assert.match(await page.locator('#verticalReport').innerText(),/4\/5题全对/);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(outputDir,'build017-test-results.json'),JSON.stringify({...core,pageErrors:errors,mobileAndDesktop:true,touchDrag:true,equationEntry:true,inlineKeyboard:true,verticalRound:true,offlineReload:true,rejectsMixedRelease:true},null,2));
  console.log(JSON.stringify({result:'PASS',pageErrors:errors,mobileAndDesktop:true,touchDrag:true,equationEntry:true,inlineKeyboard:true,verticalRound:true,offlineReload:true,rejectsMixedRelease:true},null,2));
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
})().catch(error=>{console.error(error);process.exit(1)});
