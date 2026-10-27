export function createOpenChallenge(kind="multiple",total=8+Math.floor(Math.random()*8)){
  kind=kind==="missing"?"missing":"multiple";
  total=Number.isInteger(total)&&total>=8&&total<=20?total:10;
  return {id:`open:${Date.now()}:${Math.random().toString(36).slice(2)}`,kind,total,
    title:kind==="missing"?"补一个条件，让题目能解":"找出不止一个答案",
    prompt:kind==="missing"?`🍎＋🍐＝${total}。只知道这一条，能唯一确定🍎是多少吗？试着补上“🍐＝几”，再求🍎。两个数都是大于0的整数。`:`🍎＋🍐＝${total}，两个数都是大于0的整数。找出两组不同的答案；只交换两个数的位置算同一组。`};
}

export function checkOpenChallenge(challenge,values,previous=[]){
  const raw=values.map(v=>String(v??"").trim());
  if(raw.length!==2||raw.some(v=>!/^\d+$/.test(v)))return {ok:false,message:"请把两个数都填成大于0的整数。"};
  const [apple,pear]=raw.map(Number);
  if(apple<1||pear<1||apple+pear!==challenge.total)return {ok:false,message:`检查两个数是否都大于0，并且相加等于${challenge.total}。`};
  const key=[apple,pear].sort((a,b)=>a-b).join(":");
  if(challenge.kind==="multiple"&&previous.some(row=>row.key===key))return {ok:false,message:"这一组已经有了。只交换位置算同一组，试试改变分法。"};
  return {ok:true,key,apple,pear,message:challenge.kind==="missing"?"✅ 补上这个条件后，苹果的值就能确定了。你也可以补另一个条件，得到另一个答案。":"✅ 这也是一种答案！再想想有没有不同的分法。"};
}
