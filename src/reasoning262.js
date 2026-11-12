// 2.6.2: deterministic, zero-token grounding for a character's OWN public words.
// Never inspects the full role table or another seat's private memory.
// This is a focused accountability guard, not a general truth detector.
const shorten=(v,n=110)=>String(v||'').trim().slice(0,n);
const challengeRE=/你(?:剛|之前|前面|先前)|你說過|你(?:的)?(?:前後|說法|立場)|言語不一|自相矛盾|改口|為什麼.*(?:認定|確認)|怎麼.*(?:不一|改變)|理由|證據|推理過程/;
const certaintyRE=/已(?:經|被)?(?:確定|確認)|確(?:定|認).{0,5}(?:邪惡|壞人)|鐵(?:狼|壞)/;
const evilRE=/(?:邪惡|壞人|黑方)/;
function recentOwnSpeech(g,seat){
 return (g.events||[]).filter(e=>e.type==='SPEAK'&&e.payload?.seat===seat).slice(-12)
  .map(e=>({seq:e.seq,text:shorten(e.payload.text,170)}));
}
export function accountabilityContext(g,seat){
 const own=recentOwnSpeech(g,seat);
 const latest=(g.publicMessages||[]).at(-1);
 const challenged=latest?.seat!==seat&&latest?.seat===g.humanSeat&&challengeRE.test(latest?.text||'');
 let disputed=null;
 if(challenged){
  disputed=own.filter(x=>certaintyRE.test(x.text)&&evilRE.test(x.text)).at(-1)
    ||own.at(-1)||null;
 }
 return {recentOwnSpeech:own.slice(-7),lastOwnStrongClaim:own.filter(x=>certaintyRE.test(x.text)&&evilRE.test(x.text)).at(-1)||null,
  question:challenged?shorten(latest.text,220):null,disputed,challenged};
}
const normalize=s=>String(s||'').replace(/[\s，。、「」『』,.:：]/g,'');
function refersToPast(text,claim){
 const t=normalize(text);
 if(/我(?:剛才|之前|前面|先前|確實|當時).{0,22}(?:說|認為|主張|表示)|我(?:講過|說過)|我承認/.test(text))return true;
 const sample=normalize(claim).slice(0,11);
 return sample.length>=6&&t.includes(sample);
}
const unsupportedEvilRE=/([1-7](?:號)?(?:[、，和及與][1-7](?:號)?)*)已(?:被|經)?(?:確認|確定)(?:為|是)?(?:邪惡|壞人)/g;
const unsupportedGoodRE=/未(?:被)?證(?:明|實).{0,30}(?:所以|因此).{0,18}(?:一定|確定|必然).{0,8}(?:是)?(?:好人|善良)/;
export function validateSpeech(g,seat,text){
 const ctx=accountabilityContext(g,seat);let result=String(text||'').trim();const issues=[];
 if(!ctx.challenged){
  if([...result.matchAll(unsupportedEvilRE)].length){
   issues.push({code:'UNSUPPORTED_PUBLIC_IDENTITY_CERTAINTY'});
   if(!['ASSASSIN','MORGANA','MORDRED'].includes(g.roles?.[seat])){
    result=result.replace(unsupportedEvilRE,(_,seats)=>`${seats}值得懷疑，但尚無公開證據能證實其身分`);
   }
  }
  if(unsupportedGoodRE.test(result)){
   issues.push({code:'ABSENCE_OF_EVIDENCE_AS_GOOD_PROOF'});
   if(!['ASSASSIN','MORGANA','MORDRED'].includes(g.roles?.[seat])){
    result='沒有證據證明某人是邪惡，不代表他就是好人；我只能把這些人列為待觀察的候選。';
   }
  }
 }
 if(ctx.challenged&&ctx.disputed&&!refersToPast(result,ctx.disputed.text)){
  // Do not invent an explanation or force an evil character to confess lying.
  // The quote is an immutable PUBLIC event, not a private role inference.
  const quote=shorten(ctx.disputed.text,55);
  result=`我先前確實說過「${quote}」。${result}`;
  issues.push({code:'MISSING_SELF_ACKNOWLEDGEMENT',referenceSeq:ctx.disputed.seq});
 }
 return {text:result.slice(0,120),issues,accountability:ctx.challenged?{question:ctx.question,referenceSeq:ctx.disputed?.seq??null}:null};
}
