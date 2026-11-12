# Avalon AI 2.6.3 — 安全組隊與動作專用格式（整合版）

這一份 ZIP 可從已部署的 2.6.2 Hybrid 直接升級，**取代**先前所有 2.6.3 ZIP；不要依序套用不同 2.6.3 包。

## 此次整合

- 2.6.3 提示詞精簡、模型請求大小及回應時間診斷、429 冷卻資訊；顯示版號 2.6.3。
- 組隊守門：禁止固定 `[1,2,3]` 備援；資料不合法或決勝危機出現已知邪惡時，使用只依該 NPC 合法資訊的零模型安全組隊。
- 動作專用提示詞：`PROPOSE` 只給 `team/reason` 格式；`SPEAK` 只給 `text/beliefUpdate` 格式；`ASSASSINATE` 只給 `ranking/target` 格式。不把五套互相衝突的輸出範例同時交給模型。
- 請求資料中同步標記 `requestedAction` 和 `outputContract`。Cloudflare GLM 仍採原本 JSON Object 相容模式與 `enable_thinking:false`；這個格式約束**不能保證模型 100% 正確**，因此保留程式驗證。
- 不改動原本六模型分配、API Key、Railway 變數或資料庫資料。

## 更新（請將 ZIP 放在 GitHub 儲存庫根目錄）

```bash
git pull --rebase origin main
unzip -o avalon-ai-2.6.3-safe-action-integrated.zip
npm test
npm run check
git add src public package.json test UPGRADE-2.6.3.md UPGRADE-2.6.3-SAFE.md UPGRADE-2.6.3-ACTION-FORMAT.md
git commit -m "Integrate safe proposals and action-only AI formats in 2.6.3"
git push origin main
```

## 本機驗證

`npm test`: 91 passed, 0 failed. `npm run check`: passed. 尚未實際呼叫外部模型。

## 回歸情境

梅林座位 4，已知 1 刺客、3 莫甘娜，0 勝 2 敗，第三輪組隊。若 AI 回應 `SPEAK` 格式（只有 text、beliefUpdate），程式應記錄 `PROPOSAL_GUARD_REJECTED` 並產生不含 1 或 3 的三人隊伍，而非固定 `[1,2,3]`。
