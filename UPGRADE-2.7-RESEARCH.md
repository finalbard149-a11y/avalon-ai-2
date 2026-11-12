# Avalon AI 2.7 — Research development snapshot

This is a non-production prototype; do NOT deploy to Railway yet.

## Added
- `src/strategy27.js`: isolated per-seat, event-bound strategy commitments. Retains actual reasons and public claims; old plans expire when public discussion or team proposal changes. No role table or other NPC's private memory in model view.
- `src/modelComparison27.js`: compares offline model response samples on benchmark 2.7 cases, tracks compliance, latency and only provider-reported token numbers. It does not invoke an API and does not claim to measure full social intelligence.
- `scripts/compare27.mjs`: `node scripts/compare27.mjs samples.json`, where the JSON root is an array of `{model,caseId,latencyMs,response,inputTokens?,outputTokens?,run?}`.
- `test/research27.test.js`: tests private isolation, plan invalidation, vote consistency, Merlin danger and benchmark output.

## Status
- 104 automated tests passed; syntax check passed.
- No live provider comparisons were run; no data suggests a winner yet.
- Not wired into `src/server.js`/`src/agents.js`; production behavior remains Avalon AI 2.6.3.
- Next steps: consented, rate-capped live comparisons; stronger natural-dialogue scoring; safely integrate planning into gameplay and verify against full-game simulations.
