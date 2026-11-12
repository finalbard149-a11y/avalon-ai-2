# Avalon AI 2.7 第一階段：離線模型能力驗收

這是 **2.6.3 的非破壞性附加更新**：只新增 `src/benchmark27.js`、`scripts/benchmark27.mjs`、測試與 npm 指令。**不改現有六個 NPC 的路由、遊戲決策或 Railway 環境變數。**

## 測試項目
- 梅林 0 勝 2 敗時的組隊：重現 Cloudflare 回傳 SPEAK JSON、缺少 `team` 的故障；驗證固定 1、2、3 不會再次出現。
- 自我發言追溯：NPC 必須承認自己剛才的強烈指控。
- 當下投票理由：公開解釋必須與事前保存的理由相符。
- 送交模型的測試資料僅由該座位的合法視角形成；測試不會送出完整角色表。

## 指令（完全不呼叫 API）

```bash
npm test
node scripts/benchmark27.mjs cases > benchmark-cases.json
node scripts/benchmark27.mjs replay my-responses.json
```

`my-responses.json` 按案例 ID 存放模型回傳的 **JSON 物件**：

```json
{
  "merlin-elimination-proposal":{"team":[2,4,5],"reason":"避開已知風險"},
  "own-words-accountability":{"text":"我剛才確實做過這項指控，但證據不足，現在撤回。"},
  "own-vote-explanation":{"text":"我投同意是為了觀察任務結果。"}
}
```

評分器是**可重現的最低限度格式、事實與記憶檢查**，不是社交品質評分，也不能判定角色是否有意欺騙。未經使用者同意，不會呼叫任何模型或使用免費帳號額度。模型供應商比較須下一階段取得同意後，才進行少量真實請求。
