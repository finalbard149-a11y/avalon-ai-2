// Model request counters are conservative: attempted/failed requests count.
export const DAILY_LIMIT=readLimit('AVALON_DAILY_CALL_LIMIT',150,1,10000);
export const GAME_LIMIT=readLimit('AVALON_GAME_CALL_LIMIT',90,1,10000);
export const SEAT_LIMIT=readLimit('AVALON_NPC_CALL_LIMIT',16,1,1000);
export const PROVIDER_LIMITS=Object.freeze({
 gemini:readLimit('AVALON_GEMINI_DAILY_LIMIT',40,1,10000),
 groq:readLimit('AVALON_GROQ_DAILY_LIMIT',60,1,10000),
 openrouter:readLimit('AVALON_OPENROUTER_DAILY_LIMIT',40,1,10000),
 cloudflare:readLimit('AVALON_CLOUDFLARE_DAILY_LIMIT',30,1,10000)
});
function readLimit(name,def,min,max){const v=process.env[name];if(v===undefined||v==='')return def;const n=Number(v);if(!Number.isSafeInteger(n)||n<min||n>max)throw Error(`${name} must be ${min}..${max}`);return n;}
export async function reserveCall(g,seat,provider){
 const {reserveScopedCall}=await import('./store.js');
 const result=await reserveScopedCall(g.id,seat,provider,{gameLimit:GAME_LIMIT,dailyLimit:DAILY_LIMIT,seatLimit:SEAT_LIMIT,providerLimit:PROVIDER_LIMITS[provider]});
 if(!result.ok)throw Error(`AI_CALL_LIMIT: ${result.reason}。已保留玩家發言，不會改用付費模型。`);
 g.aiCallCount=result.game;
 return result;
}
