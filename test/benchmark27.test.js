import test from 'node:test';
import assert from 'node:assert/strict';
import {benchmarkCase,CASE_IDS,evaluateResponse,runReplay,exportedCase} from '../src/benchmark27.js';
import {inspectProposal,safeProposalFallback} from '../src/proposalGuard263.js';

test('benchmark has repeatable offline cases with separate seat-only contexts',()=>{
 assert.equal(CASE_IDS.length,3);
 for(const id of CASE_IDS){
  const c=benchmarkCase(id);
  assert.equal(c.view.self.seat,c.seat);
  assert.equal(c.view.self.role,c.game.roles[c.seat]);
  assert.ok(!('roles' in c.view));
  assert.ok(!('roles' in c.view.public));
  assert.ok(!('evilTeammates' in c.view.public));
 }
});
test('recorded Cloudflare speech-shaped proposal fails, safe fallback does not recruit known evil',()=>{
 const c=benchmarkCase('merlin-elimination-proposal');
 const wrong={text:'2號值得信任',beliefUpdate:{note:'我先觀察'}};
 assert.deepEqual(evaluateResponse(c.id,wrong).issues,['MISSING_TEAM','MISSING_DECISION_REASON']);
 const fallback=safeProposalFallback(c.game,4);
 assert.equal(inspectProposal(c.game,4,fallback.team).ok,true);
 assert.equal(fallback.team.some(s=>[1,3].includes(s)),false);
});
test('known-evil proposal is judged unsafe; correct proposal passes',()=>{
 assert.equal(evaluateResponse('merlin-elimination-proposal',{team:[1,2,3],reason:'冒險'}).passed,false);
 assert.equal(evaluateResponse('merlin-elimination-proposal',{team:[2,4,5],reason:'優先避免已知風險'}).passed,true);
});
test('claim accountability requires explicit acknowledgement not denials',()=>{
 const id='own-words-accountability';
 assert.ok(evaluateResponse(id,{text:'目前沒有足夠證據。'}).issues.includes('DOES_NOT_ACKNOWLEDGE_OWN_WORDS'));
 assert.ok(evaluateResponse(id,{text:'我從未說過。'}).issues.includes('DENIES_RECORDED_CLAIM'));
 assert.equal(evaluateResponse(id,{text:'我剛才確實說3號已確認邪惡，但那是過度推斷，我收回。'}).passed,true);
});
test('vote explanation must refer to stored decision-time intent',()=>{
 const id='own-vote-explanation';
 assert.equal(evaluateResponse(id,{text:'我相信1號和3號都是好人。'}).passed,false);
 assert.equal(evaluateResponse(id,{text:'我當時投同意是想觀察任務結果，不是證實誰是好人。'}).passed,true);
 const p=exportedCase(id);
 assert.equal(p.view.personalHistory.autobiography.ownVoteReasons[0].approve,true);
 assert.equal(p.view.personalHistory.autobiography.ownVoteReasons[0].source,'RULE_ENGINE_AT_DECISION_TIME');
});
test('replay counts each case and never invokes a model',()=>{
 const r=runReplay({
  'merlin-elimination-proposal':{team:[2,4,5],reason:'避開已知風險'},
  'own-words-accountability':{text:'我剛才確實說過3號是邪惡，但我證據不足。'},
  'own-vote-explanation':{text:'我投同意是為了觀察任務結果。'}
 });
 assert.equal(r.passed,3);assert.equal(r.total,3);
});
