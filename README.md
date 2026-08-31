# LLM Cost Optimizer Proxy

**Reference implementation for routing, caching, and estimating LLM request costs.**

[![CI](https://github.com/emanalshazly/LLM-Cost-Optimizer-Proxy/actions/workflows/ci.yml/badge.svg)](https://github.com/emanalshazly/LLM-Cost-Optimizer-Proxy/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

## What it does

✂️ **Prompt Optimization** - Cleans prompts by removing redundancy and unnecessary words  
🔄 **Smart Model Routing** - Uses cheaper models for simple tasks, expensive ones only when needed  
💾 **Intelligent Caching** - Same question = same answer (without API calls)  
📊 **Cost Estimation** - Compare requests using an editable point-in-time pricing table

## The Secret: Agent Chain Architecture

```
Haiku → Analyzes if question is simple/medium/complex
  ↓
Haiku → Answers if simple
  ↓
Sonnet → Validates Haiku's answer for medium complexity
  ↓
Opus → Only used for truly complex tasks
```

The architecture is intended to make lower-cost routing experiments measurable. This repository does not contain evidence for a general savings or quality-maintenance percentage.

## Tech Stack

- **Node.js** (>= 18) - The proxy server
- **MongoDB** *(optional)* - Request logging and analytics
- **Redis** *(optional)* - High-performance caching
- **Express** - REST API framework

> **Zero-infrastructure mode:** MongoDB and Redis are both optional. Without
> them, the proxy falls back to in-memory caching and request logging, so
> `npm ci && npm start` works out of the box. Add the services later for
> durable storage and a shared cache.

## Quick Start

### 1. Clone and Install
```bash
git clone <repo-url>
cd llm-cost-optimizer-proxy
npm ci
```

### 2. Environment Setup
```bash
cp .env.example .env
# Edit .env with your API keys (placeholders only in .env.example)
```

### 3. Start with Docker (Recommended for full stack)
```bash
docker-compose up -d
```

### 4. Or Start Manually
```bash
# With zero infrastructure (in-memory cache + logging):
npm start

# Or with MongoDB and Redis running locally:
npm run dev
```

### 5. Open the Dashboard
Visit `http://localhost:3001/` for the built-in web dashboard (stat tiles, model usage, recent requests, cache clearing). If you've set `API_KEY`, paste it into the dashboard's key field so its calls to the JSON API are authenticated.

## Usage

### Basic Proxy Request
```javascript
const response = await fetch('http://localhost:3001/api/proxy/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'your_api_key' // omit if API_KEY isn't set
  },
  body: JSON.stringify({
    prompt: "Explain quantum computing in simple terms",
    model: "gpt-4",     // your original model — used as the cost baseline
    provider: "openai"
  })
});

const result = await response.json();
console.log('Response:', result.response);
console.log('Cost saved:', result.cost.saved);
console.log('Model used:', result.model);
```

### Dashboard API
```javascript
const headers = { 'x-api-key': 'your_api_key' }; // omit if API_KEY isn't set

// Get optimization statistics
const stats = await fetch('http://localhost:3001/api/dashboard/stats?timeframe=24h', { headers });

// Get request logs
const logs = await fetch('http://localhost:3001/api/dashboard/requests?page=1&limit=50', { headers });

// Clear cache
await fetch('http://localhost:3001/api/dashboard/cache/clear', { method: 'POST', headers });
```

## Features

### 🎯 Smart Model Selection
- **Simple tasks** → Claude Haiku (cheapest)
- **Medium tasks** → Claude Sonnet (balanced, only if Haiku's answer fails validation)
- **Complex tasks** → Claude Opus (most capable)
- Set `ENABLE_SMART_ROUTING=false` to pass requests through to the requested model unchanged
- A fast heuristic (prompt length + keyword cues) classifies obvious simple/complex prompts without an extra LLM call; only ambiguous prompts fall back to the Haiku classification call

### 🔌 Provider Support
- Anthropic (Claude) and OpenAI (GPT) out of the box
- Google Gemini (`gemini-*` models) via `LLMProvider.callGoogle` — set `GOOGLE_API_KEY`

### 🔐 Authentication
- Optional `API_KEY` env var gates `/api/proxy/*` and `/api/dashboard/*` behind an `x-api-key` header (see Configuration below); `/api/health` and the dashboard UI's static assets stay public

### 📟 Web Dashboard
- A zero-build static dashboard at `/` (stat tiles, model usage, recent requests, timeframe filters, cache clearing) that consumes the existing `/api/dashboard` endpoints

### 🧹 Prompt Optimization
- Removes redundant phrases ("please", "kindly", etc.)
- Simplifies complex language
- Reports token-count differences for inspection; no general reduction range is claimed

### ⚡ Intelligent Caching
- SHA-256 based cache keys — raw prompts are never stored in keys or logs
- Configurable TTL (default: 1 hour)
- Redis-powered when available, in-memory fallback otherwise

### 📈 Analytics & Monitoring
- Real-time cost tracking
- Model usage statistics
- Cache hit rates
- Processing time metrics

### 💲 Inspectable pricing estimates
All cost estimates read from a single, editable pricing table:
[`src/config/pricing.js`](src/config/pricing.js) — USD per 1K tokens for
Anthropic, OpenAI, and Google models. Its provenance record marks the current
table `requires_revalidation`; verify the linked provider pages before quoting
or making a purchasing decision.

### 🛡️ Reference implementation controls
- Rate limiting (Redis-backed or in-memory)
- Error handling
- Health checks
- Docker support (non-root container)
- Comprehensive logging (raw prompts and API keys are never logged)
- Test suite with mocked LLM providers (`npm test`)

## Configuration

### Environment Variables
```bash
# Server
PORT=3001
NODE_ENV=development

# Optional infrastructure — leave empty to use in-memory fallbacks
MONGODB_URI=
REDIS_URL=

# LLM APIs
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
GOOGLE_API_KEY=your_key_here

# Features
ENABLE_CACHING=true
ENABLE_PROMPT_OPTIMIZATION=true
ENABLE_SMART_ROUTING=true
ENABLE_REQUEST_LOGGING=true

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000

# API Authentication (optional but recommended before exposing this publicly)
API_KEY=
```

When `API_KEY` is set, every request to `/api/proxy/*` and `/api/dashboard/*` must include an `x-api-key` header with that value. `/api/health` and the dashboard UI's static assets stay public. Leaving `API_KEY` unset keeps the API open (a startup warning is logged) — fine for local development, not for anything reachable publicly.

## Testing

```bash
npm test
```

Jest + supertest suite covering the health endpoint, proxy request
validation, routing decisions, cache hit/miss logic, dashboard stats,
API key gating, and the Gemini provider dispatch. All external LLM calls,
Redis, and MongoDB are mocked — no API keys or running services needed.

## API Endpoints

### Proxy
- `POST /api/proxy/chat` - Main proxy endpoint

### Dashboard
- `GET /api/dashboard/stats` - Get optimization statistics
- `GET /api/dashboard/requests` - Get request logs
- `POST /api/dashboard/cache/clear` - Clear cache

### Health
- `GET /api/health` - Health check endpoint (reports per-service status; optional services show as `disabled`)

## Replay benchmark

Run `npm run benchmark:replay` to replay fixed token counts. The output keeps
`cost_estimate` separate from `quality_result`; the bundled fixture intentionally
reports quality as `not_measured`. Cost deltas do not prove response quality.

### Limitations

- The table contains legacy model ids and unmeasured point estimates; it is not a live pricing feed.
- The previously stated 60–80% savings and 20–40% prompt reduction ranges were estimates, not repository benchmarks.
- Provider pricing, token accounting, latency, and model availability change over time.
- Mocked unit tests do not establish production reliability or output quality.

### Illustrative estimates only

| Original Model | Optimized Model | Task Type | Estimated Savings |
|---------------|-----------------|-----------|-------------------|
| GPT-4 | Claude Haiku | Simple Q&A | ~95% |
| GPT-4 | Claude Sonnet | Code Review | ~80% |
| GPT-4 | Claude Opus | Complex Analysis | ~50% |

## Why This Matters

- **Plug & Play** - No code changes needed in your app
- **Inspectable estimates** - Cost math and pricing provenance are explicit
- **Quality tracked separately** - Replay results cannot infer quality from price
- **Open Source** - Self-hosted, full control
- **Self-hostable reference** - Production hardening remains deployment-specific

## Roadmap

- [x] Web dashboard UI
- [x] More LLM providers (Google added; Cohere etc. still open)
- [ ] Advanced prompt optimization with ML
- [ ] Custom routing rules
- [ ] A/B testing framework
- [ ] Webhook notifications

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). In short:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details

---

**Measure routing cost and quality as separate outcomes.**
