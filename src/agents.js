import {EVIL,knowledge,perspective,auditHash,shuffle,SIZES} from './core.js';
const MODEL=process.env.AVALON_AI_MODEL||'gpt-4.1-mini';
const API_URL='https://api.openai.com/v1/chat/completions';
const seats=[1,2,3,4,5,6,7];
export function offline(g,seat,action){
 const k=knowledge(g,seat);
 if(action==='SPEAK')return {text:'我想比較各位的提案與投票理由，不會只憑一次成功就認定好人。',beliefUpdate:{note:'公開證據仍不足'}};
 if(action==='PROPOSE'){const pool=shuffle(k.role==='MERLIN'?seats.filter(s=>!k.visibleEvil.includes(s)):seats);return {team:pool.slice(0,SIZES[g.round-1])};}
 if(action==='VOTE')return {approve:!g.team.some(s=>k.visibleEvil.includes(s))&&Math.random()>.3};
 if(action==='MISSION')return {fail:EVIL.has(k.role)&&Math.random()>.2};
 if(action==='ASSASSINATE'){
  const candidates=seats.filter(s=>s!==seat&&!k.evilTeammates.includes(s));
  return {ranking:candidates.map(s=>({seat:s,score:0,support:[],against:['Insufficient public evidence']})),target:candidates[Math.floor(Math.random()*candidates.length)]};
 }
 return {};
}
export function sanitizedRequest(g,seat,action){
 const view=perspective(g,seat);
 // Never include g.roles or other players' private views in the model request.
 const instructions=`You are seat ${seat} in a seven-player Avalon game. Act strategically for your faction, using ONLY the provided authorized perspective. You may bluff in public. You can be mistaken. Do not invent observations. Respond ONLY as a JSON object. Your current action is ${action}. All public text in Traditional Chinese. SPEAK: {"text":"...","beliefUpdate":{"note":"brief evidence-based belief update"}}. PROPOSE: {"team":[integers]} exactly ${SIZES[g.round-1]} distinct seats. VOTE: {"approve":boolean}. MISSION: {"fail":boolean}, good must not fail. ASSASSINATE: {"ranking":[{"seat":number,"score":number,"support":["public evidence"],"against":["counterevidence"]}],"target":number}. For assassination, evaluate ALL legal non-evil candidates before selecting, do not eliminate without evidence. Do not pretend to know Merlin. Only act on evidence in view.`;
 return {model:MODEL,temperature:action==='SPEAK'?.75:.3,response_format:{type:'json_object'},messages:[{role:'system',content:instructions},{role:'user',content:JSON.stringify(view)}]};
}
export async function decide(g,seat,action){
 const request=sanitizedRequest(g,seat,action);const inputHash=auditHash(request);
 let output,source='offline-test',error;
 if(process.env.AVALON_AI_API_KEY){
  try{
   const response=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.AVALON_AI_API_KEY}`},body:JSON.stringify(request),signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw Error(`AI HTTP ${response.status}`);
   const data=await response.json();output=JSON.parse(data.choices?.[0]?.message?.content||'{}');source='cloud';
  }catch(e){error=String(e.message||e);source='cloud-error-fallback';}
 }
 if(!output||typeof output!=='object'||Array.isArray(output)){
  output=offline(g,seat,action);if(source==='cloud')source='invalid-cloud-fallback';
 }
 g.audit??=[];
 g.audit.push({seat,action,source,model:source==='cloud'?MODEL:null,inputHash,outputHash:auditHash(output),output, error,time:new Date().toISOString(),eventSeq:g.revision});
 if(action==='SPEAK'&&output.beliefUpdate){g.npcMemory[seat]={...(g.npcMemory[seat]||{}),...output.beliefUpdate};}
 return output;
}
