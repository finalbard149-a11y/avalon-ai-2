// All provider calls are per-seat and receive only an authorized perspective.
// Never send complete game state, other NPC memories, or identity assignments.
import {NPC_SEATS,selectedRoute,sixModelEnabled} from './routing25.js';
import {promptFootprint} from './prompt263.js';
const PROVIDERS = new Set(['gemini','groq','openrouter','cloudflare']);
const DEFAULT_MODELS = {gemini:'gemini-3.5-flash-lite',groq:'openai/gpt-oss-20b',openrouter:'openai/gpt-oss-20b:free',cloudflare:'@cf/zai-org/glm-4.7-flash'};
const SCHEMA={
 SPEAK:{type:'OBJECT',properties:{text:{type:'STRING'},beliefUpdate:{type:'OBJECT',properties:{note:{type:'STRING'},stances:{type:'ARRAY',items:{type:'OBJECT',properties:{seat:{type:'INTEGER'},score:{type:'NUMBER'}},required:['seat','score']}}},required:['note']},strategyPlan:{type:'OBJECT',properties:{intent:{type:'STRING',enum:['SUPPORT','OPPOSE','UNDECIDED']},reasons:{type:'ARRAY',items:{type:'STRING'}},publicClaims:{type:'ARRAY',items:{type:'STRING'}},uncertainties:{type:'ARRAY',items:{type:'STRING'}}},required:['intent','reasons']}},required:['text','beliefUpdate']},
 PROPOSE:{type:'OBJECT',properties:{team:{type:'ARRAY',items:{type:'INTEGER'}},reason:{type:'STRING'}},required:['team']},
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
export function routingMode(){return process.env.AVALON_SHARED_PROVIDER&&process.env.AVALON_SHARED_MODEL?'shared-brain-2.7':(sixModelEnabled()?'six-model':'legacy');}
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
 const body={model,messages:[{role:'system',content:instructions},{role:'user',content:JSON.stringify(view)}],response_format:{type:'json_object'},temperature:action==='SPEAK'?0.65:0.2,max_tokens:action==='ASSASSINATE'?3000:1600};
 // GLM-4.7-Flash enables reasoning by default. Reasoning may exhaust max_tokens
 // and leave choices[0].message.content empty. Cloudflare documents this setting.
 if(provider==='cloudflare'&&model==='@cf/zai-org/glm-4.7-flash'){
  body.chat_template_kwargs={enable_thinking:false};
  body.max_completion_tokens=action==='ASSASSINATE'?2500:1500;
  delete body.max_tokens;
 }
 return {provider,model,url,headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env[keyName]}`},body};
}
export function extractOutput(provider,raw){
 let content;
 if(provider==='gemini'){
  const reason=raw?.candidates?.[0]?.finishReason;
  content=raw?.candidates?.[0]?.content?.parts?.filter(x=>typeof x.text==='string').map(x=>x.text).join('');
  if(!content)throw Error(`AI_EMPTY_RESPONSE: Gemini 沒有輸出文字（${reason||'無結束原因'}）。`);
 }else{
  content=raw?.choices?.[0]?.message?.content;
  // Cloudflare's OpenAI-compatible output can contain content as text parts.
  if(Array.isArray(content))content=content.filter(x=>x?.type==='text'&&typeof x.text==='string').map(x=>x.text).join('');
  if(typeof content!=='string'||!content.trim()){
   const finish=String(raw?.choices?.[0]?.finish_reason||'unknown').slice(0,32);
   throw Error(`AI_EMPTY_RESPONSE: ${provider} 未產生可用回答（finish_reason=${finish}）。請稍後重試；玩家發言已保存。`);
  }
 }
 try{
  const obj=JSON.parse(content.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));
  if(!obj||Array.isArray(obj)||typeof obj!=='object')throw Error('not object');
  return obj;
 }catch{throw Error('AI_INVALID_JSON: 模型回傳的 JSON 格式無效，已保留玩家操作，可重試；沒有改用付費模型。');}
}
// Provider telemetry never logs prompt content, role knowledge, cookies or API keys.
export async function callProvider(spec,fetchImpl=fetch){
 const start=Date.now();let response;
 const metric={provider:spec.provider,model:spec.model,...promptFootprint(spec)};
 const log=(event,extra={})=>console.info('AI_USAGE '+JSON.stringify({...metric,event,elapsedMs:Date.now()-start,...extra}));
 try{response=await fetchImpl(spec.url,{method:'POST',headers:spec.headers,body:JSON.stringify(spec.body),signal:AbortSignal.timeout(spec.provider==='cloudflare'?19000:35000)});}
 catch(e){log('network-error',{reason:e?.name==='TimeoutError'?'timeout':'transport'});throw Error(`AI_NETWORK_ERROR: ${spec.provider} ${e.name==='TimeoutError'?'模型呼叫逾時':'無法連線到供應商'}；玩家發言已保存，可稍後重試。`);}
 if(!response.ok){
  const status=response.status;
  if(status===429){
   const err=new Error(`AI_QUOTA: ${spec.provider} 供應商回傳 HTTP 429（可能為頻率或額度限制），請稍候重試。`);
   err.code='AI_QUOTA';const h=response.headers?.get?.('retry-after');
   const sec=h&&/^\d+$/.test(h)?Number(h):h&&Number.isFinite(Date.parse(h))?Math.ceil((Date.parse(h)-Date.now())/1000):60;
   err.retryAfterSeconds=Math.max(15,Math.min(3600,sec||60));
   err.retryAfterSource=h?'header':'default';
   log('rate-limited',{httpStatus:429,retryAfterSeconds:err.retryAfterSeconds,retryAfterSource:err.retryAfterSource});
   throw err;
  }
  log('http-error',{httpStatus:status});
  if(status===401||status===403)throw Error('AI_AUTH: API Key 或模型權限有問題。');
  if(status===404)throw Error('AI_MODEL_NOT_FOUND: 目前設定的模型無法使用，請核對供應商模型清單。');
  throw Error(`AI_HTTP_${status}: 模型請求失敗；不會改用付費模型。`);
 }
 const data=await response.json().catch(()=>{log('invalid-json');throw Error('AI_INVALID_HTTP_JSON: 供應商回應無效。');});
 const usage= data?.usage || data?.usageMetadata || {};
 const tokenCounts={inputTokens:Number.isFinite(usage.prompt_tokens)?usage.prompt_tokens:Number.isFinite(usage.promptTokenCount)?usage.promptTokenCount:null,outputTokens:Number.isFinite(usage.completion_tokens)?usage.completion_tokens:Number.isFinite(usage.candidatesTokenCount)?usage.candidatesTokenCount:null,totalTokens:Number.isFinite(usage.total_tokens)?usage.total_tokens:Number.isFinite(usage.totalTokenCount)?usage.totalTokenCount:null};
 log('provider-response',{httpStatus:response.status||200,...tokenCounts});
 return extractOutput(spec.provider,data);
}
