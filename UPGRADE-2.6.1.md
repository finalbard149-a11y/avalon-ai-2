# Avalon AI 2.6.1 — Cloudflare GLM 回應與手機逾時修補

## 修正

- 針對 `@cf/zai-org/glm-4.7-flash` 設定 `chat_template_kwargs.enable_thinking=false`，避免預設推理過程消耗全部回應 token 導致 `message.content` 為空。
- 使用 `max_completion_tokens`，繼續要求 `response_format: {type:'json_object'}`；其他模型的請求參數不變。
- Cloudflare 模型回應等候上限 19 秒，避免手機端長時間無回應；前端 NPC 回應請求在 27 秒時明確中止並釋放控制項。
- 可讀取符合 OpenAI Chat Completions 的文字陣列（text parts）。無內容時顯示供應商與 finish_reason，不包含私人資料或 API Key。
- 保留原本 NPC 角色、4 號 Cloudflare 模型設定、PostgreSQL 資料、六模型路由與限制額度，不自動改用付費模型。

## 安裝

把 ZIP 放進私人 GitHub 專案 `avalon-ai-2` 的根目錄並提交；Codespaces 終端機：

```bash
git pull --rebase origin main
unzip -o avalon-ai-2.6.1-cloudflare-hotfix.zip
npm test
npm run check
git add src/providers.js public/index.html test/cloudflare261.test.js package.json UPGRADE-2.6.1.md
git commit -m "Fix Cloudflare GLM response and mobile timeout"
git push origin main
```

這是一個**增量修補包**，必須安裝在已部署的 2.6 之上。Railway 會在 GitHub 推送後自動部署。部署完成後，保留目前對局，在議事廳指定「4 號，請回答……」進行測試。如果 Cloudflare 仍回傳 HTTP 429、403、空白文字或 19 秒逾時，請回報截圖；需依 Railway 實際日誌繼續診斷，不能把這版自動測試視為真實 API 成功。

## 測試

此版在本地用 PostgreSQL 測試替身跑過 61 項測試、JS 語法檢查完成。未以使用者 Cloudflare 機密金鑰執行外部 API 請求。
