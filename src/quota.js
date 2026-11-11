// Durable daily request reservation; counts attempts (even failed API calls).
// The user's Google project must remain on its FREE TIER. This is not a billing cap.
// Lazy import: pure model-request tests do not require database client.

export const DAILY_LIMIT=readLimit('AVALON_DAILY_CALL_LIMIT',50,1,1000);
export const GAME_LIMIT=readLimit('AVALON_GAME_CALL_LIMIT',30,1,1000);
function readLimit(name,def,min,max){
 const s=process.env[name];
 if(s===undefined||s==='')return def;
 const n=Number(s);
 if(!Number.isSafeInteger(n)||n<min||n>max)throw Error(`${name} must be an integer from ${min} to ${max}`);
 return n;
}
export async function reserveCall(g){
 if((g.aiCallCount||0)>=GAME_LIMIT)throw Error(`AI_CALL_LIMIT: 本局雲端 AI 已達 ${GAME_LIMIT} 次上限，請稍後調整設定或使用離線測試，不會自動產生付費請求。`);
 const {reserveDailyCall}=await import('./store.js');
 const allowed=await reserveDailyCall(DAILY_LIMIT);
 if(!allowed)throw Error(`AI_CALL_LIMIT: 今日雲端 AI 已達 ${DAILY_LIMIT} 次上限。遊戲進度已保留。`);
 g.aiCallCount=(g.aiCallCount||0)+1;
}
