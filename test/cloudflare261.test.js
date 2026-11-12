import test from 'node:test';
import assert from 'node:assert/strict';
import {requestSpec, extractOutput, callProvider} from '../src/providers.js';
const routeOverride={provider:'cloudflare',model:'@cf/zai-org/glm-4.7-flash'};
test('Cloudflare GLM disables thinking and requests JSON output',()=>{
 const before={token:process.env.CLOUDFLARE_API_TOKEN,account:process.env.CLOUDFLARE_ACCOUNT_ID};
 try{
  process.env.CLOUDFLARE_API_TOKEN='test-key';process.env.CLOUDFLARE_ACCOUNT_ID='test-account';
  const spec=requestSpec({seat:4,action:'SPEAK',instructions:'test',view:{round:1},routeOverride});
  assert.deepEqual(spec.body.chat_template_kwargs,{enable_thinking:false});
  assert.equal(spec.body.response_format.type,'json_object');
  assert.equal(spec.body.max_completion_tokens,1500);
  assert.equal(spec.body.max_tokens,undefined);
 }finally{if(before.token===undefined)delete process.env.CLOUDFLARE_API_TOKEN;else process.env.CLOUDFLARE_API_TOKEN=before.token;if(before.account===undefined)delete process.env.CLOUDFLARE_ACCOUNT_ID;else process.env.CLOUDFLARE_ACCOUNT_ID=before.account;}
});
test('Cloudflare accepts text-array response',()=>{
 assert.deepEqual(extractOutput('cloudflare',{choices:[{message:{content:[{type:'text',text:'{"text":"收到","beliefUpdate":{"note":"測試"}}'}]}}]}),{text:'收到',beliefUpdate:{note:'測試'}});
});
test('Cloudflare empty response identifies provider and finish reason without leaking data',()=>{
 assert.throws(()=>extractOutput('cloudflare',{choices:[{finish_reason:'length',message:{content:null}}]}),/cloudflare.*finish_reason=length/);
});
test('Cloudflare timeout returns recoverable network error',async()=>{
 const spec={provider:'cloudflare',url:'https://example.invalid',headers:{},body:{}};
 await assert.rejects(callProvider(spec,async()=>{throw Object.assign(new Error('time'),{name:'TimeoutError'});}),/AI_NETWORK_ERROR: cloudflare.*逾時/);
});
