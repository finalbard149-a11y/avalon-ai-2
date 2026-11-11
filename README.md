# Avalon AI 2.0 Alpha · Cloud First

**Status: deployable technical alpha, NOT production-security audited or a finished social-deduction AI.**

Single-user, seven-seat Avalon (human seat 3, six NPCs). Node.js 20+, Railway PostgreSQL. A single Railway backend also serves the mobile web UI, so no Netlify cross-site cookies or proxy are needed for the initial deployment. Netlify can be introduced later with a same-origin reverse proxy.

## Deploy from iPhone: GitHub + Railway

1. Extract `avalon-ai-2-alpha.zip`. Upload **the files and directories inside the extracted folder**, not the ZIP itself, to your private `avalon-ai-2` GitHub repository. GitHub mobile browser can be awkward with folders; if needed use GitHub's desktop-site mode or GitHub Codespaces. Do not commit `.env` or keys.
2. Railway > project `avalon-ai-2` > create a new service from GitHub repo `avalon-ai-2` (or connect the previously staged empty service). Set **root directory** to `/` (repo root).
3. In Railway backend service > Variables, set:
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` using Railway **reference variable** picker (the Postgres service must be named `Postgres`; otherwise select its actual name). Never copy/paste the actual connection string into chat.
   - `ADMIN_PASSWORD` = your own unique long password (12+ characters; prefer 20+).
   - `SESSION_SECRET` = a different random 32+ character secret.
   - `AVALON_AI_API_KEY` = your cloud AI API key (optional; without it NPCs use **basic offline test policy**, not cloud reasoning).
   - `AVALON_AI_MODEL` = a model your API account supports (optional; default `gpt-4.1-mini`).
4. Railway > backend > Settings > Networking > Generate Domain. Open the generated HTTPS URL in iPhone Safari. Log in with your `ADMIN_PASSWORD`.
5. Start a game. Closing and reopening the browser restores state from PostgreSQL. Do not create another game until current game ends.

**Do not connect Netlify yet.** First prove Railway-hosted mobile gameplay and persistence. Later use Netlify with a same-origin `/api/*` reverse proxy to Railway; direct cross-origin browser cookies are unreliable on iOS.

## Local developer test

```sh
npm install
ADMIN_PASSWORD='your-long-test-password' node src/server.js
npm test
```

In local development, the server can run without `DATABASE_URL`, but game state is volatile. Production refuses to start without PostgreSQL, `ADMIN_PASSWORD` and `SESSION_SECRET`.

## Fairness guarantees and limits

- Roles are held server-side. `perspective()` and `sanitizedRequest()` send only the current NPC's authorized information and public history.
- The counterfactual test swaps Merlin between two good seats while holding assassin-visible history constant and confirms the assassin request is identical.
- AI decisions are committed to the game record before the game outcome is evaluated; audit becomes visible **after** the game ends. Stored input/output hashes and selected output summaries support debugging but are **not tamper-proof**; operator with database access can edit records.
- No shared NPC conversation state; each model call gets its own private perspective and per-seat memory. This is **context separation**, not separate cloud provider processes.
- The first alpha has simplified dialogue, no full debate turn-taking, no persistent calibrated belief model, no evil-team assassination discussion, no model-quality validation, no full threat-model penetration testing. AI API errors fall back to simple policy and are recorded.
- Single-player owner account, one active game at a time; login password and session cookie, basic login throttling. Do not share the service URL publicly.
- Game state and role secrets are in PostgreSQL; a new game is not allowed while a previous game is in progress. Games are append-only in the database (old completed games remain).

## Important implementation boundaries

- `publicState()` does not expose hidden roles during play. Role knowledge is computed server-side.
- Good players cannot play a fail card; fourth mission requires two fails; five rejected teams end in evil victory; rejected teams rotate captain.
- Secret votes are not disclosed until all seven are received. NPC votes occur only after the human submits their vote.
- `POST` requires same-origin browser Origin header; use the generated Railway HTTPS domain, not a different-origin frontend.
- Cloud AI calls can take time; keep browser open while submitting an action. If a request fails, refresh to see whether the action committed. Avoid duplicate taps.

## Project layout

```
src/core.js    game rules and role perspectives
src/agents.js  cloud API / offline fallback and decision audit
src/store.js   PostgreSQL persistence and row-level locking
src/auth.js    owner password and signed cookie
src/server.js  HTTP API and game orchestration
public/index.html mobile web UI
test/core.test.js rules and counterfactual tests
railway.json   Railway deployment configuration
```

## API cost and safety

ChatGPT Plus does not include API credits. API use is billed separately. Railway/PostgreSQL may also incur charges; check Railway Usage. Never put keys, DB passwords, internal military information, or private personal data in GitHub or this chat. For use on base, follow applicable device/network policies.
