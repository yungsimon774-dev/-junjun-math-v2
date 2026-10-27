const KEY="junjun_math_v12";
const V11_KEY="junjun_math_v10";
const IMPORT_BACKUP_KEY=KEY+"_before_import";

const clone=value=>JSON.parse(JSON.stringify(value));
const safeParse=(raw,fallback={})=>{try{return JSON.parse(raw)}catch{return fallback}};
const today=(offset=0)=>{
  const date=new Date();
  date.setDate(date.getDate()+offset);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
};

const DEFAULT_STATE={
  schema:12,
  createdAt:0,
  updatedAt:0,
  migratedFromV11:false,
  profile:{name:"峻峻",grade:2},
  stats:{stars:0,attempts:0,firstCorrect:0,recovered:0,completedSessions:0,totalMs:0,hints:0},
  daily:{date:"",attempts:0,firstCorrect:0,recovered:0,totalMs:0,minutes:0,sessions:0,rewarded:false},
  rewards:{lastDate:"",streak:0,claimedAchievements:[]},
  settings:{
    practiceMode:"learning",
    answerMode:"smart",
    equationPractice:true,
    roundSize:12,
    firstRetry:true,
    autoRead:false,
    sound:true,
    focusMode:true
  },
  completedCourses:[],
  courseStats:{},
  skillStats:{},
  unitStats:{},
  questionStats:{},
  mistakes:[],
  reviews:{},
  sessions:[],
  explorations:[],
  verificationTasks:[],
  coachingRecords:[],
  manipulativeRecords:[],
  manipulativeDraft:null,
  diagnostic:{completed:false,grade:2,date:0,score:0,skills:{}}
};

const object=value=>value&&typeof value==="object"&&!Array.isArray(value)?value:{};
const count=value=>Number.isFinite(Number(value))?Math.max(0,Math.min(1e15,Math.floor(Number(value)))):0;
const records=value=>Array.isArray(value)?value.filter(row=>row&&typeof row==="object"&&!Array.isArray(row)):[];
function normalizeStats(value){
  const stats={...object(value)};
  for(const key of ["attempts","firstCorrect","correct","recovered","hints","totalMs","sessions","transferCorrect"]){
    if(key in stats)stats[key]=count(stats[key]);
  }
  if("attempts" in stats){
    if("firstCorrect" in stats)stats.firstCorrect=Math.min(stats.attempts,stats.firstCorrect);
    if("correct" in stats)stats.correct=Math.min(stats.attempts,stats.correct);
    if("recovered" in stats)stats.recovered=Math.min(stats.attempts,stats.recovered);
  }
  stats.stage=Object.fromEntries(Object.entries(object(stats.stage)).filter(([,row])=>row&&typeof row==="object").map(([key,row])=>[key,{attempts:count(row.attempts),correct:Math.min(count(row.attempts),count(row.correct)),recovered:count(row.recovered)}]));
  stats.errorReasons=Object.fromEntries(Object.entries(object(stats.errorReasons)).map(([key,value])=>[key,count(value)]));
  return stats;
}

function normalizeState(input={}){
  if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("学习记录应为一个对象");
  if(input.schema!=null&&Number(input.schema)!==12)throw new Error("记录版本不受支持");
  const state={
    ...clone(DEFAULT_STATE),
    ...input,
    profile:{...DEFAULT_STATE.profile,...(input.profile||{})},
    stats:{...DEFAULT_STATE.stats,...(input.stats||{})},
    daily:{...DEFAULT_STATE.daily,...(input.daily||{})},
    rewards:{...DEFAULT_STATE.rewards,...(input.rewards||{})},
    settings:{...DEFAULT_STATE.settings,...(input.settings||{})},
    diagnostic:{...DEFAULT_STATE.diagnostic,...(input.diagnostic||{})}
  };
  state.completedCourses=Array.isArray(input.completedCourses)?input.completedCourses:[];
  for(const key of ["courseStats","skillStats","questionStats","unitStats"]){
    state[key]=Object.fromEntries(Object.entries(object(input[key])).filter(([,value])=>value&&typeof value==="object"&&!Array.isArray(value)).map(([id,value])=>[id,normalizeStats(value)]));
  }
  state.mistakes=records(input.mistakes);
  state.reviews=Object.fromEntries(Object.entries(object(input.reviews)).filter(([,row])=>row&&typeof row==="object"&&!Array.isArray(row)));
  state.sessions=records(input.sessions);
  state.explorations=Array.isArray(input.explorations)?input.explorations.filter(row=>row&&typeof row==="object"&&!Array.isArray(row)).slice(0,40):[];
  state.verificationTasks=Array.isArray(input.verificationTasks)?input.verificationTasks.filter(row=>row&&typeof row==="object"&&typeof row.sourceQid==="string"):[];
  state.coachingRecords=Array.isArray(input.coachingRecords)?input.coachingRecords.filter(row=>row&&typeof row==="object").slice(0,60):[];
  state.manipulativeRecords=Array.isArray(input.manipulativeRecords)?input.manipulativeRecords.filter(row=>row&&typeof row==="object"&&!Array.isArray(row)).slice(0,40):[];
  state.manipulativeDraft=input.manipulativeDraft&&typeof input.manipulativeDraft==="object"?input.manipulativeDraft:null;
  state.rewards.claimedAchievements=Array.isArray(state.rewards.claimedAchievements)?state.rewards.claimedAchievements:[];
  state.settings.roundSize=[8,12,16,20].includes(Number(state.settings.roundSize))?Number(state.settings.roundSize):12;
  state.settings.practiceMode=["learning","adaptive","review","random"].includes(state.settings.practiceMode)?state.settings.practiceMode:"learning";
  state.settings.answerMode=["smart","input","choice"].includes(state.settings.answerMode)?state.settings.answerMode:"smart";
  for(const key of ["sound","firstRetry","autoRead","focusMode","equationPractice"])if(typeof state.settings[key]!=="boolean")state.settings[key]=DEFAULT_STATE.settings[key];
  state.profile.grade=[1,2].includes(Number(state.profile.grade))?Number(state.profile.grade):2;
  state.profile.name=typeof state.profile.name==="string"?state.profile.name.slice(0,40):"峻峻";
  for(const key of Object.keys(DEFAULT_STATE.stats))state.stats[key]=count(state.stats[key]);
  for(const key of ["independentObserved","independentCorrect"])if(key in state.stats)state.stats[key]=count(state.stats[key]);
  state.stats.firstCorrect=Math.min(state.stats.attempts,state.stats.firstCorrect);
  state.stats.recovered=Math.min(state.stats.attempts,state.stats.recovered);
  if("independentCorrect" in state.stats)state.stats.independentCorrect=Math.min(count(state.stats.independentObserved),state.stats.independentCorrect);
  for(const key of ["attempts","firstCorrect","recovered","totalMs","minutes","sessions"])state.daily[key]=count(state.daily[key]);
  state.schema=12;
  return state;
}

function migrateV11(legacy){
  const state=normalizeState({});
  const settings=legacy.settings||{};
  state.migratedFromV11=true;
  state.createdAt=Date.now();
  state.profile.grade=2;
  state.stats={
    ...state.stats,
    stars:Number(legacy.stars||0),
    attempts:Number(legacy.attempts||0),
    firstCorrect:Number(legacy.correct||0),
    recovered:Number(legacy.recoveries||0),
    completedSessions:Array.isArray(legacy.activity)?legacy.activity.length:0,
    hints:Number(legacy.teacherStats?.help||0)
  };
  state.completedCourses=Array.isArray(legacy.done)?[...legacy.done]:[];
  state.courseStats=clone(legacy.courseStats||{});
  state.skillStats=clone(legacy.kindStats||{});
  state.questionStats=clone(legacy.questionStats||{});
  state.mistakes=(legacy.mistakes||[]).map(item=>({...item,source:"V11",reviewBox:0}));
  state.sessions=(legacy.activity||[]).map(item=>({
    date:Number(item.date||Date.now()),
    courseId:item.courseId||"",
    course:item.course||"旧版练习",
    mode:"V11",
    score:Number(item.score||0),
    firstCorrect:Number(item.correct||0),
    recovered:Number(item.recovered||0),
    total:Number(item.total||0),
    minutes:0
  })).slice(0,60);
  state.settings={
    ...state.settings,
    answerMode:settings.answerMode==="choice"?"choice":settings.answerMode==="input"?"input":"smart",
    roundSize:[8,12,16,20].includes(Number(settings.roundSize))?Number(settings.roundSize):12,
    firstRetry:settings.firstRetry!==false,
    autoRead:Boolean(settings.autoRead),
    sound:settings.sound!==false
  };
  if(legacy.daily?.date===today()){
    state.daily={
      ...state.daily,
      date:legacy.daily.date,
      attempts:Number(legacy.daily.attempts||0),
      firstCorrect:Number(legacy.daily.correct||0),
      recovered:Number(legacy.daily.recovered||0),
      sessions:Number(legacy.daily.courses||0),
      rewarded:Boolean(legacy.daily.rewarded)
    };
  }
  state.rewards={
    lastDate:String(legacy.rewardDate||""),
    streak:Number(legacy.rewardStreak||0),
    claimedAchievements:Array.isArray(legacy.claimedAchievements)?legacy.claimedAchievements:[]
  };
  return state;
}

export class V12Store{
  constructor(){
    this.storageError="";this.notice="";this.recoveryRaw=null;this.canWrite=true;
    let raw=null;
    try{raw=localStorage.getItem(KEY)}catch{this.canWrite=false;this.storageError="此浏览器未允许本地保存；当前可继续使用，离开前请导出记录。"}
    if(raw!=null){
      try{
        const parsed=JSON.parse(raw);
        if(parsed?.schema!=null&&Number(parsed.schema)!==12){this.canWrite=false;this.storageError="记录来自当前程序不支持的版本，原记录未覆盖。请保留备份后使用对应版本。"}
        this.state=normalizeState(parsed);
      }
      catch{
        this.recoveryRaw=raw;
        try{const key=KEY+"_recovery_"+Date.now();localStorage.setItem(key,raw);localStorage.setItem(KEY+"_recovery_latest",key);this.notice="发现无法读取的旧记录，已另存原始内容。可导出恢复文本；当前使用新的临时学习进度。"}
        catch{this.canWrite=false;this.storageError="旧记录无法读取，且未能另存备份。原记录未覆盖；请导出恢复文本和当前记录。"}
      }
    }
    if(!this.recoveryRaw){try{const key=localStorage.getItem(KEY+"_recovery_latest");if(key)this.recoveryRaw=localStorage.getItem(key)}catch{}}
    if(!this.state){
      let legacy=null;
      try{legacy=safeParse(localStorage.getItem(V11_KEY),null)}catch{}
      try{this.state=legacy&&typeof legacy==="object"?migrateV11(legacy):normalizeState({})}catch{this.state=normalizeState({})}
      this.state.createdAt=Date.now();
    }
    this.ensureToday();
    this.save();
  }

  ensureToday(){
    if(this.state.daily.date!==today()){
      this.state.daily={...DEFAULT_STATE.daily,date:today()};
    }
  }

  save(){
    this.ensureToday();
    this.state.updatedAt=Date.now();
    if(!this.canWrite){this.notifyStorage();return false}
    try{localStorage.setItem(KEY,JSON.stringify(this.state));this.storageError="";this.notifyStorage();return true}
    catch{this.storageError="本地记录未能保存，可能空间不足或保存被限制。请在离开前导出记录。";this.notifyStorage();return false}
  }

  notifyStorage(){
    if(typeof window!=="undefined"&&typeof window.dispatchEvent==="function"&&typeof CustomEvent!=="undefined")window.dispatchEvent(new CustomEvent("junjun-storage-status"));
  }

  hasImportBackup(){try{return Boolean(localStorage.getItem(IMPORT_BACKUP_KEY))}catch{return false}}

  restoreImportBackup(){
    let payload;try{payload=JSON.parse(localStorage.getItem(IMPORT_BACKUP_KEY))}catch{throw new Error("未找到可读取的导入前备份")}
    if(!payload)throw new Error("还没有导入前备份");
    this.importPayload(payload);
  }

  snapshot(){
    return clone(this.state);
  }

  exportPayload(version){
    return {
      app:"峻峻数学大冒险",
      version,
      schema:12,
      exportedAt:new Date().toISOString(),
      data:this.snapshot()
    };
  }

  importPayload(payload){
    const data=payload?.data||payload;
    if(!data||typeof data!=="object"||Array.isArray(data))throw new Error("学习记录格式不正确");
    let next;
    if(Number(data.schema)===12){
      next=normalizeState(data);
    }else if(Array.isArray(data.mistakes)&&("stars" in data||"attempts" in data)){
      next=migrateV11(data);
    }else{
      throw new Error("无法识别这份学习记录");
    }
    if(!this.canWrite)throw new Error("浏览器未允许保存，本次没有替换原记录。请先导出当前进度。");
    next.updatedAt=Date.now();
    if(next.daily.date!==today())next.daily={...DEFAULT_STATE.daily,date:today()};
    try{
      localStorage.setItem(IMPORT_BACKUP_KEY,JSON.stringify(this.exportPayload("导入前备份")));
      localStorage.setItem(KEY,JSON.stringify(next));
    }catch{throw new Error("保存失败，本次未替换当前进度；原记录及内存进度保留。")}
    this.state=next;this.storageError="";this.notifyStorage();
  }

  reset(){
    const previous=this.state;
    this.state=normalizeState({createdAt:Date.now()});
    if(!this.save()){this.state=previous;throw new Error("未能保存清空操作，原进度仍保留。")}
  }

  claimDailyReward(){
    this.ensureToday();
    const date=today();
    if(this.state.rewards.lastDate===date)return 0;
    this.state.rewards.streak=this.state.rewards.lastDate===today(-1)?this.state.rewards.streak+1:1;
    const gain=Math.min(5+(this.state.rewards.streak-1)*2,20);
    this.state.rewards.lastDate=date;
    this.state.stats.stars+=gain;
    this.save();
    return gain;
  }
}

export {today};
