import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../src/core.js';
import {sanitizedRequest} from '../src/agents.js';
import {seatConfig,requestSpec,extractOutput,callProvider} from '../src/providers.js';
const roles=['MERLIN','ASSASSIN','LOYAL','PERCIVAL','MORGANA','LOYAL','MORDRED'];
const game=()=>createGame({roles});
const withEnv=async(env,fn)=>{const old=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));try{for(const [k,v] of Object.entries(env)){v===null?delete process.env[k]:process.env[k]=v;}return await fn();}finally{for(const [k,v] of Object.entries(old))v===undefined?delete process.env[k]:process.env[k]=v;}};
test('all six NPC seats have independent routing',()=>{for(const seat of [1,2,4,5,6,7])assert.equal(seatConfig(seat).provider,'gemini');assert.throws(()=>seatConfig(3));});
test('Groq and OpenRouter routes are fixed endpoints and own keys',async()=>withEnv({AVALON_NPC_2_PROVIDER:'groq',AVALON_NPC_2_MODEL:'openai/gpt-oss-20b',GROQ_API_KEY:'test-placeholder',AVALON_NPC_4_PROVIDER:'openrouter',AVALON_NPC_4_MODEL:'openai/gpt-oss-20b:free',OPENROUTER_API_KEY:'test-placeholder'},()=>{
 const input=sanitizedRequest(game(),2,'SPEAK');const a=requestSpec({seat:2,action:'SPEAK',...input});const b=requestSpec({seat:4,action:'SPEAK',...sanitizedRequest(game(),4,'SPEAK')});
 assert.match(a.url,/api.groq.com/);assert.match(b.url,/openrouter.ai/);assert.ok(!('roles' in input.view));
}));
test('OpenRouter rejects paid models even when configured',async()=>withEnv({AVALON_NPC_2_PROVIDER:'openrouter',AVALON_NPC_2_MODEL:'openai/gpt-oss-20b'},()=>assert.throws(()=>seatConfig(2),/only OpenRouter :free/)));
test('Gemini sends JSON MIME with authorized perspective',async()=>withEnv({GEMINI_API_KEY:'test-placeholder'},()=>{
 const spec=requestSpec({seat:2,action:'SPEAK',...sanitizedRequest(game(),2,'SPEAK')});
 assert.equal(spec.body.generationConfig.responseMimeType,'application/json');assert.equal(spec.body.generationConfig.responseSchema.required[0],'text');const view=JSON.parse(spec.body.contents[0].parts[0].text);assert.equal(view.self.role,'ASSASSIN');assert.deepEqual(view.self.evilTeammates,[5,7]);assert.ok(!('roles' in view));
}));
test('swapping secret Merlin gives same assassin prompt',()=>{const a=game(),b=game();b.id=a.id;b.roles[1]='LOYAL';b.roles[3]='MERLIN';assert.deepEqual(sanitizedRequest(a,2,'ASSASSINATE'),sanitizedRequest(b,2,'ASSASSINATE'));});
test('invalid model JSON fails closed and supports fenced JSON',()=>{assert.deepEqual(extractOutput('gemini',{candidates:[{content:{parts:[{text:'```json\n{"text":"可行"}\n```'}]}}]}),{text:'可行'});assert.throws(()=>extractOutput('groq',{choices:[{message:{content:'{bad'}}]}),/AI_INVALID_JSON/);});
test('provider errors do not silently fallback to paid models',async()=>{const spec={provider:'groq',url:'https://api.groq.com/openai/v1/chat/completions',headers:{},body:{}};await assert.rejects(callProvider(spec,async()=>({ok:false,status:429})),/AI_QUOTA/);});
