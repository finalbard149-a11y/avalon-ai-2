# Avalon AI 2.7.0-beta.1 — Independent strategy continuity

This patch upgrades from the deployed 2.6.3 Safe Action Integrated edition. No database schema migration, game reset, paid model, or secret key export is required. The existing Railway 2.6.3 app must remain the production version until this patch is pushed and Railway builds it.

## What is implemented

- **Model-formed vote commitments, zero additional API calls:** During an ordinary `SPEAK` request, the NPC may optionally return a `strategyPlan` with SUPPORT / OPPOSE / UNDECIDED, contemporaneous reasons and uncertainties. It is saved privately in `npcMemory[seat].strategy27` after the publicly visible speech is actually committed. Later, while the exact proposal and latest public speech remain unchanged, that seat's zero-cost `VOTE` uses the model's prior choice and the exact saved rationale. If there was a new public speech, a different team, or an undecided plan, the existing rule-based vote mechanism remains as a clearly distinguished fallback; **there is no silent second AI request**.
- **Role safety:** the hard fifth-rejection rule still applies. Merlin cannot form/support a dangerous vote plan including an evil player visible to Merlin; the proposal guard from 2.6.3 is preserved. Plan memory is isolated by seat and never furnished to another NPC.
- **Natural speech:** NPCs still generate their own free-form Chinese dialogue. The strategy object is optional and private, not a fixed sentence template.
- **Shared-brain configuration (optional):** `AVALON_SHARED_PROVIDER` and `AVALON_SHARED_MODEL` can point multiple NPCs to the same model. Both variables are required together; `AVALON_NPC_{seat}_PROVIDER/MODEL` overrides take precedence. The game continues to enforce free-provider model allowlists. Enabling a shared model **does not increase the provider's rate limit**; avoid moving everybody to a fragile free endpoint without testing.
- **Offline benchmarking:** `npm run benchmark`, `npm run compare` support recorded samples, not uncontrolled live API calls. Prior 2.6.3 diagnostics and 2.7 offline tests are included.
- **Version:** title and page now show 2.7.

## Important limits

This is a first integrated beta, **not proof that a model is as capable as ChatGPT**. NPCs without a fresh model-formed plan still use the existing zero-cost ballot decision. The free model providers' 429s are not fixed by this patch. No live-provider benchmarking or six-agent live game has been performed as part of the offline tests; measure those after deployment. Never mistake syntax/unit-test results for social reasoning quality. No new provider is switched on by default.

## Install from existing 2.6.3

Upload `avalon-ai-2.7-integrated.zip` to the repository root, then in Codespaces:

```bash
git pull --rebase origin main
unzip -o avalon-ai-2.7-integrated.zip
npm test
npm run check
git add src/agents.js src/routing25.js src/providers.js src/actionPrompt263.js src/prompt263.js src/server.js src/strategy27.js src/benchmark27.js src/modelComparison27.js scripts/benchmark27.mjs scripts/compare27.mjs public/index.html package.json test/benchmark27.test.js test/research27.test.js test/integration27.test.js test/diagnostics263.test.js test/multimodel23.test.js UPGRADE-2.7.md UPGRADE-2.7-STAGE1.md UPGRADE-2.7-RESEARCH.md
git commit -m "Upgrade Avalon AI to 2.7 integrated strategy memory"
git push origin main
```

Do NOT upload `node_modules` from the local test environment. Railway will install the actual `pg` package. Production state remains in PostgreSQL.

## Acceptance checklist

1. Confirm Railway SUCCESS for the new commit and web UI shows 2.7.
2. In a new game, get an NPC to speak during a proposed team's voting phase. Inspect post-game audit `STRATEGY_COMMITMENT_27` and private `npcMemory[seat].strategy27` to confirm the model created a plan; if it omitted the optional field it will correctly fall back.
3. If its vote uses the saved commitment, `ownVoteReasons` contains `MODEL_COMMITMENT_27`; if another public utterance occurs first, the commitment becomes stale and no longer overrides the ballot.
4. Repeat the Merlin 0–2 crisis scenario; no unsafe proposal, even when a provider returns a SPEAK object instead of a PROPOSE object.
5. Check 429 and per-provider usage before considering optional shared-brain env configuration.
