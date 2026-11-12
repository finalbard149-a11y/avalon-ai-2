import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractOutput,seatConfig,requestSpec} from '../src/providers.js';
import {createGame} from '../src/core.js';
import {sanitizedRequest} from '../src/agents.js';
const src=(p)=>readFileSync(new URL(p,import.meta.url),'utf8');
const server=src('../src/server.js');const frontend=src('../public/index.html');
const roles=['MERLIN','ASSASSIN','LOYAL','PERCIVAL','MORGANA','LOYAL','MORDRED'];
test('the human statement has a separate database endpoint without model call',()=>{
 const area=server.slice(server.indexOf("u.pathname==='/api/speak'"),server.indexOf("u.pathname==='/api/respond'"));
 assert.match(area,/speak\(game,HUMAN,p\.text\)/);assert.doesNotMatch(area,/aiAction\(/);
});
test('NPC responses are one-per-durable-transaction and remain retryable',()=>{
 const area=server.slice(server.indexOf("u.pathname==='/api/respond'"),server.indexOf("u.pathname==='/api/action'"));
 assert.match(area,/await aiAction\(game,seat,'SPEAK'\)/);
 assert.match(area,/game\.replyQueue\.shift\(\)/);
 assert.match(frontend,/await api\('\/api\/speak'/);
 assert.match(frontend,/await api\('\/api\/respond'/);
 assert.match(frontend,/已保存玩家發言/);
});
test('assassin cannot observe swapped hidden Merlin through any provider request',()=>{
 const a=createGame({roles}),b=createGame({roles});b.id=a.id;b.roles[1]='LOYAL';b.roles[3]='MERLIN';
 const ra=sanitizedRequest(a,2,'ASSASSINATE');const rb=sanitizedRequest(b,2,'ASSASSINATE');
 assert.deepEqual(ra,rb);
});
test('Gemini structured answer handles correct content and fails closed on missing content',()=>{
 assert.deepEqual(extractOutput('gemini',{candidates:[{content:{parts:[{text:'{"text":"有理由"}'}]}}]}),{text:'有理由'});
 assert.throws(()=>extractOutput('gemini',{candidates:[{finishReason:'MAX_TOKENS'}]}),/AI_EMPTY_RESPONSE/);
});
test('no arbitrary provider URL environment can be configured',()=>{
 const cfg=seatConfig(1);assert.ok(['gemini','groq','openrouter'].includes(cfg.provider));
 assert.doesNotMatch(src('../src/providers.js'),/process\.env\.OPENAI_BASE_URL/);
});
test('UI explains reply backlog and shows provider assignment',()=>{
 assert.match(frontend,/NPC 模型配置/);
 assert.match(frontend,/聽取 \/ 重試 NPC 回應/);
 assert.match(frontend,/2\.[345]/);
});
