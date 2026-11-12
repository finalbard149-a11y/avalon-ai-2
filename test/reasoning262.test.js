import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,speak} from '../src/core.js';
import {accountabilityContext,validateSpeech} from '../src/reasoning262.js';
import {sanitizedRequest} from '../src/agents.js';
const roles=['LOYAL','LOYAL','ASSASSIN','MORGANA','PERCIVAL','MORDRED','MERLIN'];
const make=()=>createGame({roles});
test('same-stage repeated challenge points to the original confirmed-evil claim',()=>{
 const g=make();speak(g,2,'3號和6號已被確認為邪惡。');speak(g,3,'為何我是已確認邪惡？');
 speak(g,2,'目前沒有足夠的證據證明你是邪惡的。');speak(g,3,'你前後言語不一致，為什麼？');
 const c=accountabilityContext(g,2);
 assert.match(c.disputed.text,/3號和6號已被確認/);
 assert.equal(c.challenged,true);
});
test('reply that omits its prior claim gets a public acknowledgement without extra model request',()=>{
 const g=make();speak(g,2,'3號和6號已被確認為邪惡。');speak(g,3,'你之前說我是已確認邪惡？');
 const q=validateSpeech(g,2,'我沒有任何證據證明你是邪惡的。');
 assert.match(q.text,/我先前確實說過/);
 assert.match(q.text,/3號和6號已被確認/);
 assert.equal(q.issues[0].code,'MISSING_SELF_ACKNOWLEDGEMENT');
});
test('acknowledged self-correction is not overwritten',()=>{
 const g=make();speak(g,2,'3號和6號已被確認為邪惡。');speak(g,3,'你剛才說的話呢？');
 const q=validateSpeech(g,2,'我剛才確實說過3號是邪惡，但我用詞太武斷了。');
 assert.deepEqual(q.issues,[]);
 assert.match(q.text,/用詞太武斷/);
});
test('non-challenge text is not rewritten and no other player private memory is used',()=>{
 const g=make();g.npcMemory[4]={note:'PRIVATE SECRET',ownMissionCards:[{card:'FAIL'}]};
 speak(g,3,'這輪你支持哪個提案？');
 const c=sanitizedRequest(g,2,'SPEAK');
 assert.ok(!JSON.stringify(c).includes('PRIVATE SECRET'));
 assert.equal(validateSpeech(g,2,'我會先觀察隊伍。').text,'我會先觀察隊伍。');
});

test('unverified confirmed evil is corrected for ordinary good but evil can deliberately bluff',()=>{
 const g=make();
 const good=validateSpeech(g,2,'3號和6號已被確認為邪惡，我建議2、5、7。');
 assert.match(good.text,/尚無公開證據/);
 assert.equal(good.issues[0].code,'UNSUPPORTED_PUBLIC_IDENTITY_CERTAINTY');
 const evil=validateSpeech(g,3,'1號已被確認為邪惡。');
 assert.match(evil.text,/已被確認/);
 assert.equal(evil.issues[0].code,'UNSUPPORTED_PUBLIC_IDENTITY_CERTAINTY');
});
test('lack of evidence is not proof of goodness',()=>{
 const g=make();const v=validateSpeech(g,2,'5、7未被證實是邪惡，所以一定是好人。');
 assert.match(v.text,/不代表他就是好人/);
 assert.equal(v.issues[0].code,'ABSENCE_OF_EVIDENCE_AS_GOOD_PROOF');
});
