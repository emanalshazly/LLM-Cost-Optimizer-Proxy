# Contributing

Thanks for your interest in improving the LLM Cost Optimizer Proxy! 🎯

## Getting Started

```bash
git clone <repo-url>
cd llm-cost-optimizer-proxy
npm install
cp .env.example .env   # fill in your API keys
npm run dev
```

The proxy runs with **zero infrastructure** — without MongoDB/Redis it falls
back to in-memory caching and request logging. To develop against real
services, run `docker-compose up -d mongo redis`.

## Running Tests

```bash
npm test
```

All external LLM calls, Redis, and MongoDB are mocked/stubbed in tests — no
API keys or running services are required. Please keep it that way.

## Guidelines

- **Never commit secrets.** `.env` is gitignored; `.env.example` must only
  contain placeholders.
- **Never log raw prompts or API keys.** Use fingerprints/hashes when a
  request reference is needed in logs.
- Keep external behavior backward compatible unless a PR explicitly
  documents a change.
- Add or update tests for any behavior change.
- Node.js >= 18 is required.

## Pull Requests

1. Fork the repo and create a branch from `main`.
2. Make your changes with tests.
3. Make sure `npm test` passes locally.
4. Open a PR against `main` and fill in the template — describe the change,
   the motivation, and how it was tested.

CI runs the test suite on Node 18, 20, and 22 for every PR.
