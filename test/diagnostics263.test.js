import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGame,speak,propose,vote} from '../src/core.js';
import {sanitizedRequest} from '../src/agents.js';
import {promptFootprint} from '../src/prompt263.js';
import {callProvider,requestSpec} from '../src/providers.js';
import {accountabilityContext} from '../src/reasoning262.js';
const roles=['LOYAL','LOYAL','ASSASSIN','MORGANA','PERCIVAL','MORDRED','MERLIN'];
const game=()=>createGame({roles});
test('2.6.3 compact prompt does not repeat entire public chat and still keeps latest question',()=>{
 const g=game();for(let i=0;i<25;i++)speak(g,3,`舊發言-${i}-`+'內容'.repeat(90));
 speak(g,2,'我剛才認定 3 號很可疑。');speak(g,3,'2號，你剛才的推論有什麼理由？');
 const view=sanitizedRequest(g,2,'SPEAK').view;
 assert.equal(view.public.publicMessages.at(-1).seat,3);
 assert.match(view.personalHistory.autobiography.recentOwnWords.at(-1).text,/我剛才認定/);
 assert.equal(view.public.publicMessages.length,12);
 assert.equal(view.public.events.length,0);
 assert.equal(view.accountability.challenged,true);
 assert.ok(!JSON.stringify(view).includes('舊發言-0-'));
 assert.ok(!('roles' in view));
});
test('private notes from a different NPC never enter a compact prompt',()=>{
 const g=game();g.npcMemory[4]={note:'OTHER_SEAT_PRIVATE_SECRET',ownVoteReasons:[{reason:'OTHER_VOTE_SECRET'}]};
 const s=JSON.stringify(sanitizedRequest(g,2,'SPEAK'));
 assert.ok(!s.includes('OTHER_SEAT_PRIVATE_SECRET'));
 assert.ok(!s.includes('OTHER_VOTE_SECRET'));
});
test('model prompt bytes are measured without exposing content',()=>{
 const s={provider:'groq',body:{messages:[{role:'user',content:'測試資料'}]}};
 const m=promptFootprint(s);
 assert.ok(m.utf8Bytes>m.characters);
 assert.equal(m.estimatedTokens,undefined);
 assert.equal(JSON.stringify(m).includes('測試資料'),false);
});
test('429 diagnostics use Retry-After when provided and default when absent; no extra model calls',async()=>{
 const logs=[];const orig=console.info;console.info=(...args)=>logs.push(args.join(' '));
 try{
  const spec={provider:'openrouter',model:'free-test',url:'https://example.invalid',headers:{},body:{messages:[]}};
  await assert.rejects(callProvider(spec,async()=>({ok:false,status:429,headers:{get:(n)=>n==='retry-after'?'17':null}})),e=>e.code==='AI_QUOTA'&&e.retryAfterSeconds===17&&e.retryAfterSource==='header');
  await assert.rejects(callProvider(spec,async()=>({ok:false,status:429,headers:{get:()=>null}})),e=>e.retryAfterSeconds===60&&e.retryAfterSource==='default');
  assert.equal(logs.length,2);
  assert.match(logs[0],/"retryAfterSource":"header"/);
  assert.ok(logs.every(x=>!x.includes('https://example.invalid')));
 }finally{console.info=orig;}
});
test('provider token usage logged only when returned, without logging prompt',async()=>{
 const logs=[];const orig=console.info;console.info=(...args)=>logs.push(args.join(' '));
 try{
  const spec={provider:'groq',model:'test',url:'https://example.invalid',headers:{Authorization:'SECRET_TOKEN'},body:{messages:[{role:'user',content:'PRIVATE_ROLE_DATA'}]}};
  const data={choices:[{message:{content:'{"text":"收到"}'}}],usage:{prompt_tokens:88,completion_tokens:12,total_tokens:100}};
  assert.deepEqual(await callProvider(spec,async()=>({ok:true,status:200,json:async()=>data})),{text:'收到'});
  assert.match(logs[0],/"inputTokens":88/);
  assert.match(logs[0],/"totalTokens":100/);
  assert.ok(!logs.join(' ').includes('SECRET_TOKEN'));
  assert.ok(!logs.join(' ').includes('PRIVATE_ROLE_DATA'));
 }finally{console.info=orig;}
});
test('visible page version and package version both reflect 2.6.3',()=>{
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
 assert.match(pkg.version,/^2\.6\.3/);
 assert.match(html,/Fair Play Engine 2\.6\.3/);
 assert.match(html,/<title>Avalon AI 2\.6\.3/);
 assert.ok(!html.includes('Fair Play Engine 2.6.1'));
});
test('cooldown UI reads provider status and renders provider-specific expiry',()=>{
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 assert.match(html,/api\/provider-status/);
 assert.match(html,/模型供應商暫時冷卻/);
 assert.match(html,/providerCooldowns/);
});
