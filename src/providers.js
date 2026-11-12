// All provider calls are per-seat and receive only an authorized perspective.
// Never send complete game state, other NPC memories, or identity assignments.
import {NPC_SEATS,selectedRoute,sixModelEnabled} from './routing25.js';
const PROVIDERS = new Set(['gemini','groq','openrouter','cloudflare']);
const DEFAULT_MODELS = {gemini:'gemini-3.5-flash-lite',groq:'openai/gpt-oss-20b',openrouter:'openai/gpt-oss-20b:free',cloudflare:'@cf/zai-org/glm-4.7-flash'};
const SCHEMA={
 SPEAK:{type:'OBJECT',properties:{text:{type:'STRING'},beliefUpdate:{type:'OBJECT',properties:{note:{type:'STRING'},stances:{type:'ARRAY',items:{type:'OBJECT',properties:{seat:{type:'INTEGER'},score:{type:'NUMBER'}},required:['seat','score']}}},required:['note']}},required:['text','beliefUpdate']},
 PROPOSE:{type:'OBJECT',properties:{team:{type:'ARRAY',items:{type:'INTEGER'}}},required:['team']},
 VOTE:{type:'OBJECT',properties:{approve:{type:'BOOLEAN'}},required:['approve']},
 MISSION:{type:'OBJECT',properties:{fail:{type:'BOOLEAN'}},required:['fail']},
 ASSASSINATE:{type:'OBJECT',properties:{ranking:{type:'ARRAY',items:{type:'OBJECT',properties:{seat:{type:'INTEGER'},score:{type:'NUMBER'},support:{type:'ARRAY',items:{type:'STRING'}},against:{type:'ARRAY',items:{type:'STRING'}}},required:['seat','score','support','against']}},target:{type:'INTEGER'}},required:['ranking','target']}
};
const URLS = {groq:'https://api.groq.com/openai/v1/chat/completions',openrouter:'https://openrouter.ai/api/v1/chat/completions'};
export function validateRoute(route,seat){
 if(!NPC_SEATS.includes(seat))throw Error('Not an NPC seat');
 const provider=route.provider;
 if(!PROVIDERS.has(provider))throw Error(`NPC ${seat}: invalid provider`);
 const model=route.model||DEFAULT_MODELS[provider];
 if(!/^[\w.@\-/:]{3,100}$/.test(model))throw Error(`NPC ${seat}: invalid model identifier`);
 if(provider==='groq'&&!new Set(['openai/gpt-oss-20b','openai/gpt-oss-120b','llama-3.3-70b-versatile','llama-3.1-8b-instant','qwen/qwen3.8-27b']).has(model))throw Error(`NPC ${seat}: Groq model is not on the free-tier allowlist`);
 if(provider==='cloudflare'&&!new Set(['@cf/zai-org/glm-4.7-flash','@cf/google/gemma-4-26b-a4b-it','@cf/nvidia/nemotron-3-120b-a12b']).has(model))throw Error(`NPC ${seat}: Cloudflare model is not on the Workers Free allowlist`);
 if(provider==='openrouter'&&!model.endsWith(':free'))throw Error(`NPC ${seat}: only OpenRouter :free models are allowed`);
 const keyName={gemini:'GEMINI_API_KEY',groq:'GROQ_API_KEY',openrouter:'OPENROUTER_API_KEY',cloudflare:'CLOUDFLARE_API_TOKEN'}[provider];
 return {provider,model,configured:Boolean(process.env[keyName])&&(provider!=='cloudflare'||Boolean(process.env.CLOUDFLARE_ACCOUNT_ID)),keyName};
}
export function seatConfig(seat){return validateRoute(selectedRoute(seat),seat);}
export function fallbackConfig(seat){
 const raw=process.env[`AVALON_NPC_${seat}_FALLBACK`];
 if(!raw)return null;
 const [provider,model,...rest]=raw.split("|");
 if(rest.length||!provider||!model)throw Error(`NPC ${seat}: FALLBACK must be provider|model`);
 const fallback=validateRoute({provider:provider.toLowerCase(),model},seat);
 if(!fallback.configured)throw Error(`AI_PROVIDER_NOT_CONFIGURED: ${seat} 號備援缺少 ${fallback.keyName}`);
 return fallback;
}
export function routingStatus(){return NPC_SEATS.map(seat=>({seat,...((({provider,model,configured})=>({provider,model,configured}))(seatConfig(seat)))}));}
export function routingMode(){return sixModelEnabled()?'six-model':'legacy';}
export function rosterReady(){return routingStatus().every(x=>x.configured);}
export function anyCloudConfigured(){return routingStatus().some(x=>x.configured);}
export function requestSpec({seat,action,instructions,view,routeOverride=null}){
 const config=routeOverride?validateRoute(routeOverride,seat):seatConfig(seat);
 if(!config.configured)throw Error(`AI_PROVIDER_NOT_CONFIGURED: ${seat} 號 NPC 缺少 ${config.provider==='cloudflare'?'CLOUDFLARE_API_TOKEN 或 CLOUDFLARE_ACCOUNT_ID':config.keyName}，請到 Railway 設定；不會默默改用其他模型。`);
 const {provider,model,keyName}=config;
 if(provider==='gemini'){
  const generationConfig={responseMimeType:'application/json',responseSchema:SCHEMA[action],maxOutputTokens:action==='ASSASSINATE'?3000:1800};
  // Gemini thinking output may consume token budget. Do not force unsupported settings.
  if(model.startsWith('gemini-2.5'))generationConfig.thinkingConfig={thinkingBudget:0};
  return {provider,model,url:`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
   headers:{'Content-Type':'application/json','x-goog-api-key':process.env[keyName]},
   body:{systemInstruction:{parts:[{text:instructions}]},contents:[{role:'user',parts:[{text:JSON.stringify(view)}]}],generationConfig}};
 }
 const url=provider==='cloudflare' ? `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID||'')}/ai/v1/chat/completions` : URLS[provider];
 return {provider,model,url,headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env[keyName]}`},
  body:{model,messages:[{role:'system',content:instructions},{role:'user',content:JSON.stringify(view)}],response_format:{type:'json_object'},temperature:action==='SPEAK'?0.65:0.2,max_tokens:action==='ASSASSINATE'?3000:1600}};
}
export function extractOutput(provider,raw){
 let content;
 if(provider==='gemini'){
  const reason=raw?.candidates?.[0]?.finishReason;
  content=raw?.candidates?.[0]?.content?.parts?.filter(x=>typeof x.text==='string').map(x=>x.text).join('');
  if(!content)throw Error(`AI_EMPTY_RESPONSE: Gemini 沒有輸出文字（${reason||'無結束原因'}）。`);
 }else{
  content=raw?.choices?.[0]?.message?.content;
  if(typeof content!=='string'||!content)throw Error('AI_EMPTY_RESPONSE: 模型沒有輸出文字。');
 }
 try{
  const obj=JSON.parse(content.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));
  if(!obj||Array.isArray(obj)||typeof obj!=='object')throw Error('not object');
  return obj;
 }catch{throw Error('AI_INVALID_JSON: 模型回傳的 JSON 格式無效，已保留玩家操作，可重試；沒有改用付費模型。');}
}
export async function callProvider(spec,fetchImpl=fetch){
 let response;
 try{response=await fetchImpl(spec.url,{method:'POST',headers:spec.headers,body:JSON.stringify(spec.body),signal:AbortSignal.timeout(40000)});}
 catch(e){throw Error(`AI_NETWORK_ERROR: ${e.name==='TimeoutError'?'模型呼叫逾時':'無法連線到供應商'}；沒有切換模型。`);}
 if(!response.ok){
  const status=response.status;
  if(status===429)throw Error(`AI_QUOTA: ${spec.provider} 供應商免費額度或頻率已達限制。`);
  if(status===401||status===403)throw Error('AI_AUTH: API Key 或模型權限有問題。');
  if(status===404)throw Error('AI_MODEL_NOT_FOUND: 目前設定的模型無法使用，請核對供應商模型清單。');
  throw Error(`AI_HTTP_${status}: 模型請求失敗；不會改用付費模型。`);
 }
 const data=await response.json().catch(()=>{throw Error('AI_INVALID_HTTP_JSON: 供應商回應無效。');});
 return extractOutput(spec.provider,data);
}
