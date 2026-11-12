// Avalon AI 2.7 research prototype: per-seat, event-bound strategy commitments.
// Pure module, no network, no calls. This is not activated in production gameplay.
import {EVIL,knowledge,perspective} from './core.js';

const SEATS=new Set([1,2,3,4,5,6,7]);
const VALID_INTENTS=new Set(['SUPPORT','OPPOSE','UNDECIDED']);
const clip=(s,n=280)=>String(s||'').slice(0,n);
const clone=x=>structuredClone(x);

export function strategyEventKey(g){
 const lastSpeech=(g.publicMessages||[]).at(-1)?.seq??0;
 return `${g.round}:${g.attempt}:${g.phase}:${g.captain}:${g.team.join(',')}:${g.missions.length}:speech${lastSpeech}`;
}

export function strategyView(g,seat){
 // Do NOT pass g.roles or other seats' npcMemory to the model.
 const p=perspective(g,seat),current=p.memory?.strategy27?.current||null;
 return {
  seat,
  self:p.self,
  situation:{phase:p.public.phase,round:p.public.round,attempt:p.public.attempt,captain:p.public.captain,
   team:[...p.public.team],missions:clone(p.public.missions),eventKey:strategyEventKey(g)},
  recentPublicStatements:p.public.publicMessages.slice(-10).map(x=>({seat:x.seat,text:clip(x.text),seq:x.seq})),
  ownCommitment:current?{eventKey:current.eventKey,intent:current.intent,reasons:clone(current.reasons),publicClaims:clone(current.publicClaims)}:null
 };
}

export function validateStrategyPlan(g,seat,input){
 if(!SEATS.has(seat))throw Error('invalid seat');
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('strategy plan object required');
 const {intent,reasons,publicClaims=[],uncertainties=[]}=input;
 if(!VALID_INTENTS.has(intent))throw Error('invalid intent');
 if(!Array.isArray(reasons)||reasons.length<1||reasons.length>5||reasons.some(x=>typeof x!=='string'||!x.trim()||x.length>280))throw Error('plan needs 1-5 explicit reasons');
 if(!Array.isArray(publicClaims)||publicClaims.length>5||publicClaims.some(x=>typeof x!=='string'||x.length>280))throw Error('invalid public claims');
 if(!Array.isArray(uncertainties)||uncertainties.length>5||uncertainties.some(x=>typeof x!=='string'||x.length>280))throw Error('invalid uncertainties');
 // Strategic recommendations are subjective; avoid pretending they are proven facts.
 // No other role list is inspected here: only this seat's legally permitted knowledge.
 const k=knowledge(g,seat);
 const crisis=g.missions.filter(x=>!x.success).length>=2;
 if(k.role==='MERLIN'&&crisis&&g.team.some(s=>k.visibleEvil.includes(s))&&intent==='SUPPORT')
  throw Error('known-evil crisis team cannot be marked safe by Merlin strategy plan');
 return {intent,reasons:reasons.map(x=>clip(x)),publicClaims:publicClaims.map(x=>clip(x)),uncertainties:uncertainties.map(x=>clip(x))};
}

export function commitStrategyPlan(g,seat,input,{source='MODEL_PLAN'}={}){
 if(!['MODEL_PLAN','RULE_ENGINE_FALLBACK','TEST_REPLAY'].includes(source))throw Error('invalid plan source');
 const plan=validateStrategyPlan(g,seat,input);
 g.npcMemory??={};const old=g.npcMemory[seat]||{};
 const current={eventKey:strategyEventKey(g),round:g.round,attempt:g.attempt,revision:g.revision,
  source,...plan};
 const history=[...(old.strategy27?.history||[])];
 if(old.strategy27?.current)history.push(old.strategy27.current);
 g.npcMemory[seat]={...old,strategy27:{current,history:history.slice(-16)}};
 return clone(current);
}

export function planForDecision(g,seat){
 const plan=g.npcMemory?.[seat]?.strategy27?.current;
 if(!plan)return {ready:false,reason:'NO_PLAN'};
 if(plan.eventKey!==strategyEventKey(g))return {ready:false,reason:'STALE_PLAN'};
 return {ready:true,plan:clone(plan)};
}

export function ballotFromCommittedPlan(g,seat){
 if(g.phase!=='VOTING')throw Error('ballot requires voting phase');
 const state=planForDecision(g,seat);
 if(!state.ready||state.plan.intent==='UNDECIDED')return {decided:false,reason:state.reason||'UNDECIDED'};
 return {decided:true,approve:state.plan.intent==='SUPPORT',
  rationale:clone(state.plan.reasons),source:state.plan.source,
  eventKey:state.plan.eventKey};
}

export function seatPlanAudit(g,seat){
 const m=g.npcMemory?.[seat]?.strategy27;
 return m?clone(m):null;
}
