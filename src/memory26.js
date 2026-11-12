// Reconstruct a seat's biography from durable public game events and private
// observations kept only for that seat. No other player's private memory or
// unrevealed cards are included.

const short=(s,n=170)=>String(s||'').slice(0,n);
export function biography(g,seat){
 const history=[];
 for(const e of (g.events||[])){
  const p=e.payload||{};
  if(e.type==='PROPOSE'&&p.seat===seat) history.push({seq:e.seq,round:roundOf(g,e.seq),kind:'OWN_PROPOSAL',team:p.team,attempt:p.attempt,meaning:'我親自選擇過這支隊伍；當時原因若未記錄，不得捏造'});
  if(e.type==='SPEAK'&&p.seat===seat) history.push({seq:e.seq,kind:'OWN_SPEECH',text:short(p.text,450)});
  if(e.type==='VOTE_REVEAL'&&p.votes&&typeof p.votes[seat]==='boolean') history.push({seq:e.seq,kind:'OWN_VOTE',approve:p.votes[seat],team:teamBefore(g,e.seq)});
  if(e.type==='MISSION_RESULT') history.push({seq:e.seq,kind:'PUBLIC_MISSION_RESULT',round:p.round,team:p.team,success:p.success,fails:p.fails});
 }
 const own=g.npcMemory?.[seat]||{};
 return {history:history.slice(-35),ownMissionCards:(own.ownMissionCards||[]).slice(-7),selfNote:short(own.note,400),stances:own.stances||{},strategyNotes:(own.strategyNotes||[]).slice(-7),ownProposalReasons:(own.ownProposalReasons||[]).slice(-8)};
}
function teamBefore(g,seq){const e=[...(g.events||[])].reverse().find(e=>e.seq<seq&&e.type==='PROPOSE');return e?.payload?.team||[];}
function roundOf(g,seq){let r=1;for(const e of g.events||[]){if(e.seq>=seq)break;if(e.type==='MISSION_RESULT')r++;}return r;}
export function rememberPrivateMission(g,seat,fail){
 g.npcMemory??={};const m=g.npcMemory[seat]||{};
 const a=Array.isArray(m.ownMissionCards)?m.ownMissionCards:[];
 g.npcMemory[seat]={...m,ownMissionCards:[...a,{round:g.round,team:[...g.team],card:fail?'FAIL':'SUCCESS'}].slice(-7)};
}
export function memoryPrompt(g,seat){
 const b=biography(g,seat);
 return {autobiography:b,accountabilityRules:[
 'When challenged about a past choice, acknowledge your own proposals, ballots, and speeches accurately.',
 'A mission result can justify a changed suspicion, but NEVER claim an earlier reason was recorded when it was not.',
 'You may strategically lie, but remember your actual past actions and keep intentional deception distinct from false memories.',
 'Own mission cards are private; do not reveal them simply because they appear in memory.'
 ]};
}

// Record only a motivation actually returned at decision time. A missing motivation
// remains missing; we never reconstruct a fictional explanation after the fact.
export function rememberProposalReason(g,seat,team,reason,source){
 g.npcMemory??={};const m=g.npcMemory[seat]||{};const prev=m.ownProposalReasons||[];
 g.npcMemory[seat]={...m,ownProposalReasons:[...prev,{round:g.round,attempt:g.attempt,team:[...team],reason:reason?short(reason,240):null,source}].slice(-8)};
}
