// Evidence collected from Build010 onward; older scores remain intact.
export function hasSecureEvidence(stats,now=Date.now()){
  const evidence=Array.isArray(stats?.recentEvidence)?stats.recentEvidence:[];
  const recent=evidence.filter(row=>row&&now-row.at>=0&&now-row.at<14*86400000).slice(-6);
  return recent.length>=5
    &&recent.every(row=>row.independent&&row.firstCorrect&&row.hints===0)
    &&new Set(recent.map(row=>row.qid)).size>=5
    &&recent.some(row=>row.stage==="transfer");
}

export function independentSummary(state){
  const stats=state.stats||{};
  const total=Number(stats.independentObserved||0);
  return {total,correct:Number(stats.independentCorrect||0),rate:total?Math.round(Number(stats.independentCorrect||0)/total*100):null};
}

export const REFLECTIONS={
  reading:{label:"我看漏了条件",advice:"请峻峻先说出“已知什么、问什么”，再圈出关键数量；先别急着计算。"},
  calculation:{label:"我算错了",advice:"先让峻峻说出列式理由，再用拆数、画图或逆运算检查计算过程。"},
  concept:{label:"我还没弄懂关系",advice:"换成实物或图示，让峻峻摆一摆数量关系；一起完成一个步骤，再独立试一道。"},
  unsure:{label:"我还说不清",advice:"先请峻峻讲讲刚才怎么想，再观察他在哪一步停住；不要直接认定是粗心。"}
};

export function reflectionSummary(state){
  return Object.entries(REFLECTIONS).map(([id,info])=>({...info,id,count:Object.values(state.questionStats||{}).reduce((sum,s)=>sum+Number(s.reflections?.[id]||0),0)})).filter(row=>row.count>0);
}
