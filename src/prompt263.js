// Compact model input; full game history remains durable in PostgreSQL.
// Only derived perspective() and THIS seat's memory enter this transformer.
import {perspective} from './core.js';
import {memoryPrompt} from './memory26.js';
import {accountabilityContext} from './reasoning262.js';
import {safePromptRules} from './strategy.js';
const clip=(v,n=220)=>String(v||'').slice(0,n);
export function compactPrompt(g,seat,action){
 const p=perspective(g,seat),b=memoryPrompt(g,seat).autobiography;
 const talk=p.public.publicMessages||[];
 const context=action==='SPEAK'?accountabilityContext(g,seat):null;
 const recentTalk=talk.slice(-12).map(x=>({seat:x.seat,text:clip(x.text,240),seq:x.seq}));
 // The human's latest question is always included, plus challenged own verbatim lines.
 const recentEvents=p.public.events.filter(e=>['PROPOSE','VOTE_REVEAL','MISSION_RESULT','FIVE_REJECTIONS'].includes(e.type)).slice(-14);
 const ownHistory=b.history.filter(x=>x.kind!=='OWN_SPEECH').slice(-13);
 const words=b.recentOwnWords.slice(-7);
 return {
  self:p.self,
  public:{phase:p.public.phase,round:p.public.round,attempt:p.public.attempt,captain:p.public.captain,team:p.public.team,missionSize:p.public.missionSize,missions:p.public.missions,events:recentEvents,publicMessages:recentTalk,winningTeam:p.public.winningTeam},
  personalHistory:{autobiography:{history:ownHistory,recentOwnWords:words,ownMissionCards:b.ownMissionCards,selfNote:b.selfNote,stances:b.stances,ownProposalReasons:b.ownProposalReasons,ownVoteReasons:b.ownVoteReasons,strategyNotes:b.strategyNotes},accountabilityRules:[
   'Your own past public words are facts: acknowledge or retract, never deny saying them.',
   'Explain votes using the ownVoteReasons record made at decision time; do not invent reasons.',
   'Never confuse logically proven identities with suspicion; private role knowledge must remain secret.',
   'Evil may bluff intentionally, but must remember its own earlier public claims.'
  ]},
  accountability:context,
  rulesContext:safePromptRules(g,seat)
 };
}
export function promptFootprint(spec){
 // Counts characters and UTF-8 bytes. These are NOT billed token counts.
 const body=JSON.stringify(spec.body);
 return {characters:body.length,utf8Bytes:Buffer.byteLength(body),systemCharacters:spec.provider==='gemini'?String(spec.body.systemInstruction?.parts?.[0]?.text||'').length:String(spec.body.messages?.[0]?.content||'').length};
}
