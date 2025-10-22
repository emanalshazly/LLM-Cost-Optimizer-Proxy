# LLM Cost Optimizer Proxy - Usage Examples

This directory contains practical examples demonstrating how to use the LLM Cost Optimizer Proxy.

## Prerequisites

1. Make sure the proxy server is running:
   ```bash
   cd ..
   npm install
   npm run dev
   ```

2. Install example dependencies:
   ```bash
   npm install
   ```

3. Ensure you have API keys configured in the main `.env` file

## Examples

### 1. Basic Usage (`basic-usage.js`)

Demonstrates the core functionality of the proxy:
- Simple question routing (uses cheapest model)
- Cache hit demonstration (second request is instant)
- Medium complexity question handling
- Complex question processing
- Cost savings tracking

**Run:**
```bash
npm run basic
```

**What you'll learn:**
- How to send requests to the proxy
- How the smart routing works
- How caching speeds up repeated requests
- How to interpret the response data

### 2. Dashboard API (`dashboard-usage.js`)

Shows how to interact with the dashboard API:
- Fetching statistics and analytics
- Getting request logs
- Viewing model usage breakdown
- Checking system health

**Run:**
```bash
npm run dashboard
```

**What you'll learn:**
- How to access dashboard data programmatically
- Understanding statistics and metrics
- Monitoring system health

### 3. Batch Processing (`batch-requests.js`)

Demonstrates processing multiple requests efficiently:
- Parallel request processing
- Aggregate cost savings
- Cache performance with repeated batches

**Run:**
```bash
npm run batch
```

**What you'll learn:**
- How to process multiple requests efficiently
- Cache benefits for repeated workloads
- Cost tracking across multiple requests

## Understanding the Output

Each example prints detailed information about:
- **Response**: The AI-generated answer
- **Model used**: Which model the proxy selected (haiku/sonnet/opus)
- **Cost saved**: How much money was saved vs. using the original model
- **Processing time**: How long the request took
- **Cache hit**: Whether the response came from cache
- **Routing reason**: Why the proxy chose this model

## Tips

- Run examples multiple times to see caching in action
- Compare processing times between first and subsequent runs
- Monitor the dashboard while running examples
- Try modifying the prompts to see different routing decisions

## Integration into Your App

To integrate the proxy into your own application:

```javascript
import axios from 'axios';

const response = await axios.post('http://localhost:3001/api/proxy/chat', {
  prompt: 'Your question here',
  model: 'gpt-4',  // The model you would normally use
  provider: 'openai'
});

console.log('Answer:', response.data.response);
console.log('Cost saved:', response.data.cost.saved);
```

That's it! The proxy handles all optimization automatically.
