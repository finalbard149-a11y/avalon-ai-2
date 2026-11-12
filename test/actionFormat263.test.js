import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../src/core.js';
import {sanitizedRequest} from '../src/agents.js';
import {actionOutputContract,actionInstructions} from '../src/actionPrompt263.js';
import {requestSpec} from '../src/providers.js';
const roles=['ASSASSIN','LOYAL','MORGANA','MERLIN','PERCIVAL','MORDRED','LOYAL'];
function crisis(){const g=createGame({roles});g.round=3;g.captain=4;g.missions=[{round:1,team:[1,2],success:false,fails:1},{round:2,team:[1,3,7],success:false,fails:2}];return g;}
test('Cloudflare Merlin proposal contains only PROPOSE output contract',()=>{
 const req=sanitizedRequest(crisis(),4,'PROPOSE');
 assert.match(req.instructions,/CURRENT_ACTION=PROPOSE/);
 assert.match(req.instructions,/"team":\[1,2,3\]/);
 assert.match(req.instructions,/"reason"/);
 assert.doesNotMatch(req.instructions,/SPEAK format|ASSASSINATE:|"beliefUpdate"\s*:/);
 assert.deepEqual(req.view.outputContract.teamSize,3);
 assert.deepEqual(req.view.self.visibleEvil,[1,3]);
 assert.equal(req.view.requestedAction,'PROPOSE');
});
test('SPEAK prompt has its own format and no proposal example',()=>{
 const req=sanitizedRequest(crisis(),2,'SPEAK');
 assert.match(req.instructions,/CURRENT_ACTION=SPEAK/);
 assert.match(req.instructions,/"beliefUpdate"/);
 assert.doesNotMatch(req.instructions,/"team":\[/);
 assert.equal(req.view.outputContract.teamSize,null);
});
test('different team size produces correct array length in proposal only',()=>{
 for(let round=1;round<=5;round++){
  const c=actionOutputContract('PROPOSE',round);
  assert.equal(JSON.parse(c.expectedJSON).team.length,[2,3,3,4,4][round-1]);
 }
 assert.throws(()=>actionInstructions({action:'UNKNOWN',round:1,seat:1,personality:'test'}));
});
test('Cloudflare HTTP body carries same action-only prompt and JSON object setting',()=>{
 const oldToken=process.env.CLOUDFLARE_API_TOKEN,oldAccount=process.env.CLOUDFLARE_ACCOUNT_ID;
 try{
  process.env.CLOUDFLARE_API_TOKEN='test-only';process.env.CLOUDFLARE_ACCOUNT_ID='test-only';
  const req=sanitizedRequest(crisis(),4,'PROPOSE');
  const spec=requestSpec({seat:4,action:'PROPOSE',...req,routeOverride:{provider:'cloudflare',model:'@cf/zai-org/glm-4.7-flash'}});
  assert.equal(spec.body.response_format.type,'json_object');
  assert.match(spec.body.messages[0].content,/CURRENT_ACTION=PROPOSE/);
  assert.doesNotMatch(spec.body.messages[0].content,/SPEAK format/);
  assert.match(spec.body.messages[1].content,/"requestedAction":"PROPOSE"/);
  assert.equal(spec.body.chat_template_kwargs.enable_thinking,false);
 }finally{
  if(oldToken===undefined)delete process.env.CLOUDFLARE_API_TOKEN;else process.env.CLOUDFLARE_API_TOKEN=oldToken;
  if(oldAccount===undefined)delete process.env.CLOUDFLARE_ACCOUNT_ID;else process.env.CLOUDFLARE_ACCOUNT_ID=oldAccount;
 }
});
