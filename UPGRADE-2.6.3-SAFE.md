# Avalon AI 2.6.3 — Prompt Diagnostics + Safe Proposal Guard

Install **directly on deployed 2.6.2 Hybrid**. This ZIP supersedes the previous 2.6.3 prompt-diagnostics patch; do **not** apply both packages separately.

## Root cause confirmed by finished-game audit

Merlin seat 4, 0 good wins / 2 losses, received `PROPOSE` from Cloudflare but returned a `SPEAK`-shaped JSON object with **no `team`**. The server's old `INVALID_ACTION` branch unconditionally chose the first three seat IDs, `[1,2,3]`, even though Merlin could legally see 1 (Assassin) and 3 (Morgana) as evil. Merlin's separate voting strategy consequently voted against its own fallback proposal.

## Changes

- `src/proposalGuard263.js`: inspect proposal format and size before committing to game state; at 2 losses good roles may not nominate players they *legally know* to be evil. Merlin sees Assassin/Morgana but not Mordred. No full role-table disclosure.
- `src/server.js`: all rejected proposals route to `safeProposalFallback`, which uses zero-cost seat-specific strategy and explicitly filters known evil at match point. No hard-coded `[1,2,3]` fallback. Save a decision-time source and audit `PROPOSAL_GUARD_REJECTED` / `SAFE_FALLBACK_PROPOSE`.
- Existing 2.6.3 prompt compaction, usage diagnostics, cooldown info and UI 2.6.3 label remain included.
- `test/proposalGuard263.test.js`: reproduces malformed Cloudflare output at 0-2; tests legal vs illegally inferred knowledge, malformed proposals and memory misranking.
- `package.json` `2.6.3-safe-proposal.2`; `npm run check` covers proposal guard.

This safeguards a specific, deterministically preventable error; it cannot ensure a 100% win rate. Other bad tactical choices, unknown evil (e.g. Mordred) and other players' votes remain possible. Raw invalid output is still recorded in the existing per-game audit for model quality evaluation. No external API is used in tests.

## Deploy

Upload ZIP to repo root, then in Codespaces:

```bash
git pull --rebase origin main
unzip -o avalon-ai-2.6.3-safe-proposal-patch.zip
npm test
npm run check
git add src/agents.js src/providers.js src/prompt263.js src/proposalGuard263.js src/server.js public/index.html package.json test/diagnostics263.test.js test/proposalGuard263.test.js UPGRADE-2.6.3.md UPGRADE-2.6.3-SAFE.md
git commit -m "Fix unsafe NPC proposals and upgrade 2.6.3 diagnostics"
git push origin main
```

No Railway environment variable changes or forced game resets are needed.
