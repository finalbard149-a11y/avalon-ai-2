import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,speak,propose} from '../src/core.js';
import {strategyView,commitStrategyPlan,planForDecision,ballotFromCommittedPlan,seatPlanAudit} from '../src/strategy27.js';
import {evaluateModelSamples} from '../src/modelComparison27.js';
const roles=['ASSASSIN','LOYAL','MORGANA','MERLIN','PERCIVAL','MORDRED','LOYAL'];
const game=()=>createGame({roles});
test('seat strategy view hides complete role list and other seats private plan',()=>{
 const g=game();g.npcMemory[1]={secret:'EVIL_PRIVATE'};
 const view=strategyView(g,2);
 assert.equal(view.self.role,'LOYAL');
 assert.ok(!JSON.stringify(view).includes('EVIL_PRIVATE'));
 assert.ok(!('roles' in view));
 assert.ok(!('npcMemory' in view));
});
test('strategy commitments retain original reasoning and are isolated by seat',()=>{
 const g=game();const plan=commitStrategyPlan(g,2,{intent:'OPPOSE',reasons:['自己沒入隊且缺乏資訊']});
 assert.equal(plan.intent,'OPPOSE');assert.equal(g.npcMemory[4],undefined);
 assert.deepEqual(seatPlanAudit(g,2).current.reasons,['自己沒入隊且缺乏資訊']);
 assert.equal(seatPlanAudit(g,4),null);
});
test('plan becomes stale when discussion evidence or proposal phase changes',()=>{
 const g=game();commitStrategyPlan(g,2,{intent:'OPPOSE',reasons:['尚無依據']});
 assert.equal(planForDecision(g,2).ready,true);
 speak(g,3,'我的觀點改變了');
 // A new public statement may change the evidence, so the plan must be revisited.
 assert.equal(planForDecision(g,2).ready,false);
 propose(g,1,[1,3]);
 assert.equal(planForDecision(g,2).ready,false);
});
test('voting uses decision-time commitment without random redo',()=>{
 const g=game();propose(g,1,[1,3]);
 commitStrategyPlan(g,2,{intent:'OPPOSE',reasons:['未入隊，無可靠證據']});
 assert.deepEqual(ballotFromCommittedPlan(g,2),{
  decided:true,approve:false,rationale:['未入隊，無可靠證據'],source:'MODEL_PLAN',eventKey:planForDecision(g,2).plan.eventKey
 });
});
test('Merlin cannot endorse known evil in an elimination mission',()=>{
 const g=game();g.round=3;g.missions=[{round:1,success:false,team:[1,2]},{round:2,success:false,team:[1,3,7]}];g.phase='VOTING';g.team=[1,2,3];
 assert.throws(()=>commitStrategyPlan(g,4,{intent:'SUPPORT',reasons:['想冒險']}),/known-evil crisis/);
});
test('offline comparison scores correctness and does not fabricate token usage',()=>{
 const r=evaluateModelSamples([
  {model:'model-x',caseId:'merlin-elimination-proposal',latencyMs:100,response:{team:[2,4,5],reason:'避險'}},
  {model:'model-y',caseId:'merlin-elimination-proposal',latencyMs:350,response:{text:'我想選2號'}}
 ]);
 assert.equal(r.externalCalls,0);assert.equal(r.results[0].passRate,100);
 assert.equal(r.results[1].passRate,0);assert.equal(r.results[0].meanInputTokens,null);
});
test('comparison rejects duplicate observations',()=>{
 const s={model:'x',caseId:'own-words-accountability',latencyMs:1,response:{text:'我剛才說過'}};
 assert.throws(()=>evaluateModelSamples([s,s]),/duplicate sample/);
});
