import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGame,knowledge} from '../src/core.js';
import {inspectProposal,safeProposalFallback} from '../src/proposalGuard263.js';
const roles=['ASSASSIN','LOYAL','MORGANA','MERLIN','PERCIVAL','MORDRED','LOYAL'];
function danger(){
 const g=createGame({roles});
 g.round=3;g.attempt=1;g.captain=4;g.phase='DISCUSSION';
 g.missions=[{round:1,team:[1,2],success:false,fails:1},{round:2,team:[1,3,7],success:false,fails:2}];
 return g;
}
test('regression: no team field (Cloudflare SPEAK JSON) is rejected as a proposal',()=>{
 const g=danger();const response={text:'2號之前對1、3、7的質疑很明顯',beliefUpdate:{note:'2號觀察合理'}};
 assert.equal(inspectProposal(g,4,response.team).code,'MISSING_TEAM');
 const f=safeProposalFallback(g,4);
 assert.equal(f.team.length,3);
 assert.equal(f.team.includes(1),false);
 assert.equal(f.team.includes(3),false);
 assert.deepEqual(knowledge(g,4).visibleEvil,[1,3]);
});
test('0-win 2-loss Merlin model proposal knowingly including evil is rejected',()=>{
 const g=danger();
 assert.equal(inspectProposal(g,4,[1,2,3]).code,'KNOWN_EVIL_ON_ELIMINATION_MISSION');
 assert.equal(inspectProposal(g,4,[2,4,5]).ok,true);
});
test('malformed or duplicate selections cannot bypass core rules',()=>{
 const g=danger();
 for(const t of [[4,5],[4,5,5],[4,5,9],['4',5,7],null])assert.equal(inspectProposal(g,4,t).ok,false);
});
test('fallback remains safe even with misleading positive memory stances on known evil',()=>{
 const g=danger();g.npcMemory[4]={stances:{1:2,3:2,2:-2,5:-2,7:-2}};
 const team=safeProposalFallback(g,4).team;
 assert.equal(team.length,3);
 assert.equal(new Set(team).size,3);
 assert.equal(team.includes(1)||team.includes(3),false);
});
test('do not leak global evil list to loyal NPC or turn strategic evil into forced good policy',()=>{
 const g=danger();g.captain=2;
 assert.equal(inspectProposal(g,2,[1,2,3]).ok,true); // loyal cannot know 1 and 3
 g.captain=1;
 assert.equal(inspectProposal(g,1,[1,2,3]).ok,true); // evil can deliberately propose evil
});
test('server no longer uses hardcoded 1,2,3 emergency proposal',()=>{
 const code=readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
 assert.doesNotMatch(code,/propose\(g,seat,\[1,2,3,4,5,6,7\]\.slice/);
 assert.match(code,/PROPOSAL_GUARD_REJECTED/);
 assert.match(code,/SAFE_FALLBACK_PROPOSE/);
});
