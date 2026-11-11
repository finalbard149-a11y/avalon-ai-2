import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const server=readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
const ui=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
test('resume and reset are behind authentication',()=>{
 const auth=server.indexOf('if(!authorized(req))');
 const resume=server.indexOf("u.pathname==='/api/resume'");
 const reset=server.indexOf("u.pathname==='/api/reset'");
 assert.ok(auth>0 && auth<resume && auth<reset);
 assert.match(server,/if\(p\.confirm!==['"]RESET['"]\)/);
});
test('resume uses saved revision and runs NPC advancement',()=>{
 assert.match(server,/mutateGame\(p\.revision,async game=>\{await advance\(game\);\}\)/);
 assert.match(server,/!\((?:seat|s) in g\.cards\)/);
 assert.match(server,/!\((?:seat|s) in g\.votes\)/);
});
test('reset UI requires a confirmation and clears success error',()=>{
 assert.match(ui,/window\.confirm\(/);
 assert.match(ui,/api\/reset/);
 assert.match(ui,/api\/resume/);
 assert.match(ui,/clearError\(\)/);
});
