import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,propose,speak,knowledge} from '../src/core.js';
import {commitStrategyPlan,planForDecision,ballotFromCommittedPlan,strategyView} from '../src/strategy27.js';
import {decide,sanitizedRequest} from '../src/agents.js';
import {selectedRoute} from '../src/routing25.js';
import {routingMode,requestSpec} from '../src/providers.js';
const roles=['ASSASSIN','LOYAL','MERLIN','MORGANA','PERCIVAL','MORDRED','LOYAL'];
const game=()=>createGame({roles});
const plan=(intent='SUPPORT')=>({intent,reasons:['我想觀察這支隊伍的實際任務結果'],publicClaims:[],uncertainties:['隊伍成員仍有可能是邪惡']});
test('NPC vote uses its own model-formed commitment without new external call',async()=>{
 const g=game();propose(g,1,[1,4]);speak(g,2,'我願意先放行收集證據');
 commitStrategyPlan(g,2,plan());
 const vote=await decide(g,2,'VOTE');
 assert.equal(vote.approve,true);assert.equal(vote.decisionOrigin,'MODEL_COMMITMENT_27');
 assert.match(vote.modelReasons.join(''),/觀察/);
 assert.ok(g.audit.some(e=>e.source==='MODEL_COMMITMENT_27'));
});
test('new public speech invalidates prior vote intent instead of pretending no new argument',async()=>{
 const g=game();propose(g,1,[1,4]);speak(g,2,'我願意先放行');commitStrategyPlan(g,2,plan());
 speak(g,3,'我有不同意見');assert.equal(planForDecision(g,2).ready,false);
 const vote=await decide(g,2,'VOTE');assert.equal(vote.decisionOrigin,undefined);
});
test('a different seat cannot read another NPC private strategy plan',()=>{
 const g=game();propose(g,1,[1,4]);speak(g,2,'同意');commitStrategyPlan(g,2,{...plan(),reasons:['PRIVATE_SEAT_TWO_REASON']});
 assert.ok(!JSON.stringify(sanitizedRequest(g,5,'SPEAK')).includes('PRIVATE_SEAT_TWO_REASON'));
 assert.ok(JSON.stringify(strategyView(g,2)).includes('PRIVATE_SEAT_TWO_REASON'));
 assert.ok(!JSON.stringify(strategyView(g,5)).includes('PRIVATE_SEAT_TWO_REASON'));
});
test('optional shared provider changes brain but never the per-seat identity',()=>{
 const keys=['AVALON_SHARED_PROVIDER','AVALON_SHARED_MODEL','AVALON_NPC_2_PROVIDER','AVALON_NPC_2_MODEL'];
 const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{
  delete process.env.AVALON_NPC_2_PROVIDER;delete process.env.AVALON_NPC_2_MODEL;
  process.env.AVALON_SHARED_PROVIDER='groq';process.env.AVALON_SHARED_MODEL='openai/gpt-oss-120b';
  assert.deepEqual(selectedRoute(2),{provider:'groq',model:'openai/gpt-oss-120b'});
  assert.equal(routingMode(),'shared-brain-2.7');
  const g=game();assert.equal(knowledge(g,2).role,'LOYAL');
  assert.equal(sanitizedRequest(g,2,'SPEAK').view.self.seat,2);
  assert.equal(sanitizedRequest(g,5,'SPEAK').view.self.seat,5);
  process.env.AVALON_NPC_2_MODEL='openai/gpt-oss-20b';assert.equal(selectedRoute(2).model,'openai/gpt-oss-20b');
 }finally{for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
});
test('speech asks for optional private strategy in the same request, not a second call',()=>{
 const g=game();propose(g,1,[1,4]);const r=sanitizedRequest(g,2,'SPEAK');
 assert.equal(r.view.requestedAction,'SPEAK');assert.match(r.instructions,/strategyPlan/);
 assert.ok(!JSON.stringify(r.view).includes('"roles"'));
});
test('Merlin cannot commit support for known evil with two missions lost',()=>{
 const g=createGame({roles:['ASSASSIN','LOYAL','MORGANA','MERLIN','PERCIVAL','MORDRED','LOYAL']});
 g.round=3;g.missions=[{round:1,team:[1,2],success:false,fails:1},{round:2,team:[1,3,7],success:false,fails:1}];
 g.phase='VOTING';g.team=[1,2,3];
 assert.throws(()=>commitStrategyPlan(g,4,plan()),/known-evil crisis/);
});
