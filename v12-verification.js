export const verificationLabel=status=>({pending:"等待换题验证",passed:"本次变式独立通过",assisted:"借助提示完成，仍需验证",retry:"尚需巩固",unavailable:"暂无合适变式"}[status]||"等待换题验证");

export function eligibleVariant(source,candidate,excluded=new Set()){
  return candidate.qid!==source.qid&&candidate.prompt!==source.prompt
    &&candidate.skillId===source.skillId&&candidate.template===source.template
    &&String(candidate.options[candidate.answer])!==String(source.options[source.answer])
    &&!excluded.has(candidate.qid);
}

export function verificationOutcome(result){
  return result.firstCorrect&&Number(result.hints||0)===0?"passed":result.firstCorrect||result.recovered?"assisted":"retry";
}
