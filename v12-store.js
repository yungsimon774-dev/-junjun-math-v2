const KEY="junjun_math_v12";
const V11_KEY="junjun_math_v10";

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
    roundSize:12,
    firstRetry:true,
    autoRead:false,
    sound:true,
    focusMode:true
  },
  completedCourses:[],
  courseStats:{},
  skillStats:{},
  questionStats:{},
  mistakes:[],
  reviews:{},
  sessions:[],
  diagnostic:{completed:false,grade:2,date:0,score:0,skills:{}}
};

function normalizeState(input={}){
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
  state.courseStats=input.courseStats&&typeof input.courseStats==="object"?input.courseStats:{};
  state.skillStats=input.skillStats&&typeof input.skillStats==="object"?input.skillStats:{};
  state.questionStats=input.questionStats&&typeof input.questionStats==="object"?input.questionStats:{};
  state.mistakes=Array.isArray(input.mistakes)?input.mistakes:[];
  state.reviews=input.reviews&&typeof input.reviews==="object"?input.reviews:{};
  state.sessions=Array.isArray(input.sessions)?input.sessions:[];
  state.rewards.claimedAchievements=Array.isArray(state.rewards.claimedAchievements)?state.rewards.claimedAchievements:[];
  state.settings.roundSize=[8,12,16,20].includes(Number(state.settings.roundSize))?Number(state.settings.roundSize):12;
  state.settings.practiceMode=["learning","adaptive","review","random"].includes(state.settings.practiceMode)?state.settings.practiceMode:"learning";
  state.settings.answerMode=["smart","input","choice"].includes(state.settings.answerMode)?state.settings.answerMode:"smart";
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
    const current=safeParse(localStorage.getItem(KEY),null);
    if(current){
      this.state=normalizeState(current);
    }else{
      const legacy=safeParse(localStorage.getItem(V11_KEY),null);
      this.state=legacy?migrateV11(legacy):normalizeState({});
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
    localStorage.setItem(KEY,JSON.stringify(this.state));
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
    if(!data||typeof data!=="object")throw new Error("学习记录格式不正确");
    if(Number(data.schema)===12){
      this.state=normalizeState(data);
    }else if(Array.isArray(data.mistakes)&&("stars" in data||"attempts" in data)){
      this.state=migrateV11(data);
    }else{
      throw new Error("无法识别这份学习记录");
    }
    this.save();
  }

  reset(){
    this.state=normalizeState({createdAt:Date.now()});
    this.save();
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
