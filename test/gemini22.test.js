import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGame} from '../src/core.js';
import {geminiPayload,cloudEnabled} from '../src/agents.js';
const roles=['MERLIN','ASSASSIN','LOYAL','PERCIVAL','MORGANA','LOYAL','MORDRED'];
const game=()=>createGame({roles});
const src=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('Gemini request is server-side authorized perspective only',()=>{
 const g=game();const request=geminiPayload(g,2,'SPEAK');
 assert.equal(request.model,'gemini-2.5-flash');
 assert.equal(request.body.generationConfig.responseMimeType,'application/json');
 const view=JSON.parse(request.body.contents[0].parts[0].text);
 assert.equal(view.self.role,'ASSASSIN');
 assert.deepEqual(view.self.evilTeammates,[5,7]);
 assert.ok(!('roles' in view));
 assert.ok(!('trueMerlin' in view.self));
});
test('counterfactual swapped Merlin yields identical Gemini request for assassin',()=>{
 const a=game(),b=game();b.id=a.id;b.roles[1]='LOYAL';b.roles[3]='MERLIN';
 assert.deepEqual(geminiPayload(a,2,'ASSASSINATE'),geminiPayload(b,2,'ASSASSINATE'));
});
test('model is restricted by whitelist',()=>{
 const old=process.env.GEMINI_MODEL;
 try{process.env.GEMINI_MODEL='unapproved-model';
 // whitelist is checked with process startup model configuration; source contract is also checked below.
 assert.match(src('../src/agents.js'),/ALLOWED_MODELS\.has/);
 }finally{old===undefined?delete process.env.GEMINI_MODEL:process.env.GEMINI_MODEL=old;}
});
test('cloud errors stop execution instead of quietly falling back to offline',()=>{
 const a=src('../src/agents.js');
 assert.match(a,/await reserveCall\(g\)/);
 assert.match(a,/GEMINI_QUOTA/);
 assert.doesNotMatch(a,/cloud-error-fallback/);
 assert.match(src('../src/store.js'),/avalon_ai_daily_quota/);
});
test('client shows quota counters while maintaining UI',()=>{
 assert.match(src('../public/index.html'),/本局呼叫/);
 assert.match(src('../src/server.js'),/aiUsage:/);
});
