// 2.4: zero-API operational decisions. Each decision sees only this seat's
// legal knowledge, public evidence and its own persisted memory.
import {createHash} from 'node:crypto';
import {knowledge,perspective,EVIL,SIZES} from './core.js';
import {deductionForSeat} from './deduction263.js';
export const FIXED_RULES=Object.freeze({
 sevenPlayers:'Seven players include three evil roles and four good roles.',
 rejection:'Proposals 1-4 can be rejected. Rejecting proposal 5 immediately ends the game with evil victory; it does not auto-pass.',
 unanimous:'If YES votes exceed the four good players, at least YES-4 evil players voted YES. This does not prove anything about team membership. Seven YES means all three evil voted YES.',
 firstRound:'A good player without new information should be cautious about a team excluding themselves, but may vote YES for a contemporaneously recorded reason. This is a strategy tendency, not a forced rule.',
 success:'A successful mission does not prove all participants are good; evil can submit SUCCESS.',
 mission:'A good player can submit SUCCESS only. Evil players may choose SUCCESS or FAIL. Round 4 in a 7-player game needs TWO FAIL cards to fail.',
 privacy:'During voting, individual votes stay hidden until all seven are submitted. During missions, the identity of each submitted card remains secret.'
});
export function publicLogic(g){
 const prior=[...g.events].reverse().find(e=>e.type==='VOTE_REVEAL');
 return {
  attempt:g.attempt, fifthProposal:g.attempt===5,
  remainingProposals:6-g.attempt,
  rejectedFifthIsEvilWin:g.attempt===5,
  previousVote:prior?{yes:prior.payload.yes,passed:prior.payload.passed,unanimous:prior.payload.yes===7,minimumEvilYes:Math.max(0,prior.payload.yes-4)}:null,
  team:g.team,
  missionHistory:g.missions.map(x=>({round:x.round,team:x.team,success:x.success,fails:x.fails})),
  implications:prior?['At least '+Math.max(0,prior.payload.yes-4)+' evil players voted YES.','An evil YES vote does not establish any evil member of the mission team.']:[]
 };
}
function randomLike(g,seat,action){const h=createHash('sha256').update(`${g.id}|${seat}|${g.round}|${g.attempt}|${action}|${g.revision}`).digest();return h.readUInt32BE(0)/2**32;}
export function zeroCostDecision(g,seat,action){
 const k=knowledge(g,seat),r=randomLike(g,seat,action);
 const evil=EVIL.has(k.role);
 if(action==='PROPOSE'){
  const size=SIZES[g.round-1];
  const stances=perspective(g,seat).memory?.stances||{};
  const score=s=>{
   const knownEvil=k.visibleEvil.includes(s)?-10:0;
   const trusted=Number(stances[s])||0;
   const successful=g.missions.filter(m=>m.success&&m.team.includes(s)).length;
   return knownEvil+trusted*2+successful+(s===seat?0.7:0)+randomLike(g,s,'PROPOSE')*.25;
  };
  const candidates=[1,2,3,4,5,6,7].sort((a,b)=>score(b)-score(a));
  if(evil){const own=[seat,...k.evilTeammates];return {team:[...new Set([...own,...candidates])].slice(0,size)};}
  return {team:candidates.slice(0,size)};
 }
 if(action==='ASSASSINATE'){
  const eligible=[1,2,3,4,5,6,7].filter(s=>s!==seat&&!k.evilTeammates.includes(s));
  const count=s=>g.publicMessages.filter(m=>m.seat===s).length;
  const ranking=eligible.map(s=>({seat:s,score:count(s),support:['公開發言數量（非身分證明）'],against:['缺少足以確認梅林的公開證據']})).sort((a,b)=>b.score-a.score||a.seat-b.seat);
  return {ranking,target:ranking[0]?.seat};
 }
 if(action==='MISSION'){
  // The rules engine still checks legal cards. Strategic evil may deliberately pass.
  if(!evil)return {fail:false};
  const teamEvil=g.team.filter(s=>s===seat||k.evilTeammates.includes(s));
  if(g.round===4 && teamEvil.length<2)return {fail:false}; // Two failures required.
  return {fail:r<0.78};
 }
 if(action==='VOTE'){
  if(g.attempt===5)return {approve:true}; // A rejection loses instantly.
  if(evil){
   if(g.team.some(s=>s===seat||k.evilTeammates.includes(s)))return {approve:true};
   return {approve:r<0.48}; // plausible strategic cover; no secret Merlin access.
  }
  // Known visible evil is legal knowledge for Merlin only; not supplied to loyalists.
  if(k.visibleEvil.some(s=>g.team.includes(s)))return {approve:false};
  const knownMissionHits=g.missions.filter(m=>m.success).flatMap(m=>m.team);
  const previouslySuccessful=g.team.filter(s=>knownMissionHits.includes(s)).length;
  // Only this seat's own AI-updated stances may affect its ballot.
  const ownStances=perspective(g,seat).memory?.stances||{};
  const influence=g.team.reduce((sum,s)=>sum+(Number(ownStances[s])||0),0)/Math.max(1,g.team.length);
  const firstUninformed=g.round===1&&g.attempt===1&&g.missions.length===0&&k.role==='LOYAL';
  const baseline=firstUninformed&&!g.team.includes(seat)?0.18:0.52;
  const base=Math.max(0.05,Math.min(0.95,baseline+(previouslySuccessful>0?0.10:0)+(g.team.includes(seat)?0.15:0)+influence*0.16));
  return {approve:r<base};
 }
 throw Error(`zero cost action not supported: ${action}`);
}
// Explain the rule-engine's actual decision at decision time, never reconstruct motives later.
// This is a deterministic strategy reason, not evidence that an AI model reasoned anew.
export function voteDecisionReason(g,seat,approve){
 const k=knowledge(g,seat),evil=EVIL.has(k.role),included=g.team.includes(seat);
 let code,reason;
 if(g.attempt===5){code='FIFTH_PROPOSAL';reason='第五次提案若再否決，邪惡直接獲勝，因此選擇同意。';}
 else if(evil){
  code='EVIL_PRIVATE_TACTIC';reason=g.team.some(s=>s===seat||k.evilTeammates.includes(s))?'隊伍含有己方成員，策略上支持通過。':'選擇以投票影響信任與局勢，並非公開身分證據。';
 }else if(k.visibleEvil.some(s=>g.team.includes(s))){code='PRIVATE_ROLE_KNOWLEDGE';reason='依照自身角色可合法知道的資訊，此隊伍有不適合支持的人。';}
 else if(g.round===1&&g.attempt===1&&g.missions.length===0&&!included&&k.role==='LOYAL'){
  code=approve?'UNINFORMED_OUTSIDER_EXPLORATION':'UNINFORMED_OUTSIDER_CAUTION';
  reason=approve?'第一輪無確證且自己未入隊；仍選擇放行以觀察任務結果，並不代表認定隊員是好人。':'第一輪無確證且自己未入隊；至少自己是可確認的安全隊員，因此先採保守反對。';
 }else if(included){code='SELF_INCLUDED';reason='自己在隊伍內；結合目前公開證據與個人信任評估作出這次決定。';}
 else {code='PUBLIC_EVIDENCE_AND_STANCE';reason='依目前已公開的任務結果、自己保存的信任評分及隊伍風險作出決定。';}
 return {round:g.round,attempt:g.attempt,team:[...g.team],approve,code,reason,source:'RULE_ENGINE_AT_DECISION_TIME',eventSeq:g.revision};
}
export function safePromptRules(g,seat){return {rules:FIXED_RULES,publicInferences:publicLogic(g),deductions:seat==null?undefined:deductionForSeat(g,seat)};}
