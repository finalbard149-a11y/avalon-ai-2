// Each model call receives one action contract, never the five incompatible
// response shapes simultaneously. Other game actions are implemented by rules.
import {SIZES} from './core.js';

const shared=[
 '你是七人阿瓦隆的一名獨立 NPC，依照自己合法知道的角色資訊、公開紀錄與私人歷史行動。',
 '請以繁體中文回應。只輸出一個有效 JSON 物件，不要 Markdown、程式碼圍欄或額外說明。',
 '不得取得或假裝知道其他玩家的未公開身分、秘密投票或任務牌。',
 '不要把懷疑描述為已確認的身分；可依陣營利益進行策略性欺騙，但必須記得自己的公開原話。',
 '第五次組隊投票若被否決，邪惡立即獲勝；不是強制通過。'
].join('\n');
const formats={
 SPEAK: {
  schema:'{"text":"繁體中文自然發言（1至3句）","beliefUpdate":{"note":"簡短的個人判斷更新","stances":[{"seat":2,"score":-1}]},"strategyPlan":{"intent":"UNDECIDED","reasons":["當下判斷理由"],"publicClaims":[],"uncertainties":[]}}',
  notes:'目前只能進行公開發言，不是在組隊。text 為必填。beliefUpdate.note 為必填，stances、strategyPlan 可省略；score 限 -2 到 2。如果當前已有提案且你有投票立場，strategyPlan.intent 可為 SUPPORT 或 OPPOSE，理由必須基於此刻可知資訊；無把握則 UNDECIDED。這是私人策略，不必公開；不得使用固定台詞。先回答最近一個問題；若被追問，先承認自己實際說過的原話，再解釋或撤回，不得捏造過去的動機。'
 },
 PROPOSE: {
  schema:null,
  notes:'你現在是隊長，唯一任務是「提名隊伍」，不是公開說話。必須返回 team 陣列與 reason 字串。team 僅包含 1 至 7 的整數，不能重複，且人數須符合當前任務。reason 是私人決策理由，不能把應保密的角色資訊公開說出來。請利用自己的合法資訊避開已知高風險隊員，特別是好人已經兩敗時。絕對不要輸出 text 或 beliefUpdate 來取代 team。'
 },
 ASSASSINATE:{
  schema:'{"ranking":[{"seat":2,"score":0,"support":["可觀察的支持理由"],"against":["反證"]}],"target":2}',
  notes:'目前是刺殺決策。ranking 必須涵蓋所有合法且非己方的候選玩家；target 必須為其中一名玩家。先比較公開證據與反證，不得使用不可見的身分真相。'
 },
 VOTE:{schema:'{"approve":true}',notes:'僅供測試：approve 必須是布林值。實際投票由零模型策略引擎執行。'},
 MISSION:{schema:'{"fail":false}',notes:'僅供測試：fail 必須是布林值。實際任務牌由零模型策略引擎執行。'}
};
export function actionOutputContract(action,round){
 const def=formats[action];if(!def)throw Error(`unsupported NPC action ${action}`);
 const size=SIZES[round-1];if(action==='PROPOSE'&&!size)throw Error('invalid Avalon round');
 const schema=action==='PROPOSE'?`{"team":[${Array.from({length:size},(_,i)=>i+1).join(',')}],"reason":"本次組隊的私人決策理由"}`:def.schema;
 return {action,expectedJSON:schema,notes:def.notes,teamSize:action==='PROPOSE'?size:null};
}
export function actionInstructions({action,round,seat,personality}){
 const spec=actionOutputContract(action,round);
 return [shared,`你的座位：${seat} 號。辯論個性：${personality}。`,`CURRENT_ACTION=${action}。不要執行其他動作。`,spec.notes,`唯一允許的回覆 JSON 格式（欄位名稱必須正確）：${spec.expectedJSON}`].join('\n');
}
