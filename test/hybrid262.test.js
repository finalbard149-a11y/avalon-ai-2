import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,propose,vote,mission,speak} from '../src/core.js';
import {deductionForSeat} from '../src/deduction263.js';
import {publicLogic,zeroCostDecision,voteDecisionReason} from '../src/strategy.js';
import {rememberVoteReason,memoryPrompt} from '../src/memory26.js';
import {sanitizedRequest} from '../src/agents.js';
const roles=['LOYAL','LOYAL','ASSASSIN','MORGANA','PERCIVAL','MORDRED','MERLIN'];
const game=()=>createGame({roles});
test('7-player vote math is rigorous and does not infer evil on team',()=>{
 const g=game();propose(g,1,[1,2]);[true,true,true,true,true,true,false].forEach((v,i)=>vote(g,i+1,v));
 assert.equal(publicLogic(g).previousVote.minimumEvilYes,2);
 assert.equal(publicLogic(g).implications.some(x=>x.includes('mission team')),true);
});
test('possible-world deduction for a loyalist eliminates their own seat and honors failure lower bound',()=>{
 const g=game();assert.equal(deductionForSeat(g,2).possibleWorldCount,20);
 propose(g,1,[1,3]);for(let i=1;i<=7;i++)vote(g,i,true);
 mission(g,1,false);mission(g,3,true);
 const d=deductionForSeat(g,2);
 assert.equal(d.excludedEvilSeats.includes(2),true);
 assert.deepEqual(d.necessaryEvilSeats,[]);
 assert.ok(d.possibleWorldCount<20);
 assert.equal(d.possibleEvilSeats.includes(1),true);
 assert.equal(d.possibleEvilSeats.includes(3),true);
});
test('successful mission never mechanically certifies its members GOOD',()=>{
 const g=game();propose(g,1,[1,3]);for(let i=1;i<=7;i++)vote(g,i,true);
 mission(g,1,false);mission(g,3,false);
 const d=deductionForSeat(g,2);
 assert.equal(d.possibleEvilSeats.includes(3),true);
});
test('knowledge views stay role-limited, ignoring unrelated secret role swaps and private notes',()=>{
 const a=game(),b=game();b.id=a.id;
 // Seat 2 is LOYAL in both cases; swap unseen evil labels among 3 and 4.
 b.roles[3]='MORGANA';b.roles[4]='ASSASSIN';
 b.npcMemory[4]={note:'SECRET ONLY 4'};
 assert.deepEqual(deductionForSeat(a,2),deductionForSeat(b,2));
 assert.equal(JSON.stringify(sanitizedRequest(b,2,'SPEAK')).includes('SECRET ONLY 4'),false);
});
test('uninformed outsider good defaults to NO more often but may vote YES with recorded reason',()=>{
 let yes=0,no=0;
 for(let i=0;i<100;i++){
  const g=game();g.id=`simulation-${i}`;propose(g,1,[1,3]);
  const v=zeroCostDecision(g,2,'VOTE').approve;
  if(v)yes++;else no++;
  const r=voteDecisionReason(g,2,v);
  assert.match(r.code,/UNINFORMED_OUTSIDER/);
  assert.equal(r.approve,v);
  assert.ok(r.reason.length>10);
 }
 assert.ok(no>yes,`expected more NO than YES; ${no}/${yes}`);
 assert.ok(yes>0,'YES should be a genuine, explainable possibility');
});
test('own ballot rationale is persisted only for that NPC, and is not fabricated later',()=>{
 const g=game();propose(g,1,[1,3]);
 const v=zeroCostDecision(g,2,'VOTE'); const reason=voteDecisionReason(g,2,v.approve);
 rememberVoteReason(g,2,reason);
 assert.equal(memoryPrompt(g,2).autobiography.ownVoteReasons[0].approve,v.approve);
 assert.equal(memoryPrompt(g,1).autobiography.ownVoteReasons.length,0);
 assert.ok(!JSON.stringify(sanitizedRequest(g,1,'SPEAK')).includes('UNINFORMED_OUTSIDER'));
});
test('fifth proposal good NPC chooses YES and rationale says rejection loses',()=>{
 const g=game();g.attempt=5;g.team=[1,3];
 assert.equal(zeroCostDecision(g,2,'VOTE').approve,true);
 assert.match(voteDecisionReason(g,2,true).reason,/邪惡直接獲勝/);
});
