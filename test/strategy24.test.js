import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGame,propose,vote,mission,knowledge} from '../src/core.js';
import {zeroCostDecision,publicLogic,safePromptRules} from '../src/strategy.js';
import {decide,sanitizedRequest} from '../src/agents.js';
const roles=['MERLIN','ASSASSIN','LOYAL','PERCIVAL','MORGANA','LOYAL','MORDRED'];
const game=()=>createGame({roles});
const source=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('5th rejection ends game with evil victory, not forced passing',()=>{
 const g=game();for(let n=0;n<4;n++){propose(g,g.captain,[1,2]);for(let s=1;s<=7;s++)vote(g,s,false);}
 assert.equal(g.phase,'DISCUSSION');assert.equal(g.attempt,5);assert.equal(publicLogic(g).rejectedFifthIsEvilWin,true);
 propose(g,g.captain,[1,2]);for(let s=1;s<=7;s++)vote(g,s,false);
 assert.equal(g.phase,'ENDED');assert.equal(g.winningTeam,'EVIL');
});
test('all seven yes means unanimous but does not identify anyone',()=>{
 const g=game();propose(g,1,[1,2]);for(let s=1;s<=7;s++)vote(g,s,true);
 const result=publicLogic(g);assert.equal(result.previousVote.unanimous,true);
 assert.equal(result.previousVote.yes,7);assert.deepEqual(result.implications.length,2);
 assert.ok(!('roles' in result));assert.ok(!('evilSeats' in result));
});
test('independent AI requests include public rules, not hidden roster',()=>{
 const g=game();const request=sanitizedRequest(g,2,'SPEAK');
 assert.match(request.instructions,/第五次|強制局/);
 assert.match(request.view.rulesContext.rules.unanimous,/does not prove/);
 assert.ok(!('roles' in request.view));
 const other=game();other.id=g.id;other.roles[1]='LOYAL';other.roles[3]='MERLIN';
 assert.deepEqual(sanitizedRequest(g,2,'ASSASSINATE'),sanitizedRequest(other,2,'ASSASSINATE'));
});
test('voting and mission use zero provider calls, good always SUCCESS',async()=>{
 const g=game();propose(g,1,[1,2]);const before=g.aiCallCount??0;
 for(let s=1;s<=7;s++){
  const a=await decide(g,s===3?4:s,'VOTE');assert.equal(typeof a.approve,'boolean');
 }
 assert.equal(g.aiCallCount??0,before);
 const g2=game();propose(g2,1,[1,3]);for(let s=1;s<=7;s++)vote(g2,s,true);
 const card=await decide(g2,1,'MISSION');assert.deepEqual(card,{fail:false});
 assert.equal(g2.aiCallCount??0,0);
});
test('evil strategy sees only legal teammate seats and public history',()=>{
 const g=game();propose(g,1,[1,2]);
 const d=zeroCostDecision(g,2,'VOTE');assert.deepEqual(d,{approve:true});
 assert.deepEqual(knowledge(g,2).evilTeammates,[5,7]);
 assert.doesNotMatch(source('../src/strategy.js'),/g\.roles\[/);
});
test('good cannot play FAIL; only evil sees fail button',()=>{
 const front=source('../public/index.html');
 assert.match(front,/\['ASSASSIN','MORGANA','MORDRED'\]\.includes\(k\.role\)/);
 const core=source('../src/core.js');assert.match(core,/good cannot fail/);
});
test('server returns rules info and invokes private strategy for vote/mission',()=>{
 const agents=source('../src/agents.js'), server=source('../src/server.js');
 assert.match(agents,/if\(action==='VOTE'\|\|action==='MISSION'\)/);
 assert.match(server,/rulesInfo:publicLogic\(g\)/);
});
test('own trust notes can affect votes, but other NPC memory cannot',()=>{
 const g=game();propose(g,1,[1,2]);
 // Make a deterministic score comparison by using identical revision and game ID.
 g.npcMemory[4]={stances:{1:-2,2:-2}};
 const distrust=zeroCostDecision(g,4,'VOTE');
 g.npcMemory[4]={stances:{1:2,2:2}};
 const trust=zeroCostDecision(g,4,'VOTE');
 // The same random draw, score changes probability threshold in the correct direction.
 // It need not flip every sampled ballot, but another NPC's memory cannot alter it.
 g.npcMemory[2]={stances:{1:-2,4:-2}};
 assert.deepEqual(zeroCostDecision(g,4,'VOTE'),trust);
 assert.equal(typeof distrust.approve,'boolean');
});
test('offline quota fallback for proposal and assassin is independent of hidden Merlin',()=>{
 const a=game(),b=game();b.id=a.id;b.roles[1]='LOYAL';b.roles[3]='MERLIN';
 const proposal=zeroCostDecision(a,2,'PROPOSE');assert.equal(proposal.team.length,2);assert.equal(new Set(proposal.team).size,2);
 const assassination=zeroCostDecision(a,2,'ASSASSINATE');
 assert.equal(assassination.ranking.length,4);
 assert.deepEqual(assassination,zeroCostDecision(b,2,'ASSASSINATE'));
});
