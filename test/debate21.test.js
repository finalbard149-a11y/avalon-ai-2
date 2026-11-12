import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGame,speak,propose,vote,mission} from '../src/core.js';
import {sanitizedRequest,offline} from '../src/agents.js';
const read=(p)=>readFileSync(new URL(p,import.meta.url),'utf8');
const server=read('../src/server.js'),ui=read('../public/index.html');
const g=()=>createGame({roles:['MERLIN','ASSASSIN','LOYAL','PERCIVAL','MORGANA','LOYAL','MORDRED']});
test('human may discuss while another NPC is captain',()=>{
 const x=g();speak(x,3,'2 號，這次你想提名誰？');assert.equal(x.publicMessages.at(-1).seat,3);
});
test('human may speak before and during secret voting without changing votes',()=>{
 const x=g();propose(x,1,[1,4]);vote(x,3,false);speak(x,3,'4 號，你認為這個組合安全嗎？');assert.equal(x.votes[3],false);assert.equal(x.events.some(e=>e.type==='VOTE_REVEAL'),false);
});
test('human may discuss during mission, but not after ending',()=>{
 const x=g();propose(x,1,[1,4]);for(let i=1;i<=7;i++)vote(x,i,true);
 speak(x,3,'我認為我們應該先檢查原因。');assert.equal(x.phase,'MISSION');
 x.phase='ENDED';assert.throws(()=>speak(x,3,'測試'),/discussion closed/);
});
test('offline NPC speaks with a per-seat position, no fabricated role revelation',()=>{
 const x=g();speak(x,3,'2號，為什麼你不沿用上一隊？');
 const a=offline(x,2,'SPEAK'),b=offline(x,4,'SPEAK');assert.notEqual(a.text,b.text);assert.ok(!a.text.includes('刺客'));
});
test('phase controls are behind authorized endpoints, no auto NPC proposal',()=>{
 assert.ok(server.indexOf('if(!authorized(req))')<server.indexOf("u.pathname==='/api/continue'"));
 assert.match(server,/game\.review=null;await advance\(game\)/);
 assert.match(server,/await aiAction\(game,game\.captain,'PROPOSE'\)/);
 const advanceSection=server.slice(server.indexOf('async function advance(g)'),server.indexOf('async function bodyJSON'));
 assert.doesNotMatch(advanceSection,/aiAction\(g,g\.captain,'PROPOSE'\)/);
 assert.match(server,/setReview\(g,'VOTE'\)/);
 assert.match(server,/setReview\(g,'MISSION'\)/);
});
test('debate UI persists through voting and exposes explicit continue buttons',()=>{
 assert.match(ui,/g\.phase!=='ENDED' && g\.phase!=='ASSASSINATION'/);
 assert.match(ui,/api\/continue/);
 assert.match(ui,/id="askProposal"/);
 assert.match(ui,/id="continue"/);
});
test('assassin model request independent of hidden Merlin seat',()=>{
 const a=g(),b=g();b.id=a.id;b.roles[1]='LOYAL';b.roles[3]='MERLIN';
 assert.deepEqual(sanitizedRequest(a,2,'SPEAK'),sanitizedRequest(b,2,'SPEAK'));
});

test('human speak action triggers independent NPC replies without auto advancing',()=>{
 assert.match(server,/u.pathname==='\/api\/speak'/);
 assert.match(server,/u.pathname==='\/api\/respond'/);
 assert.match(server,/game.replyQueue.shift\(\)/);
 assert.match(server,/g\.review&&p\.type!=='SPEAK'/);
});
