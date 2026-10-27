// Run: NODE_PATH=<directory containing playwright> node tests/build010.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
  const outputDir=process.env.TEST_OUTPUT_DIR||require('node:os').tmpdir();
  const root=path.resolve(__dirname,'..');
  const server=require('node:http').createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
    try{const ext=path.extname(file);res.setHeader('Content-Type',({'.js':'application/javascript','.html':'text/html; charset=utf-8','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.wav':'audio/wav'})[ext]||'application/octet-stream');res.end(fs.readFileSync(file))}catch{res.writeHead(404).end()}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const testUrl=process.env.TEST_URL||`http://127.0.0.1:${server.address().port}/`;
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--disable-gpu','--disable-software-rasterizer']});
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>{
    if(!localStorage.getItem('junjun_math_v12'))localStorage.setItem('junjun_math_v12',JSON.stringify({schema:12,profile:{name:'峻峻',grade:2},stats:{stars:123,attempts:10,firstCorrect:8},settings:{sound:false,autoRead:false,answerMode:'choice',roundSize:8},mistakes:[],sessions:[]}));
  });
  await page.goto(testUrl);
  await page.waitForFunction(()=>document.querySelectorAll('.course-card').length===14);
  assert.match(await page.locator('#version').innerText(),/Build015/);
  assert.equal(await page.locator('#loadError').isVisible(),false);
  assert.equal(await page.locator('#statStars').innerText(),'123');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);

  const core=await page.evaluate(async()=>{
    const {LearningEngine}=await import('/v12-engine.js?v=120150');
    const {V12Store}=await import('/v12-store.js?v=120150');
    const {hasSecureEvidence,independentSummary}=await import('/v12-progress.js?v=120150');
    const {createExploration,checkExploration}=await import('/v12-explore.js?v=120150');
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
  await page.screenshot({path:path.join(outputDir,'build010-mobile.png'),fullPage:true});
  // Wrong answer -> correction -> voluntary reflection -> report.
  await page.locator('[data-grade="1"]').click();
  await page.locator('.course-card[data-course="g1u2"]').click();await page.locator('[data-course-mode="random"]').click();
  const answer=await page.evaluate(async()=>{
    const {LearningEngine}=await import('/v12-engine.js?v=120150');
    const q=new LearningEngine({state:JSON.parse(localStorage.getItem('junjun_math_v12'))}).catalog.find(q=>q.prompt===document.querySelector('#questionText').textContent);
    return {index:q.answer,options:q.options};
  });
  await page.locator(`[data-option="${(answer.index+1)%answer.options.length}"]`).click();
  if(await page.locator('#checkpointCard').isVisible()){
    const value=await page.evaluate(async()=>{
      const {LearningEngine}=await import('/v12-engine.js?v=120150');const {buildTutor}=await import('/v12-tutor.js?v=120150');
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
  // Tablet/desktop fit and clear startup are retained.
  await page.setViewportSize({width:1280,height:900});await page.reload();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(outputDir,'build010-test-results.json'),JSON.stringify({...core,pageErrors:errors,mobileAndDesktop:true,uiFlows:'exploration, creation, step hints, persistence, correction, reflection, parent report'},null,2));
  console.log(JSON.stringify({...core,pageErrors:errors},null,2));
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
})().catch(error=>{console.error(error);process.exit(1)});
