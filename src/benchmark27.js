// Avalon AI 2.7 stage 1: replayable, API-free evaluation cases.
// This module scores *observable* compliance. It does not claim to measure
// complete strategic intelligence, naturalness, or intent to bluff.
import {createGame,speak,knowledge} from './core.js';
import {compactPrompt} from './prompt263.js';
import {inspectProposal} from './proposalGuard263.js';

const ROLES=['ASSASSIN','LOYAL','MORGANA','MERLIN','PERCIVAL','MORDRED','LOYAL'];
function criticalMerlin(){
 const g=createGame({roles:ROLES});
 g.round=3;g.attempt=1;g.captain=4;g.phase='DISCUSSION';
 g.missions=[{round:1,team:[1,2],success:false,fails:1},{round:2,team:[1,3,7],success:false,fails:2}];
 return g;
}
function speechChallenge(){
 const g=createGame({roles:ROLES});
 speak(g,2,'我已經確認3號是壞人。');
 speak(g,3,'你剛才說已經確認我是壞人，證據在哪裡？');
 return g;
}
function voteChallenge(){
 const g=createGame({roles:ROLES});
 g.npcMemory[2]={ownVoteReasons:[{
  round:1,attempt:1,team:[1,3],approve:true,
  code:'UNINFORMED_OUTSIDER_EXPLORATION',
  reason:'第一輪無確證且自己未入隊；仍選擇放行以觀察任務結果，並不代表認定隊員是好人。',
  source:'RULE_ENGINE_AT_DECISION_TIME',eventSeq:2
 }]};
 speak(g,3,'2號，你沒有入隊為什麼投同意？');
 return g;
}
export const CASE_IDS=Object.freeze(['merlin-elimination-proposal','own-words-accountability','own-vote-explanation']);
export function benchmarkCase(id){
 if(id==='merlin-elimination-proposal'){
  const g=criticalMerlin(),seat=4,action='PROPOSE';
  return {id,seat,action,view:compactPrompt(g,seat,action),game:g,
   description:'Merlin has two failed missions; must form three-seat team without known evil 1 or 3'};
 }
 if(id==='own-words-accountability'){
  const g=speechChallenge(),seat=2,action='SPEAK';
  return {id,seat,action,view:compactPrompt(g,seat,action),game:g,
   description:'Seat 2 must acknowledge their actual strong public claim instead of denying it'};
 }
 if(id==='own-vote-explanation'){
  const g=voteChallenge(),seat=2,action='SPEAK';
  return {id,seat,action,view:compactPrompt(g,seat,action),game:g,
   description:'Seat 2 must explain a revealed YES using its preserved contemporaneous reason'};
 }
 throw Error('unknown benchmark case');
}
const ownClaimAcknowledgement=/我(?:剛才|之前|先前|確實|當時).{0,30}(?:說|主張|表示|認定)|我(?:講過|說過|承認)/;
const observedVote=/同意|贊成|投了(?:贊成|同意)/;
const contemporaneousReason=/觀察任務|取得資訊|收集資訊|看任務結果|放行.*觀察/;
export function evaluateResponse(id,response){
 const c=benchmarkCase(id),issues=[];
 if(!response||typeof response!=='object'||Array.isArray(response))issues.push('INVALID_JSON_OBJECT');
 if(c.action==='PROPOSE'){
  const team=response?.team;
  const result=inspectProposal(c.game,c.seat,team);
  if(!result.ok)issues.push(result.code);
  if(typeof response?.reason!=='string'||!response.reason.trim())issues.push('MISSING_DECISION_REASON');
 }else{
  if(typeof response?.text!=='string'||!response.text.trim())issues.push('MISSING_SPEECH');
  else if(id==='own-words-accountability'){
   if(!ownClaimAcknowledgement.test(response.text))issues.push('DOES_NOT_ACKNOWLEDGE_OWN_WORDS');
   if(/沒(?:有|說過)|從(?:未|來沒)|不曾說過/.test(response.text))issues.push('DENIES_RECORDED_CLAIM');
  }else if(id==='own-vote-explanation'){
   if(!observedVote.test(response.text))issues.push('MISSING_BALLOT_ACKNOWLEDGEMENT');
   if(!contemporaneousReason.test(response.text))issues.push('MISSING_SAVED_VOTE_RATIONALE');
  }
 }
 return {id,passed:issues.length===0,issues};
}
export function runReplay(responses){
 if(!responses||typeof responses!=='object'||Array.isArray(responses))throw Error('response map required');
 const results=CASE_IDS.map(id=>evaluateResponse(id,responses[id]));
 return {schema:'avalon-benchmark-2.7-stage1',total:results.length,passed:results.filter(x=>x.passed).length,results};
}
// No provider calls. Each NPC sees its own lawful perspective, NOT the role table.
export function exportedCase(id){
 const c=benchmarkCase(id);
 return {id:c.id,action:c.action,seat:c.seat,description:c.description,view:c.view};
}
export function lawfulPerspectiveCheck(id){
 const c=benchmarkCase(id),k=knowledge(c.game,c.seat);
 return {seat:c.seat,role:k.role,visibleEvil:k.visibleEvil};
}
