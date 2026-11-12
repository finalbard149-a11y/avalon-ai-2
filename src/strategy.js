// 2.4: zero-API operational decisions. Each decision sees only this seat's
// legal knowledge, public evidence and its own persisted memory.
import {createHash} from 'node:crypto';
import {knowledge,perspective,EVIL,SIZES} from './core.js';
export const FIXED_RULES=Object.freeze({
 sevenPlayers:'Seven players include three evil roles and four good roles.',
 rejection:'Proposals 1-4 can be rejected. Rejecting proposal 5 immediately ends the game with evil victory; it does not auto-pass.',
 unanimous:'7 YES votes means all seven players (including all three evil players) voted YES. This does not prove that the proposed team includes evil or that the mission will fail.',
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
  previousVote:prior?{yes:prior.payload.yes,passed:prior.payload.passed,unanimous:prior.payload.yes===7}:null,
  team:g.team,
  missionHistory:g.missions.map(x=>({round:x.round,team:x.team,success:x.success,fails:x.fails})),
  implications:prior?.payload.yes===7?['All seven votes were YES, including the three evil votes.','No role or team membership follows with certainty from unanimity.']:[]
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
  const base=Math.max(0.05,Math.min(0.95,0.52+(previouslySuccessful>0?0.10:0)+(g.team.includes(seat)?0.15:0)+influence*0.16));
  return {approve:r<base};
 }
 throw Error(`zero cost action not supported: ${action}`);
}
export function safePromptRules(g){return {rules:FIXED_RULES,publicInferences:publicLogic(g)};}
