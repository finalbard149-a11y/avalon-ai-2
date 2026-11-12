// Validate a model proposal BEFORE it is allowed to reach the rules engine.
// Only use the proposing NPC's lawful role knowledge and public mission results.
import {EVIL,knowledge,SIZES} from './core.js';
import {zeroCostDecision} from './strategy.js';
const SEATS=[1,2,3,4,5,6,7];
export function inspectProposal(g,seat,team){
 const required=SIZES[g.round-1];
 if(g.phase!=='DISCUSSION'||g.captain!==seat)return {ok:false,code:'WRONG_PHASE_OR_CAPTAIN'};
 if(!Array.isArray(team))return {ok:false,code:'MISSING_TEAM'};
 if(team.length!==required||new Set(team).size!==required||!team.every(s=>Number.isInteger(s)&&s>=1&&s<=7))return {ok:false,code:'INVALID_TEAM_SHAPE'};
 const k=knowledge(g,seat);
 const losses=g.missions.filter(m=>!m.success).length;
 // Prevent a model or fallback from handing evil the third loss knowingly.
 // Merlin can see the Assassin and Morgana, but NOT Mordred.
 if(!EVIL.has(k.role)&&losses>=2&&team.some(s=>k.visibleEvil.includes(s)))return {ok:false,code:'KNOWN_EVIL_ON_ELIMINATION_MISSION'};
 return {ok:true,code:'ACCEPTED'};
}
export function safeProposalFallback(g,seat){
 const k=knowledge(g,seat);
 const suggested=zeroCostDecision(g,seat,'PROPOSE').team;
 const losses=g.missions.filter(m=>!m.success).length;
 const excluded=(!EVIL.has(k.role)&&losses>=2)?new Set(k.visibleEvil):new Set();
 const pool=[...new Set([...suggested,seat,...SEATS])].filter(s=>!excluded.has(s));
 const team=pool.slice(0,SIZES[g.round-1]);
 const result=inspectProposal(g,seat,team);
 if(!result.ok)throw Error(`SAFE_PROPOSAL_UNAVAILABLE: ${result.code}`);
 return {team,reason:'本次 AI 提案未通過檢查；由個人策略引擎依合法資訊重新選隊（不額外呼叫模型）。'};
}
