// Offline model output comparison. No provider calls, no secret keys.
import {CASE_IDS,evaluateResponse} from './benchmark27.js';

export function evaluateModelSamples(samples){
 if(!Array.isArray(samples))throw Error('samples must be array');
 const records=[];
 const seen=new Set();
 for(const sample of samples){
  if(!sample||typeof sample!=='object')throw Error('invalid sample');
  const model=String(sample.model||'').trim(),id=String(sample.caseId||'');
  if(!model||model.length>120||!CASE_IDS.includes(id))throw Error('invalid model/case');
  if(!Number.isInteger(sample.latencyMs)||sample.latencyMs<0)throw Error('latencyMs required');
  if(sample.inputTokens!=null&&(!Number.isInteger(sample.inputTokens)||sample.inputTokens<0))throw Error('invalid input tokens');
  if(sample.outputTokens!=null&&(!Number.isInteger(sample.outputTokens)||sample.outputTokens<0))throw Error('invalid output tokens');
  const key=`${model}/${id}/${String(sample.run||0)}`;
  if(seen.has(key))throw Error('duplicate sample');seen.add(key);
  const verdict=evaluateResponse(id,sample.response);
  records.push({model,caseId:id,run:sample.run||0,passed:verdict.passed,issues:verdict.issues,
   latencyMs:sample.latencyMs,inputTokens:sample.inputTokens??null,outputTokens:sample.outputTokens??null});
 }
 const names=[...new Set(records.map(x=>x.model))].sort();
 const results=names.map(model=>{
  const rs=records.filter(x=>x.model===model),passed=rs.filter(x=>x.passed).length;
  const avg=k=>{const n=rs.map(x=>x[k]).filter(x=>x!=null);return n.length?Math.round(n.reduce((a,b)=>a+b,0)/n.length):null;};
  const counts=Object.fromEntries(CASE_IDS.map(id=>[id,{attempts:rs.filter(x=>x.caseId===id).length,passes:rs.filter(x=>x.caseId===id&&x.passed).length}]));
  return {model,attempts:rs.length,passes:passed,passRate:rs.length?Math.round(1000*passed/rs.length)/10:null,
   meanLatencyMs:avg('latencyMs'),meanInputTokens:avg('inputTokens'),meanOutputTokens:avg('outputTokens'),cases:counts};
 });
 return {schema:'avalon-model-comparison-2.7',externalCalls:0,measure:'Basic compliance only; not social intelligence or real game win rate',results,records};
}
