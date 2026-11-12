// Deterministic possible-world constraints derived exclusively from a seat's legal
// role knowledge and published mission cards. No other NPC memory, secret vote,
// hidden role table, or unrevealed card is read.
import {knowledge,EVIL} from './core.js';
const SEATS=[1,2,3,4,5,6,7];
function combinations(xs,n){if(n===0)return [[]];if(xs.length<n)return [];return xs.flatMap((x,i)=>combinations(xs.slice(i+1),n-1).map(rest=>[x,...rest]));}
export function deductionForSeat(g,seat){
 const k=knowledge(g,seat);
 const ownEvil=EVIL.has(k.role);
 const definitelyEvil=ownEvil?[seat,...k.evilTeammates]:k.role==='MERLIN'?[...k.visibleEvil]:[];
 const definitelyGood=ownEvil?[]:[seat];
 const worlds=combinations(SEATS,3).filter(evil=>{
  if(definitelyEvil.some(s=>!evil.includes(s))||definitelyGood.some(s=>evil.includes(s)))return false;
  // A revealed FAIL card must have been submitted by evil; evil may play SUCCESS.
  return (g.missions||[]).every(m=>m.team.filter(s=>evil.includes(s)).length>=m.fails);
 });
 const possible=SEATS.filter(s=>worlds.some(w=>w.includes(s)));
 const necessary=SEATS.filter(s=>worlds.length>0&&worlds.every(w=>w.includes(s)));
 const excluded=SEATS.filter(s=>worlds.length>0&&worlds.every(w=>!w.includes(s)));
 const minEvilYes=(g.events||[]).filter(e=>e.type==='VOTE_REVEAL').slice(-1).map(e=>Math.max(0,e.payload.yes-4))[0]??null;
 return {
  interpretation:'Consistent hypothetical evil groups, NOT probabilities. Evil can submit success. Never publicly expose role-only knowledge simply because it is in this private view.',
  possibleWorldCount:worlds.length,possibleEvilSeats:possible,necessaryEvilSeats:necessary,excludedEvilSeats:excluded,
  latestVoteMinimumEvilYes:minEvilYes,
  constraints:(g.missions||[]).map(m=>({round:m.round,team:[...m.team],observedFails:m.fails,minimumEvilOnTeam:m.fails})),
  warning:worlds.length===0?'No consistent worlds found; treat as a data/rules inconsistency, not proof of any identity.':null
 };
}
