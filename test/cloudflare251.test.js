import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRoute,requestSpec,extractOutput,callProvider} from '../src/providers.js';
const model='@cf/zai-org/glm-4.7-flash';
test('Cloudflare only allows verified free-tier models',()=>{
 assert.equal(validateRoute({provider:'cloudflare',model},4).model,model);
 assert.throws(()=>validateRoute({provider:'cloudflare',model:'@cf/zai-org/glm-5.2'},4),/Workers Free/);
});
test('Cloudflare requires both account id and API token',()=>{
 const oldA=process.env.CLOUDFLARE_ACCOUNT_ID,oldT=process.env.CLOUDFLARE_API_TOKEN;
 try{delete process.env.CLOUDFLARE_ACCOUNT_ID;process.env.CLOUDFLARE_API_TOKEN='dummy';assert.equal(validateRoute({provider:'cloudflare',model},4).configured,false);
 process.env.CLOUDFLARE_ACCOUNT_ID='test-account';assert.equal(validateRoute({provider:'cloudflare',model},4).configured,true);
 const spec=requestSpec({seat:4,action:'SPEAK',instructions:'hello',view:{round:1},routeOverride:{provider:'cloudflare',model}});
 assert.match(spec.url,/accounts\/test-account\/ai\/v1\/chat\/completions$/);
 assert.equal(spec.headers.Authorization,'Bearer dummy');assert.equal(spec.body.model,model);
 }finally{if(oldA===undefined)delete process.env.CLOUDFLARE_ACCOUNT_ID;else process.env.CLOUDFLARE_ACCOUNT_ID=oldA;if(oldT===undefined)delete process.env.CLOUDFLARE_API_TOKEN;else process.env.CLOUDFLARE_API_TOKEN=oldT;}
});
test('Cloudflare chat output uses OpenAI-compatible schema',()=>{assert.deepEqual(extractOutput('cloudflare',{choices:[{message:{content:'{"text":"你好","beliefUpdate":{"note":"測試"}}'}}]}),{text:'你好',beliefUpdate:{note:'測試'}})});
test('Cloudflare rate-limit reports provider, without exposing credentials',async()=>{
 const spec={provider:'cloudflare',url:'https://invalid.example',headers:{Authorization:'Bearer secret'},body:{}};
 await assert.rejects(callProvider(spec,async()=>({ok:false,status:429})),/AI_QUOTA: cloudflare/);
});
