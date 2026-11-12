import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../src/core.js';
import {ROSTER_25,selectedRoute} from '../src/routing25.js';
import {routingStatus,requestSpec,validateRoute,fallbackConfig} from '../src/providers.js';
import {reserveScopedCall} from '../src/store.js';
import {sanitizedRequest} from '../src/agents.js';
const withEnv=(pairs,cb)=>{const before=Object.fromEntries(Object.keys(pairs).map(k=>[k,process.env[k]]));try{for(const [k,v] of Object.entries(pairs)){if(v===undefined)delete process.env[k];else process.env[k]=v;}return cb();}finally{for(const [k,v] of Object.entries(before)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}};
test('six seat roster uses six unique models and only three platform keys',()=>{
 const routes=Object.values(ROSTER_25);assert.equal(routes.length,6);assert.equal(new Set(routes.map(x=>x.model)).size,6);
 assert.deepEqual([...new Set(routes.map(x=>x.provider))].sort(),['gemini','groq','openrouter']);
});
test('six-model mode is opt-in and inherited legacy Gemini is safe',()=>{
 withEnv({AVALON_SIX_MODEL_MODE:undefined,GEMINI_MODEL:'gemini-3.5-flash-lite'},()=>assert.equal(selectedRoute(2).provider,'gemini'));
 withEnv({AVALON_SIX_MODEL_MODE:'1'},()=>{assert.equal(selectedRoute(2).model,'openai/gpt-oss-20b');assert.equal(selectedRoute(5).provider,'openrouter');});
});
test('OpenRouter cannot be assigned a paid model, including fallback',()=>{
 assert.throws(()=>validateRoute({provider:'openrouter',model:'openai/gpt-4.1'},5),/:free/);
 withEnv({AVALON_NPC_5_FALLBACK:'openrouter|anthropic/claude-sonnet'},()=>assert.throws(()=>fallbackConfig(5),/:free/));
});
test('missing a provider key is plainly displayed and never silently redirects',()=>{
 withEnv({AVALON_SIX_MODEL_MODE:'1',GROQ_API_KEY:undefined,OPENROUTER_API_KEY:undefined},()=>{
  const statuses=routingStatus();assert.equal(statuses.length,6);
  assert.equal(statuses.find(x=>x.seat===2).configured,false);
  assert.equal(statuses.find(x=>x.seat===5).configured,false);
  assert.throws(()=>requestSpec({seat:2,action:'SPEAK',instructions:'x',view:{}}),/AI_PROVIDER_NOT_CONFIGURED/);
 });
});
test('six model requests only include seat legal knowledge and public rules',()=>{
 withEnv({AVALON_SIX_MODEL_MODE:'1',GROQ_API_KEY:'fake',OPENROUTER_API_KEY:'fake',GEMINI_API_KEY:'fake'},()=>{
  const g=createGame({roles:['MERLIN','ASSASSIN','LOYAL','PERCIVAL','MORGANA','LOYAL','MORDRED']});
  const view=sanitizedRequest(g,2,'SPEAK');const spec=requestSpec({seat:2,action:'SPEAK',...view});
  assert.equal(spec.model,ROSTER_25[2].model);assert.deepEqual(JSON.parse(spec.body.messages[1].content),view.view);
  assert.equal('roles' in view.view,false);
  assert.equal('apiKey' in view.view,false);
 });
});
test('quota grants slots across providers atomically in development mode',async()=>{
 const g=createGame(),limit={gameLimit:2,dailyLimit:100,seatLimit:1,providerLimit:1};
 assert.equal((await reserveScopedCall(g.id,1,'gemini',limit)).ok,true);
 const blocked=await reserveScopedCall(g.id,1,'gemini',limit);assert.equal(blocked.ok,false);assert.match(blocked.reason,/NPC/);
 assert.equal((await reserveScopedCall(g.id,2,'openrouter',limit)).ok,true);
 assert.equal((await reserveScopedCall(g.id,4,'groq',limit)).ok,false);
});
test('provider daily quota is shared by models under one provider',async()=>{
 const a=createGame(),b=createGame(),limit={gameLimit:100,dailyLimit:100,seatLimit:100,providerLimit:1};
 // New provider unique per test avoids collisions with other parallel quota tests.
 assert.equal((await reserveScopedCall(a.id,5,'testshared',limit)).ok,true);
 assert.equal((await reserveScopedCall(b.id,6,'testshared',limit)).ok,false);
});
