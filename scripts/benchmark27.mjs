#!/usr/bin/env node
// Offline replay only. No API calls, secrets, or network requests.
import {readFileSync} from 'node:fs';
import {CASE_IDS,exportedCase,runReplay} from '../src/benchmark27.js';
const command=process.argv[2]||'cases';
if(command==='cases'){
 console.log(JSON.stringify({schema:'avalon-benchmark-2.7-stage1',cases:CASE_IDS.map(exportedCase)},null,2));
}else if(command==='replay'){
 if(!process.argv[3])throw Error('Usage: npm run benchmark -- replay responses.json');
 const data=JSON.parse(readFileSync(process.argv[3],'utf8'));
 console.log(JSON.stringify(runReplay(data),null,2));
}else throw Error('Usage: npm run benchmark -- cases|replay [responses.json]');
