import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,speak,propose,vote,mission} from '../src/core.js';
import {biography,rememberPrivateMission,rememberProposalReason,memoryPrompt} from '../src/memory26.js';
import {setProviderCooldown,reserveScopedCall,getProviderCooldowns} from '../src/store.js';
const roles=['LOYAL','ASSASSIN','MERLIN','MORGANA','PERCIVAL','MORDRED','LOYAL'];
function game(){return createGame({roles});}
test('seat autobiography retains its own proposals, statements and revealed ballot without inventing reasons',()=>{
 const g=game();speak(g,1,'我先選一號與二號');propose(g,1,[1,2]);
 for(let s=1;s<=7;s++)vote(g,s,s!==3);
 const a=biography(g,1);assert.equal(a.history.find(x=>x.kind==='OWN_PROPOSAL').team.join(','),'1,2');
 assert.match(a.history.find(x=>x.kind==='OWN_PROPOSAL').meaning,/不得捏造/);
 assert.equal(a.history.find(x=>x.kind==='OWN_VOTE').approve,true);
 assert.ok(!biography(g,2).history.some(x=>x.kind==='OWN_PROPOSAL'));
});
test('private mission card is visible to its player alone, not other NPC perspective',()=>{
 const g=game();propose(g,1,[1,2]);for(let s=1;s<=7;s++)vote(g,s,true);
 rememberPrivateMission(g,2,true);mission(g,2,true);
 assert.equal(memoryPrompt(g,2).autobiography.ownMissionCards[0].card,'FAIL');
 assert.equal(memoryPrompt(g,1).autobiography.ownMissionCards.length,0);
 assert.equal(JSON.stringify(memoryPrompt(g,1)).includes('"FAIL"'),false);
});
test('provider cooldown prevents new reservations without burning game quota',async()=>{
 const g=game();const l={gameLimit:90,dailyLimit:150,seatLimit:16,providerLimit:40};
 const provider='test-cooldown-26';
 await setProviderCooldown(provider,15);
 const r=await reserveScopedCall(g.id,2,provider,l);
 assert.equal(r.ok,false);assert.match(r.reason,/冷卻/);
 const st=await getProviderCooldowns();assert.ok(st[provider]);
});

test('decision-time reason is remembered but missing reason is not fabricated',()=>{
 const g=game();rememberProposalReason(g,1,[1,2],'當時想先測試二號','AI_DECISION');
 const m=biography(g,1);assert.equal(m.ownProposalReasons[0].reason,'當時想先測試二號');
 assert.equal(biography(g,2).ownProposalReasons.length,0);
 rememberProposalReason(g,1,[1,3],undefined,'UNRECORDED');
 assert.equal(biography(g,1).ownProposalReasons[1].reason,null);
});
