# Avalon AI 2.6 — Autobiographical Memory and Provider Cooldown

## What changes

- **Durable NPC biographies**: each NPC reconstructs its own previous proposals, public speech, revealed votes and public mission results from existing PostgreSQL game events. A private mission card is remembered by its owner only, not leaked to other NPCs or the human player's public state.
- **Proposal rationale at decision time**: an AI captain may include a short *private* reason with its team selection. The reason is saved only to that captain's memory after a legal proposal. When no reason was supplied, the record is `null`: no invented retrospective explanation.
- **Conversation consistency guidance**: models are told to acknowledge their previous choices when challenged. Strategic lies remain possible.
- **429 provider cooldown**: if an external model responds HTTP 429, its `Retry-After` header (when supplied) is capped between 15 and 3600 seconds and the provider is cooled down in PostgreSQL; repeated attempts during cooldown are rejected **before** consuming another request quota. If a seat has an explicitly configured free fallback, it can be tried instead. No auto-enabling paid models.
- **Configurable limits**: project limits were raised separately through Railway to `AVALON_DAILY_CALL_LIMIT=150`, `AVALON_GAME_CALL_LIMIT=90`, `AVALON_NPC_CALL_LIMIT=20`, `AVALON_CLOUDFLARE_DAILY_LIMIT=35`. The upgrade does NOT override provider-specific quotas or actual external provider limits.
- **Status endpoint**: authenticated GET `/api/provider-status` lists active provider cooldown expiry times and NPC model routes; no secrets are exposed.
- **Frontend**: version label updated to 2.6.

## Deploy on mobile Codespaces

1. Upload `avalon-ai-2.6-patch.zip` into the *root* of the existing `avalon-ai-2` GitHub repository, and commit the upload.
2. In Codespaces, paste these commands:

```bash
git pull --rebase origin main
unzip -o avalon-ai-2.6-patch.zip
npm test
npm run check
git add src/agents.js src/memory26.js src/providers.js src/quota.js src/server.js src/store.js public/index.html test/memory26.test.js test/multimodel23.test.js package.json
git commit -m "Upgrade Avalon AI 2.6 memory and quota"
git push origin main
```

3. Wait for Railway `hospitable-trust` deployment to show `SUCCESS`. Check game header `Fair Play Engine 2.6`.
4. Continue your existing game, if desired. Previous game state and roles are not reset by this patch. Test NPC memory by asking one about its previous proposal.

## Important limitations / safety

- 57 automated tests pass in the local environment; **real Railway/PostgreSQL and external model calls have not yet been verified for 2.6**.
- Raising internal limits does **not** increase Gemini/Groq/OpenRouter/Cloudflare free usage. Requests can still fail with an external 429, or the stricter per-provider cap. A single game can still run out if the available external free quotas are exhausted.
- The existing per-NPC strategy engine still handles ballots and mission cards without AI. NPCs do not share private thoughts.
- Cooldowns avoid repeat 429 calls for the same provider, but do not make capacity unlimited and are not a complete retry scheduler. User can continue a saved game after provider cooldown or external quotas reset; a previously consumed per-game counter does not reset automatically.
- The `AI_CALL_LIMIT` counters still count **attempts**, including unsuccessful attempts that reached the provider. This is deliberate for safety; separate success/failure metrics and fuller provider pool scheduling are future work.
- Never put API keys in the Git repo or in chat. Only use Railway Variables.
