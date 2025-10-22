# LLM Cost Optimizer Proxy

🚀 **Intelligent proxy that sits between your app and LLM APIs to automatically optimize costs**

## What it does

✂️ **Prompt Optimization** - Cleans prompts by removing redundancy and unnecessary words  
🔄 **Smart Model Routing** - Uses cheaper models for simple tasks, expensive ones only when needed  
💾 **Intelligent Caching** - Same question = same answer (without API calls)  
📊 **Cost Tracking** - Monitor every request and see how much you're saving  

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

**Result: 60-80% cost savings** while maintaining quality!

## Tech Stack

- **Node.js** - The proxy server
- **MongoDB** - Request logging and analytics
- **Redis** - High-performance caching
- **Express** - REST API framework

## Quick Start

### Option 1: Deploy to Vercel (Easiest)

Deploy to Vercel in minutes with MongoDB Atlas and Upstash Redis:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

See [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) for detailed deployment instructions.

### Option 2: Local Development

#### 1. Clone and Install
```bash
git clone <repo-url>
cd llm-cost-optimizer-proxy
npm install
```

#### 2. Environment Setup
```bash
cp .env.example .env
# Edit .env with your API keys and database URLs
```

#### 3. Start with Docker (Recommended)
```bash
docker-compose up -d
```

#### 4. Or Start Manually
```bash
# Start MongoDB and Redis first
npm run dev
```

## Usage

### Basic Proxy Request
```javascript
const response = await fetch('http://localhost:3001/api/proxy/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: "Explain quantum computing in simple terms",
    model: "gpt-4", // Will be optimized automatically
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
// Get optimization statistics
const stats = await fetch('http://localhost:3001/api/dashboard/stats?timeframe=24h');

// Get request logs
const logs = await fetch('http://localhost:3001/api/dashboard/requests?page=1&limit=50');

// Clear cache
await fetch('http://localhost:3001/api/dashboard/cache/clear', { method: 'POST' });
```

## Features

### 🎯 Smart Model Selection
- **Simple tasks** → Claude Haiku (cheapest)
- **Medium tasks** → Claude Sonnet (balanced)
- **Complex tasks** → Claude Opus (most capable)

### 🧹 Prompt Optimization
- Removes redundant phrases ("please", "kindly", etc.)
- Simplifies complex language
- Reduces token count by 20-40%

### ⚡ Intelligent Caching
- SHA-256 based cache keys
- Configurable TTL (default: 1 hour)
- Redis-powered for high performance

### 📈 Analytics & Monitoring
- Real-time cost tracking
- Model usage statistics
- Cache hit rates
- Processing time metrics

### 🛡️ Production Ready
- Rate limiting
- Error handling
- Health checks
- Docker support
- Comprehensive logging

## Configuration

### Environment Variables
```bash
# Server
PORT=3001
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/llm-cost-optimizer
REDIS_URL=redis://localhost:6379

# LLM APIs
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here

# Features
ENABLE_CACHING=true
ENABLE_PROMPT_OPTIMIZATION=true
ENABLE_SMART_ROUTING=true

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
```

## API Endpoints

### Proxy
- `POST /api/proxy/chat` - Main proxy endpoint

### Dashboard
- `GET /api/dashboard/stats` - Get optimization statistics
- `GET /api/dashboard/requests` - Get request logs
- `POST /api/dashboard/cache/clear` - Clear cache

### Health
- `GET /api/health` - Health check endpoint

## Cost Savings Examples

| Original Model | Optimized Model | Task Type | Savings |
|---------------|-----------------|-----------|---------|
| GPT-4 | Claude Haiku | Simple Q&A | ~95% |
| GPT-4 | Claude Sonnet | Code Review | ~80% |
| GPT-4 | Claude Opus | Complex Analysis | ~50% |

## Why This Matters

- **Plug & Play** - No code changes needed in your app
- **Massive Savings** - 60-80% cost reduction typical
- **Quality Maintained** - Smart validation ensures good responses
- **Open Source** - Self-hosted, full control
- **Production Ready** - Built for scale

## Deployment

### Vercel (Recommended for Quick Deployment)

This project is optimized for Vercel deployment with serverless functions. See [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) for:
- Step-by-step deployment guide
- MongoDB Atlas setup instructions
- Upstash Redis configuration
- Environment variable setup
- Troubleshooting tips

### Docker

Deploy anywhere with Docker:
```bash
docker-compose up -d
```

### Traditional VPS

Deploy to any VPS (AWS EC2, DigitalOcean, etc.) with Node.js, MongoDB, and Redis.

## Roadmap

- [ ] Web dashboard UI
- [ ] More LLM providers (Google, Cohere, etc.)
- [ ] Advanced prompt optimization with ML
- [ ] Custom routing rules
- [ ] A/B testing framework
- [ ] Webhook notifications

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details

---

**Save money on LLM costs without sacrificing quality!** 🎯