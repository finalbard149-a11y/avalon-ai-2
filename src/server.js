import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createGame,publicState,knowledge,speak,propose,vote,mission,assassinate,EVIL,SIZES} from './core.js';
import {decide,cloudEnabled} from './agents.js';
import {DAILY_LIMIT,GAME_LIMIT} from './quota.js';
import {routingStatus} from './providers.js';
import {publicLogic} from './strategy.js';
import {initializeStore,getGame,getGameUsage,saveNewGame,mutateGame} from './store.js';
import {authorized,checkConfig,checkPassword,sessionCookie,clearCookie} from './auth.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
const HUMAN=3,PORT=Number(process.env.PORT||3000);
function json(res,status,obj,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(obj));}
function humanView(g){const base={...publicState(g),review:g.review||null,self:knowledge(g,HUMAN),aiMode:cloudEnabled()?'cloud':'offline-test',npcRouting:routingStatus(),pendingReplies:(g.replyQueue||[]).length,rulesInfo:publicLogic(g),budgetNotice:g.budgetNotice||null,aiUsage:{game:g.aiCallCount||0,gameLimit:GAME_LIMIT,dailyLimit:DAILY_LIMIT}};if(g.phase==='ENDED')base.roles=g.roles;return base;}
function validCandidate(g,seat,target){const k=knowledge(g,seat);return Number.isInteger(target)&&target!==seat&&target>=1&&target<=7&&!k.evilTeammates.includes(target);}
async function aiAction(g,seat,action){
 g.aiCallCount=await getGameUsage(g.id);
 const d=await decide(g,seat,action);
 try{
  if(action==='SPEAK')speak(g,seat,String(d.text||'我還需要更多資訊。').slice(0,120));
  else if(action==='PROPOSE'){propose(g,seat,d.team);queueSpeakers(g,'PROPOSAL');}
  else if(action==='VOTE')vote(g,seat,d.approve);
  else if(action==='MISSION')mission(g,seat,EVIL.has(g.roles[seat])&&d.fail===true);
  else if(action==='ASSASSINATE'){
   const eligible=[1,2,3,4,5,6,7].filter(s=>validCandidate(g,seat,s));
   const ranking=Array.isArray(d.ranking)?d.ranking:[];
   const covered=new Set(ranking.map(x=>x.seat));
   const complete=eligible.every(s=>covered.has(s));
   const target=complete&&eligible.includes(d.target)?d.target:eligible[Math.floor(Math.random()*eligible.length)];
   g.audit.push({seat,action:'ASSASSINATION_COMMIT',target,completeRanking:complete,ranking,preResult:true,eventSeq:g.revision,time:new Date().toISOString()});
   assassinate(g,seat,target);
  }
 }catch(e){
  g.audit.push({seat,action:'INVALID_ACTION',detail:String(e.message),eventSeq:g.revision});
  if(action==='PROPOSE')propose(g,seat,[1,2,3,4,5,6,7].slice(0,SIZES[g.round-1]));
  else if(action==='VOTE')vote(g,seat,false);
  else if(action==='MISSION')mission(g,seat,false);
  else if(action==='SPEAK')speak(g,seat,'這個提案我還需要再評估。');
  else if(action==='ASSASSINATE'){const eligible=[1,2,3,4,5,6,7].filter(s=>validCandidate(g,seat,s));const target=eligible[Math.floor(Math.random()*eligible.length)];g.audit.push({seat,action:'ASSASSINATION_FALLBACK_COMMIT',target,preResult:true});assassinate(g,seat,target);}
 }
}
// Important: do not progress across public reveal screens without owner confirmation.
function setReview(g,kind){
 const event=[...g.events].reverse().find(e=>kind==='VOTE' ? e.type==='VOTE_REVEAL' : e.type==='MISSION_RESULT');
 if(event)g.review={kind,payload:structuredClone(event.payload),eventSeq:event.seq};
}
function currentDiscussionKey(g){return `${g.round}:${g.attempt}:${g.captain}`;}
function queueSpeakers(g,kind,text=''){
 const choices=[1,2,4,5,6,7];
 const targets=[...String(text).matchAll(/(?:^|[^0-9])([124567])\s*號/g)].map(m=>Number(m[1]));
 const lead=kind==='PROPOSAL' ? choices.find(s=>s!==g.captain) : targets.find(s=>choices.includes(s))??choices[(g.publicMessages.length+g.round)%choices.length];
 const second=choices.find(s=>s!==lead&&s!==g.captain)??choices.find(s=>s!==lead);
 g.replyQueue=(kind==='PROPOSAL'?[lead]:[lead,second]).filter((s,i,a)=>s!==undefined&&a.indexOf(s)===i);
 g.replyContext=kind;
}
async function openDiscussion(g){
 if(g.phase!=='DISCUSSION'||g.captain===HUMAN)return;
 const key=currentDiscussionKey(g);
 if(g.discussionOpened===key)return;
 g.discussionOpened=key;
 // 2.3: invite NPCs to comment only upon explicit player request; no hidden model calls.
 queueSpeakers(g,'DISCUSSION');
}
async function advance(g){
 let count=0;
 while(count++<30){
  if(g.phase==='ENDED'||g.review)break;
  if(g.phase==='DISCUSSION'){
   await openDiscussion(g);
   // Proposal is an explicit owner-controlled step, including when NPC is captain.
   break;
  }
  if(g.phase==='VOTING'){
   if(HUMAN in g.votes){
    for(let seat=1;seat<=7;seat++)if(seat!==HUMAN&&!(seat in g.votes)&&g.phase==='VOTING')await aiAction(g,seat,'VOTE');
    if(g.phase!=='VOTING'){setReview(g,'VOTE');break;}
   }
   break;
  }
  if(g.phase==='MISSION'){
   if(!g.team.includes(HUMAN)||HUMAN in g.cards){
    for(const seat of [...g.team])if(seat!==HUMAN&&!(seat in g.cards)&&g.phase==='MISSION')await aiAction(g,seat,'MISSION');
    if(g.phase!=='MISSION'){setReview(g,'MISSION');break;}
   }
   break;
  }
  if(g.phase==='ASSASSINATION'){
   const assassin=Number(Object.keys(g.roles).find(seat=>g.roles[seat]==='ASSASSIN'));
   if(assassin!==HUMAN){await aiAction(g,assassin,'ASSASSINATE');break;}
  }
  break;
 }
}
async function bodyJSON(req){let body='';for await(const chunk of req){body+=chunk;if(body.length>10000)throw Error('request too large');}return body?JSON.parse(body):{};}
const loginAttempts=new Map();
function loginAllowed(req){const ip=req.socket.remoteAddress||'unknown',now=Date.now(),old=loginAttempts.get(ip)||[];const recent=old.filter(t=>now-t<15*60000);if(recent.length>=8)return false;recent.push(now);loginAttempts.set(ip,recent);return true;}
function verifyOrigin(req){if(req.method!=='POST')return true;const origin=req.headers.origin;if(!origin)return false;const host=req.headers.host;return new URL(origin).host===host&&['https:','http:'].includes(new URL(origin).protocol);}
const server=http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&(u.pathname==='/'||u.pathname==='/index.html')){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'"});return res.end(await readFile(path.join(root,'index.html')));}
  if(req.method==='GET'&&u.pathname==='/health')return json(res,200,{status:'ok'});
  if(!verifyOrigin(req))return json(res,403,{error:'invalid origin'});
  if(req.method==='POST'&&u.pathname==='/api/login'){
   if(!loginAllowed(req))return json(res,429,{error:'too many login attempts'});
   const p=await bodyJSON(req);if(!checkPassword(p.password))return json(res,401,{error:'invalid password'});
   return json(res,200,{ok:true},{'Set-Cookie':sessionCookie()});
  }
  if(!authorized(req))return json(res,401,{error:'login required'});
  if(req.method==='POST'&&u.pathname==='/api/logout')return json(res,200,{ok:true},{'Set-Cookie':clearCookie()});
  if(req.method==='GET'&&u.pathname==='/api/state'){const g=await getGame();if(g)g.aiCallCount=await getGameUsage(g.id);return json(res,200,g?humanView(g):{noGame:true});}
  if(req.method==='GET'&&u.pathname==='/api/audit'){
   const g=await getGame();if(!g||g.phase!=='ENDED')return json(res,403,{error:'audit available after game'});
   return json(res,200,{audit:g.audit||[],npcMemory:g.npcMemory});
  }
   // Explicitly resume a previously saved state. GET /api/state stays read-only.
   if(req.method==='POST'&&u.pathname==='/api/resume'){
    const p=await bodyJSON(req);
    if(!Number.isInteger(p.revision))return json(res,400,{error:'revision required'});
    const g=await mutateGame(p.revision,async game=>{await advance(game);});
    return json(res,200,humanView(g));
   }
   // Explicit administrative reset; preserves the old game record in PostgreSQL.
   if(req.method==='POST'&&u.pathname==='/api/reset'){
    const p=await bodyJSON(req);
    if(p.confirm!=='RESET')return json(res,400,{error:'請確認放棄目前對局'});
    const g=createGame();g.audit=[];queueSpeakers(g,'DISCUSSION');await saveNewGame(g);
    return json(res,200,humanView(g));
   }
  if(req.method==='POST'&&u.pathname==='/api/continue'){
   const p=await bodyJSON(req);
   if(!Number.isInteger(p.revision))return json(res,400,{error:'revision required'});
   const g=await mutateGame(p.revision,async game=>{
    if(game.review){game.review=null;await advance(game);return;}
    if(game.phase==='DISCUSSION' && game.captain!==HUMAN){
     await openDiscussion(game);
     await aiAction(game,game.captain,'PROPOSE');
     return;
    }
    throw Error('目前沒有需要繼續的階段');
   });
   return json(res,200,humanView(g));
  }
  if(req.method==='POST'&&u.pathname==='/api/new'){
   const previous=await getGame();if(previous&&previous.phase!=='ENDED')return json(res,409,{error:'finish current game before starting a new one'});
   const g=createGame();g.audit=[];queueSpeakers(g,'DISCUSSION');await saveNewGame(g);return json(res,200,humanView(g));
  }
  // Save human speech first; do NOT call a model in the speech transaction.
  if(req.method==='POST'&&u.pathname==='/api/speak'){
   const p=await bodyJSON(req);
   if(!Number.isInteger(p.revision))return json(res,400,{error:'revision required'});
   const g=await mutateGame(p.revision,async game=>{
    speak(game,HUMAN,p.text);
    queueSpeakers(game,'HUMAN',p.text);
   });
   return json(res,200,humanView(g));
  }
  // One independent NPC per request; each successful reply is committed separately.
  // If provider rejects JSON, speech already exists and pending reply remains retryable.
  if(req.method==='POST'&&u.pathname==='/api/respond'){
   const p=await bodyJSON(req);
   if(!Number.isInteger(p.revision))return json(res,400,{error:'revision required'});
   const g=await mutateGame(p.revision,async game=>{
    const seat=game.replyQueue?.[0];
    if(!seat)throw Error('目前沒有待回應的 NPC');
    await aiAction(game,seat,'SPEAK');
    game.replyQueue.shift();
   });
   g.aiCallCount=await getGameUsage(g.id);
   return json(res,200,humanView(g));
  }
  if(req.method==='POST'&&u.pathname==='/api/action'){
   const p=await bodyJSON(req);if(!Number.isInteger(p.revision))return json(res,400,{error:'revision required'});
   const g=await mutateGame(p.revision,async(g)=>{
    if(g.review&&p.type!=='SPEAK')throw Error('請先確認上一階段結果');
    if(p.type==='SPEAK'){speak(g,HUMAN,p.text);queueSpeakers(g,'HUMAN',p.text);return;}
    else if(p.type==='PROPOSE'){propose(g,HUMAN,p.team);queueSpeakers(g,'PROPOSAL');}
    else if(p.type==='VOTE')vote(g,HUMAN,p.approve);
    else if(p.type==='MISSION')mission(g,HUMAN,p.fail);
    else if(p.type==='ASSASSINATE'){
     g.audit.push({seat:HUMAN,action:'HUMAN_ASSASSINATION_COMMIT',target:p.target,preResult:true});assassinate(g,HUMAN,p.target);
    }else throw Error('invalid action');
    await advance(g);
   });g.aiCallCount=await getGameUsage(g.id);return json(res,200,humanView(g));
  }
  return json(res,404,{error:'not found'});
 }catch(err){console.error('request error:',err.message);return json(res,400,{error:String(err.message||err)});}
});
checkConfig();await initializeStore();server.listen(PORT,'0.0.0.0',()=>console.log(`Avalon AI 2.4 listening on ${PORT}`));
