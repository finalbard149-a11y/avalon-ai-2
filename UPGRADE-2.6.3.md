# Avalon AI 2.6.3 — Prompt Compact & Rate-Limit Diagnostics

Baseline: deployed 2.6.2 Hybrid. This update preserves all database records, role privacy, per-NPC memory and the previous Cloudflare fix.

- Compact prompts avoid repeating full public event and chat history; mission outcomes and deterministic legal deductions remain.
- Own recent words and decision-time ballot reasons remain available to each NPC; the latest player dialogue is included.
- Railway runtime logs include `AI_USAGE` summaries: provider, model, prompt character/byte count, elapsed time, HTTP status, provider-returned token usage when available, 429 retry hint. No prompts, API keys or hidden role content are logged.
- Limits: HTTP 429 might mean per-minute, per-day or temporary provider capacity; without an explicit provider signal, the code does not guess the specific cause. `Retry-After` headers take precedence; missing values default to 60 seconds.
- UI title and version now explicitly show 2.6.3. Authenticated refresh also displays the stored provider cooldown expiration (not a guarantee the upstream limit has cleared).
- Does not change provider keys, routes, paid/free settings or existing game database.

Run `npm test && npm run check`, then commit files and let Railway deploy. No external model calls in tests.
