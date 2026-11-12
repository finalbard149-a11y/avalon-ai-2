#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {evaluateModelSamples} from '../src/modelComparison27.js';
if(process.argv.length!==3)throw Error('Usage: node scripts/compare27.mjs samples.json');
const samples=JSON.parse(readFileSync(process.argv[2],'utf8'));
console.log(JSON.stringify(evaluateModelSamples(samples),null,2));
