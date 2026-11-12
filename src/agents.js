import {EVIL,knowledge,perspective,auditHash,shuffle,SIZES} from './core.js';
import {reserveCall} from './quota.js';
import {anyCloudConfigured,requestSpec,callProvider,seatConfig,fallbackConfig} from './providers.js';
import {safePromptRules,zeroCostDecision} from './strategy.js';
import {GAME_LIMIT} from './quota.js';
import {memoryPrompt} from './memory26.js';
import {accountabilityContext,validateSpeech} from './reasoning262.js';
import {setProviderCooldown} from './store.js';
import {compactPrompt,promptFootprint} from './prompt263.js';
import {actionInstructions,actionOutputContract} from './actionPrompt263.js';
const seats=[1,2,3,4,5,6,7];
export const cloudEnabled=anyCloudConfigured;
export function offline(g,seat,action){
 const k=knowledge(g,seat);
 if(action==='SPEAK'){const traits={1:'希望優先考慮資訊可靠的隊員',2:'認為成功一次不能保證身分',4:'想比較每個人的推論',5:'反對過早下定論',6:'重視可驗證的論據',7:'傾向保留不同選項'};return {text:`目前隊伍是 ${g.team?.length?g.team.join('、'):'尚未提案'} 號。我${traits[seat]}。`,beliefUpdate:{note:'暫無足夠公開證據'}};}
 if(action==='PROPOSE'){const pool=shuffle(k.role==='MERLIN'?seats.filter(s=>!k.visibleEvil.includes(s)):seats);return {team:pool.slice(0,SIZES[g.round-1])};}
 if(action==='VOTE')return {approve:!g.team.some(s=>k.visibleEvil.includes(s))&&Math.random()>.3};
 if(action==='MISSION')return {fail:EVIL.has(k.role)&&Math.random()>.2};
 if(action==='ASSASSINATE'){const candidates=seats.filter(s=>s!==seat&&!k.evilTeammates.includes(s));return {ranking:candidates.map(s=>({seat:s,score:0,support:[],against:['公開資訊不足']})),target:candidates[Math.floor(Math.random()*candidates.length)]};}
 return {};
}
export function sanitizedRequest(g,seat,action){
 const view=perspective(g,seat); // Only own knowledge + public state + own memory.
 const personalities={1:'calm, evidence-driven, avoids premature certainty',2:'skeptical and argumentative, demands justification',4:'compares contradictions carefully',5:'persuasive and socially tactical',6:'risk-averse and reflective',7:'direct, tests others through provocative questions'};
 const instructions=actionInstructions({action,round:g.round,seat,personality:personalities[seat]});
 return {instructions,view:{requestedAction:action,outputContract:actionOutputContract(action,g.round),...compactPrompt(g,seat,action)}};
}
export async function decide(g,seat,action){
 // Voting and mission cards are independent private decisions, not model calls.
 if(action==='VOTE'||action==='MISSION'){
  const output=zeroCostDecision(g,seat,action);
  g.audit??=[];g.audit.push({seat,action,source:'private-strategy-2.4',inputHash:auditHash(perspective(g,seat)),outputHash:auditHash(output),output,time:new Date().toISOString(),eventSeq:g.revision});
  return output;
 }
 const perspectiveInput=sanitizedRequest(g,seat,action);
 let output,source,model=null,inputHash;
 const config=seatConfig(seat);
 if(config.configured){
  const spec=requestSpec({seat,action,...perspectiveInput});
  source=spec.provider;model=spec.model;
  // Hash only authorized content, never store API keys, full request headers, or raw hidden roles.
  inputHash=auditHash({provider:spec.provider,model:spec.model,body:spec.body});
  // Preserve one possible model request for the assassin, plus room for proposals.
  // Once speech budget ends, pause dialogue rather than silently faking an AI answer.
  const gameCount=g.aiCallCount??0;
  const speechCap=Math.max(1,GAME_LIMIT-3);
  if(action==='SPEAK'&&gameCount>=speechCap)throw Error(`AI_DEBATE_BUDGET: 本局已使用 ${gameCount} 次，最後 3 次優先保留給組隊與刺殺。`);
  if((action==='PROPOSE'&&gameCount>=GAME_LIMIT-1)||(action==='ASSASSINATE'&&gameCount>=GAME_LIMIT)){
   const output=zeroCostDecision(g,seat,action);
   g.budgetNotice='本局模型請求額度已預留或用盡：這一步改由公開標示的個人規則策略執行，沒有呼叫 AI。';
   g.audit??=[];g.audit.push({seat,action,source:'quota-degraded-private-strategy-2.4',inputHash:auditHash(perspective(g,seat)),outputHash:auditHash(output),output,time:new Date().toISOString(),eventSeq:g.revision});
   return output;
  }
  const footprint=promptFootprint(spec);
  try{await reserveCall(g,seat,spec.provider);output=await callProvider(spec);}
  catch(primaryError){
   if(primaryError.code==='AI_QUOTA')await setProviderCooldown(spec.provider,primaryError.retryAfterSeconds||60);
   // Only an explicitly configured, validated alternative may be tried.
   // Every alternative call is reserved and counted separately.
   const alternate=fallbackConfig(seat);
   const retryable=/AI_QUOTA|AI_MODEL_NOT_FOUND|AI_NETWORK_ERROR|AI_INVALID_JSON|AI_EMPTY_RESPONSE/.test(String(primaryError.message)) || /AI_CALL_LIMIT: (?:\w+ 今日保護額度已滿|\w+ 正在短暫冷卻)/.test(String(primaryError.message));
   if(!alternate||!retryable)throw primaryError;
   const backup=requestSpec({seat,action,...perspectiveInput,routeOverride:alternate});
   await reserveCall(g,seat,backup.provider);
   try{output=await callProvider(backup);}
   catch(backupError){if(backupError.code==='AI_QUOTA')await setProviderCooldown(backup.provider,backupError.retryAfterSeconds||60);throw backupError;}
   source=backup.provider;model=backup.model;
   inputHash=auditHash({provider:backup.provider,model:backup.model,body:backup.body});
   g.budgetNotice=`${seat} 號主模型暫不可用，已使用事先指定的免費候選模型 ${backup.provider}/${backup.model}。`;
  }
  // Store metrics only for successful operations; failed calls are logged by provider adapter.
  g.audit??=[];g.audit.push({seat,action:'MODEL_REQUEST_FOOTPRINT',provider:spec.provider,model:spec.model,...footprint,estimatedTokens:null,eventSeq:g.revision,time:new Date().toISOString()});
 }else if(anyCloudConfigured()){
  // Mixed-mode fail closed: no silent offline fallback for a misconfigured NPC.
  throw Error(`AI_PROVIDER_NOT_CONFIGURED: ${seat} 號 NPC 的 ${config.keyName} 尚未設定。`);
 }else{
  source='offline-test';inputHash=auditHash(perspectiveInput);output=offline(g,seat,action);
 }
 if(action==='SPEAK'&&(typeof output.text!=='string'||!output.text.trim()))throw Error('AI_INVALID_ACTION: NPC 發言缺少文字。');
 if(action==='SPEAK'){
  const checked=validateSpeech(g,seat,output.text);
  output={...output,text:checked.text};
  if(checked.issues.length){g.audit??=[];g.audit.push({seat,action:'SPEECH_ACCOUNTABILITY_CHECK',issues:checked.issues,eventSeq:g.revision,time:new Date().toISOString()});}
 }
 g.audit??=[];
 g.audit.push({seat,action,source,model,inputHash,outputHash:auditHash(output),output,time:new Date().toISOString(),eventSeq:g.revision});
 if(action==='SPEAK'&&output.beliefUpdate&&typeof output.beliefUpdate==='object'){
  g.npcMemory??={};const old=g.npcMemory[seat]||{};
  const stances={...(old.stances||{})};
  for(const x of Array.isArray(output.beliefUpdate.stances)?output.beliefUpdate.stances:[]){
   if(Number.isInteger(x?.seat)&&x.seat>=1&&x.seat<=7&&x.seat!==seat&&Number.isFinite(x?.score)){stances[x.seat]=Math.max(-2,Math.min(2,x.score));}
  }
  g.npcMemory[seat]={...old,note:String(output.beliefUpdate.note||'').slice(0,400),stances};
 }
 return output;
}
