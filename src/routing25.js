// Explicit six-model roster. A deployment stays in legacy mode until opted in.
// Provider keys belong only in Railway Variables; never in this roster.
export const ROSTER_25=Object.freeze({
  1:{provider:'gemini',model:'gemini-3.5-flash-lite'},
  2:{provider:'groq',model:'openai/gpt-oss-20b'},
  4:{provider:'groq',model:'llama-3.3-70b-versatile'},
  5:{provider:'openrouter',model:'google/gemma-4-26b-a4b-it:free'},
  6:{provider:'openrouter',model:'nvidia/nemotron-3-ultra-550b-a55b:free'},
  7:{provider:'groq',model:'qwen/qwen3.8-27b'}
});
export const NPC_SEATS=Object.freeze([1,2,4,5,6,7]);
export function sixModelEnabled(){return process.env.AVALON_SIX_MODEL_MODE==='1';}
export function selectedRoute(seat){
 if(!NPC_SEATS.includes(seat))throw Error('Not an NPC seat');
 const planned=sixModelEnabled()?ROSTER_25[seat]:{provider:'gemini',model:process.env.GEMINI_MODEL||'gemini-3.5-flash-lite'};
 // Optional shared brain, but never a shared memory/context. Explicit per-seat overrides win.
 const sharedProvider=process.env.AVALON_SHARED_PROVIDER?.trim();
 const sharedModel=process.env.AVALON_SHARED_MODEL?.trim();
 if(Boolean(sharedProvider)!==Boolean(sharedModel))throw Error('AVALON_SHARED_PROVIDER and AVALON_SHARED_MODEL must be configured together');
 return {provider:(process.env[`AVALON_NPC_${seat}_PROVIDER`]||sharedProvider||planned.provider).toLowerCase(),model:process.env[`AVALON_NPC_${seat}_MODEL`]||sharedModel||planned.model};
}
