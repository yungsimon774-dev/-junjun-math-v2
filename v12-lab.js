// A small, deterministic model for the interactive manipulatives.
const clone=value=>JSON.parse(JSON.stringify(value));
const whole=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
export const tokenValue=(kind,lab)=>kind==="pear"?lab.a*lab.b:kind==="apple"?lab.a:1;
export const labTotal=lab=>lab.a*lab.b+lab.c;
export const balanceDifference=lab=>lab.a+lab.board.leftUnits-lab.board.rightUnits;
export const expandedTotal=lab=>lab.board.tokens.reduce((sum,t)=>sum+tokenValue(t.kind,lab),0);

export function createLab(type="substitution",values={}){
  type=type==="balance"?"balance":"substitution";
  const a=whole(values.a,1,5)?values.a:2+Math.floor(Math.random()*4);
  const b=whole(values.b,2,4)?values.b:2+Math.floor(Math.random()*3);
  const c=whole(values.c,1,4)?values.c:1+Math.floor(Math.random()*4);
  return {schema:1,id:`lab:${Date.now()}:${Math.random().toString(36).slice(2)}`,type,a,b,c,
    board:type==="balance"?{leftUnits:c,rightUnits:a+c}:{tokens:[{id:0,kind:"pear"},...Array.from({length:c},(_,i)=>({id:i+1,kind:"unit"}))]},
    nextId:c+1,history:[],moves:0,undoCount:0,unbalancedMoves:0,hintUsed:false,completed:false,checks:0,answer:"",note:"",events:[]};
}

function validBoard(board,lab){
  if(!board||typeof board!=="object")return false;
  if(lab.type==="balance")return whole(board.leftUnits,0,30)&&whole(board.rightUnits,0,30);
  if(!Array.isArray(board.tokens)||board.tokens.length<1||board.tokens.length>40)return false;
  if(board.tokens.some(t=>!t||!whole(t.id,0,100000)||!["pear","apple","unit"].includes(t.kind)))return false;
  return new Set(board.tokens.map(t=>t.id)).size===board.tokens.length
    &&board.tokens.reduce((sum,t)=>sum+tokenValue(t.kind,lab),0)===labTotal(lab);
}

export function restoreLab(raw){
  if(!raw||raw.schema!==1||!["balance","substitution"].includes(raw.type)
    ||!whole(raw.a,1,5)||!whole(raw.b,2,4)||!whole(raw.c,1,4)
    ||typeof raw.id!=="string"||raw.id.length>120||!validBoard(raw.board,raw))return null;
  const lab=createLab(raw.type,raw);
  lab.id=raw.id;lab.board=clone(raw.board);
  lab.history=Array.isArray(raw.history)?raw.history.filter(board=>validBoard(board,lab)).slice(-40).map(clone):[];
  for(const key of ["moves","undoCount","unbalancedMoves","checks"])lab[key]=whole(raw[key],0,1000000)?raw[key]:0;
  lab.hintUsed=raw.hintUsed===true;
  lab.answer=String(raw.answer??"").slice(0,8);lab.note=String(raw.note??"").slice(0,500);
  lab.nextId=lab.type==="substitution"?Math.max(...lab.board.tokens.map(t=>t.id))+1:0;
  lab.events=Array.isArray(raw.events)?raw.events.filter(e=>e&&typeof e.text==="string").slice(-40).map(e=>({text:e.text.slice(0,180)})):[];
  // An imported completion flag is never sufficient on its own.
  lab.completed=raw.completed===true&&labSolved(lab).ok;
  return lab;
}

export function changeLab(lab,action){
  const before=clone(lab.board);
  let text="";
  if(action.type==="undo"){
    if(!lab.history.length)return {ok:false,message:"还没有可以撤回的操作。"};
    lab.board=lab.history.pop();lab.undoCount++;lab.completed=false;
    lab.events.push({text:"撤回上一步"});lab.events=lab.events.slice(-40);
    return {ok:true,message:"已撤回上一步，可以换个办法试。"};
  }
  if(lab.type==="substitution"&&action.type==="expand"){
    const index=lab.board.tokens.findIndex(t=>t.id===action.id);
    const token=lab.board.tokens[index];
    if(!token||token.kind==="unit")return {ok:false,message:"只有水果需要继续代换，单位块已经是最小份。"};
    const count=token.kind==="pear"?lab.b:lab.a;
    const kind=token.kind==="pear"?"apple":"unit";
    const children=Array.from({length:count},()=>({id:lab.nextId++,kind}));
    lab.board.tokens.splice(index,1,...children);
    text=token.kind==="pear"?`把1个🍐换成${count}个🍎，总量没有改变。`:`把1个🍎换成${count}个单位块，总量没有改变。`;
  }else if(lab.type==="balance"){
    const board=lab.board;
    if(action.type==="bothAdd"||action.type==="bothRemove"){
      const step=action.type==="bothAdd"?1:-1;
      if(!whole(board.leftUnits+step,0,30)||!whole(board.rightUnits+step,0,30))return {ok:false,message:step<0?"有一边没有单位块了，不能再同时拿走。":"每边最多摆30个单位块。"};
      board.leftUnits+=step;board.rightUnits+=step;
      text=step<0?"两边同时拿走1个单位块。":"两边同时增加1个单位块。";
    }else if(["add","remove"].includes(action.type)&&["left","right"].includes(action.side)){
      const key=action.side==="left"?"leftUnits":"rightUnits",step=action.type==="add"?1:-1;
      if(!whole(board[key]+step,0,30))return {ok:false,message:step<0?"这一边已经没有单位块了。":"每边最多摆30个单位块。"};
      board[key]+=step;text=`${action.side==="left"?"左":"右"}盘${step<0?"拿走":"增加"}1个单位块。`;
    }else if(action.type==="move"&&["left","right"].includes(action.from)&&["left","right"].includes(action.to)&&action.from!==action.to){
      const from=action.from==="left"?"leftUnits":"rightUnits",to=action.to==="left"?"leftUnits":"rightUnits";
      if(board[from]<1||board[to]>=30)return {ok:false,message:"这次不能移动，检查盘里还有没有单位块。"};
      board[from]--;board[to]++;text="把1个单位块从一边移到了另一边，观察天平怎样变化。";
    }else return {ok:false,message:"请选择一个有效操作。"};
    if(balanceDifference(lab)!==0)lab.unbalancedMoves++;
  }else return {ok:false,message:"这个操作不适用于当前工坊。"};
  lab.history.push(before);lab.history=lab.history.slice(-40);lab.moves++;lab.completed=false;
  lab.events.push({text});lab.events=lab.events.slice(-40);
  return {ok:true,message:text};
}

export function labSolved(lab){
  if(!/^\d+$/.test(String(lab.answer).trim()))return {ok:false,message:"请先填写一个整数答案。"};
  if(lab.type==="substitution"){
    if(lab.board.tokens.some(t=>t.kind!=="unit"))return {ok:false,message:"还有水果没有换成单位块。先逐层代换，再数一数。"};
    return Number(lab.answer)===labTotal(lab)?{ok:true,message:"✅ 每次等量代换都保留了总量。你数出的单位块是对的！"}:{ok:false,message:"再把单位块按组数一数，注意原来单独放的单位块。"};
  }
  if(balanceDifference(lab)!==0)return {ok:false,message:"天平还没有平衡，观察哪边较重。"};
  if(lab.board.leftUnits!==0||lab.board.rightUnits!==lab.a)return {ok:false,message:"先让左盘只剩1个苹果，右盘留下与它等量的单位块。"};
  return Number(lab.answer)===lab.a?{ok:true,message:"✅ 两边拿走相同数量后，等量关系仍成立。现在一个苹果的值找到了！"}:{ok:false,message:"左盘只剩1个苹果时，右盘有几个单位块？"};
}

export function labRecord(lab){
  return {id:lab.id,type:lab.type,title:lab.type==="balance"?"等式天平：两边同加同减":"逐层代换：水果变单位块",prompt:lab.type==="balance"?`🍎＋${lab.c}＝${lab.a+lab.c}，求一个🍎的值。`:`🍎＝${lab.a}，🍐＝${lab.b}个🍎，求🍐和${lab.c}个单位块的总量。`,a:lab.a,b:lab.b,c:lab.c,completed:lab.completed,hintUsed:lab.hintUsed,moves:lab.moves,undoCount:lab.undoCount,unbalancedMoves:lab.unbalancedMoves,note:lab.note,at:Date.now(),events:clone(lab.events)};
}
