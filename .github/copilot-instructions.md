# Copilot instructions for this repo

This is a Node.js/Express proxy that sits in front of Anthropic/OpenAI/Google
LLM APIs, routes each request to the cheapest model that can handle it, and
tracks the resulting cost savings. Follow these conventions when implementing
issues or reviewing PRs here.

## Architecture

- `src/app.js` — Express app **factory** (`createApp()`). Builds and returns
  the app without starting a listener or connecting to any infrastructure, so
  tests mount it directly with supertest. All route/middleware wiring lives
  here, not in `src/server.js`.
- `src/server.js` — the actual entry point. Loads `.env` (via
  `src/config/env.js`, imported first for import-order reasons), connects to
  Mongo/Redis, then calls `createApp()` and starts listening.
- `src/services/AgentChain.js` — the routing brain. `heuristicComplexity()`
  classifies obvious simple/complex prompts by length + keyword cues *before*
  paying for a Haiku classification call (`analyzeComplexity()`); only
  ambiguous prompts hit the LLM classifier. `ROUTING_MODELS` is the
  complexity → model table.
- `src/services/LLMProvider.js` — one `call<Provider>()` method per provider
  (Anthropic, OpenAI, Google). Each reads its API key **lazily inside the
  method** (never cached on the instance, never logged) and throws a clear
  `"X_API_KEY is not configured"` error if missing. New providers follow this
  exact pattern.
- `src/config/pricing.js` — the **single source of truth** for model pricing.
  Every cost/savings calculation reads from `calculateCost`/`calculateSavings`
  here. Never hardcode a price anywhere else; add new models to
  `MODEL_PRICING` instead.
- `src/config/database.js` / `src/config/redis.js` — MongoDB and Redis are
  both **optional**. Guard any infra-dependent code with `isMongoConnected()`
  / `isRedisConnected()` and provide an in-memory fallback (see
  `src/services/RequestStore.js` and `src/services/CacheService.js` for the
  pattern) so `npm install && npm start` keeps working with zero
  infrastructure.
- `src/utils/env.js` — `envFlag(name, default)` for boolean env vars
  (`1/true/yes/on`, case-insensitive). Use it instead of ad-hoc
  `process.env.X === 'true'` checks.
- `src/middleware/auth.js` — `requireApiKey` gates a route behind an
  `x-api-key` header matching `API_KEY`. It's a no-op (with a one-time
  startup warning) when `API_KEY` is unset. Apply it the same way `app.js`
  already does for `/api/proxy` and `/api/dashboard`; `/api/health` and the
  dashboard's static assets must stay public.
- `public/` — the web dashboard UI. Plain HTML/CSS/JS, **no build step, no
  framework**. It calls the `/api/dashboard/*` JSON API directly and sends
  `x-api-key` from a field stored in `localStorage`. Keep it that way.

## Testing

- Jest, imported explicitly from `@jest/globals` in every test file (no
  global `test`/`expect`) — see any file under `tests/` for the pattern.
- HTTP-level tests mount `createApp()` from `src/app.js` and drive it with
  `supertest`.
- Mock ESM modules with `jest.unstable_mockModule(...)` **before** the
  dynamic `await import(...)` of the module under test (see
  `tests/llmProvider.test.js` for mocking `axios`, `tests/cache.test.js` for
  a fake Redis client).
- Tests set `process.env.NODE_ENV = 'test'` and any other required env vars
  at the top of the file, before importing the modules under test — several
  modules read `process.env` at import or construction time.
- Run `npm test` and make sure everything passes before opening or updating
  a PR. There is no committed `package-lock.json` yet (see the Dockerfile
  comment) — use `npm install`, not `npm ci`.

## Conventions

- Pure ESM (`"type": "module"` in `package.json`). No TypeScript, no bundler,
  no build step for the backend.
- New env vars belong in **both** `.env.example` and the README's
  Configuration section, with a one-line explanation of what they do and
  their default behavior when unset.
- Never commit real API keys, tokens, or secrets — `.env.example` only ever
  has placeholders or blanks.
- When a feature changes cost/latency trade-offs (e.g. an ML-based
  optimization pass), gate it behind a feature flag rather than making it
  always-on.
