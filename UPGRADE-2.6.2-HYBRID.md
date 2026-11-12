# Avalon AI 2.6.2 Hybrid Reasoning & Accountable Voting

適用：目前 GitHub / Railway 正式版 2.6.1。**不需要先安裝先前的 2.6.2 記憶修補包**。

## 核心變更

1. `src/reasoning262.js`：自我發言追溯與可檢查的公開宣稱；邪惡角色可刻意誤導，但不能憑空改寫既有公開紀錄。
2. `src/deduction263.js`：零 API 的可能世界推理。僅使用該角色合法知道的資訊、公開任務牌數及隊伍。失敗牌數提供「至少幾名邪惡在隊伍」下限；邪惡可以提交成功，故成功任務不會排除邪惡。計算出的組合是邏輯可能性，不代表等機率或真正身分。梅林只看見規則允許的兩名邪惡；派西維爾不會被告知候選人誰是真梅林。不可公開洩漏這些私有結論。
3. `src/strategy.js`：七人局 `max(0,同意票數 - 4)` 為最低邪惡同意人數。普通忠臣在第一輪首次提案、沒有任何任務證據且不在隊伍時，偏向反對，但保有低機率同意以取得任務資訊（非強制否決）。梅林、派西維爾的合法身分線索不被誤視為「完全無資訊」。第五次提案仍特殊處理。
4. `src/memory26.js`、`src/server.js`：每個 NPC 投票當下保存自己選票、對應隊伍、提案次數、規則策略理由及來源標記至該 NPC 私人記憶。公開投票依規則揭曉；私人理由不能直接被別的 NPC 讀取。後續回答可回顧當時記錄，但仍可選擇公開說謊。
5. `src/agents.js`：每次對話在合法視角加入個人自傳、提問追溯與可能世界約束；不用額外模型呼叫。模型並未因此具備完美推理，仍須實戰測試。

## 安裝

上傳此 ZIP 至 GitHub 儲存庫根目錄並提交，Codespaces 執行：

```bash
git pull --rebase origin main
unzip -o avalon-ai-2.6.2-hybrid-patch.zip
npm test
npm run check
git add src/agents.js src/memory26.js src/reasoning262.js src/deduction263.js src/strategy.js src/server.js test/reasoning262.test.js test/hybrid262.test.js package.json UPGRADE-2.6.2-HYBRID.md
git commit -m "Upgrade Avalon AI 2.6.2 hybrid reasoning and accountable voting"
git push origin main
```

如命令顯示 `nothing to commit`，先檢查 `git status` 與檔案是否已存在；不要重複推送。

## 驗收與限制

- 本地 Node 22：`npm test` 74/74，`npm run check` 通過；尚未經正式 Railway、真實 AI 帳戶與長局測試。
- 既有對局仍可繼續，但舊版未存過的投票理由不會被事後補造；**建議重新開一局驗收**。
- 每次模型生成自然語言回覆仍會產生 API 請求；結構化邏輯推導與投票不增加模型呼叫。
- 邏輯驗證主要針對確定性規則與可追溯言行，不保證能辨識所有策略矛盾；惡方仍可故意說謊。
- 本版不需要改動 Railway API 金鑰或 DB schema，原本環境變數保持不變。
