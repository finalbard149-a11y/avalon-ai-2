// Provider requests use reserved (not successful) call counts. Free-tier keys only;
// quota guards are not a substitute for provider billing account controls.
export const DAILY_LIMIT=readLimit('AVALON_DAILY_CALL_LIMIT',50,1,1000);
export const GAME_LIMIT=readLimit('AVALON_GAME_CALL_LIMIT',30,1,1000);
function readLimit(name,def,min,max){const v=process.env[name];if(v===undefined||v==='')return def;const n=Number(v);if(!Number.isSafeInteger(n)||n<min||n>max)throw Error(`${name} must be ${min}..${max}`);return n;}
export async function reserveCall(g){
 const {reserveGameCall,reserveDailyCall}=await import('./store.js');
 const count=await reserveGameCall(g.id,GAME_LIMIT);
 if(count===null)throw Error(`AI_CALL_LIMIT: 本局已達 ${GAME_LIMIT} 次請求上限。`);
 g.aiCallCount=count;
 if(!await reserveDailyCall(DAILY_LIMIT))throw Error(`AI_CALL_LIMIT: 今日已達 ${DAILY_LIMIT} 次請求上限。`);
}
