import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,knowledge,perspective,propose,vote,mission,assassinate} from '../src/core.js';
import {sanitizedRequest,offline} from '../src/agents.js';
const roles=['MERLIN','ASSASSIN','LOYAL','PERCIVAL','MORGANA','LOYAL','MORDRED'];
const game=()=>createGame({roles});
test('Merlin cannot see Mordred',()=>assert.deepEqual(knowledge(game(),1).visibleEvil,[2,5]));
test('Percival sees two indistinguishable candidates',()=>assert.deepEqual(knowledge(game(),4).merlinCandidates,[1,5]));
test('Assassin does not know Merlin',()=>{const k=knowledge(game(),2);assert.deepEqual(k.evilTeammates,[5,7]);assert.equal('trueMerlin' in k,false);});
test('Counterfactual hidden Merlin swap yields identical assassin prompt',()=>{
 const a=game(),b=game();b.id=a.id;b.roles[1]='LOYAL';b.roles[3]='MERLIN';
 assert.deepEqual(sanitizedRequest(a,2,'ASSASSINATE'),sanitizedRequest(b,2,'ASSASSINATE'));
});
test('Rejected proposal rotates captain',()=>{
 const g=game();propose(g,1,[1,4]);for(let i=1;i<=7;i++)vote(g,i,false);
 assert.equal(g.captain,2);assert.equal(g.attempt,2);
});
test('Vote is not revealed before all seven votes',()=>{
 const g=game();propose(g,1,[1,4]);vote(g,1,true);assert.equal(g.events.some(e=>e.type==='VOTE_REVEAL'),false);
});
test('Good cannot submit fail',()=>{
 const g=game();propose(g,1,[1,4]);for(let i=1;i<=7;i++)vote(g,i,true);
 assert.throws(()=>mission(g,1,true),/good cannot fail/);
});
test('Assassin cannot assassinate teammate',()=>{
 const g=game();g.phase='ASSASSINATION';assert.throws(()=>assassinate(g,2,5),/invalid target/);
});
test('Offline assassin evaluates all non-evil candidates',()=>{
 const g=game();const d=offline(g,2,'ASSASSINATE');assert.deepEqual(d.ranking.map(x=>x.seat),[1,3,4,6]);
});
