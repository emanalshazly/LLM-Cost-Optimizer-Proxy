# Deploying LLM Cost Optimizer Proxy to Vercel

This guide will walk you through deploying the LLM Cost Optimizer Proxy to Vercel.

## Prerequisites

Before deploying to Vercel, you need:

1. A [Vercel account](https://vercel.com/signup) (free tier works great)
2. A [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account (free tier available)
3. An [Upstash Redis](https://upstash.com/) account (free tier available)
4. API keys for LLM providers (Anthropic, OpenAI, etc.)

## Step 1: Set Up MongoDB Atlas

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster (free M0 tier is sufficient to start)
3. Create a database user with read/write permissions
4. Whitelist all IP addresses (0.0.0.0/0) for Vercel's dynamic IPs
5. Get your connection string (it looks like: `mongodb+srv://username:password@cluster.mongodb.net/llm-cost-optimizer`)

## Step 2: Set Up Upstash Redis

1. Go to [Upstash](https://upstash.com/)
2. Create a new Redis database
3. Choose a region close to your Vercel deployment region
4. Copy the Redis URL (format: `redis://default:password@endpoint:port`)

## Step 3: Deploy to Vercel

### Option A: Deploy via Vercel CLI (Recommended)

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy from your project directory:
```bash
vercel
```

4. Follow the prompts:
   - Set up and deploy: **Yes**
   - Which scope: Choose your account
   - Link to existing project: **No**
   - Project name: `llm-cost-optimizer-proxy` (or your preferred name)
   - In which directory is your code located: `./`

5. Add environment variables:
```bash
vercel env add MONGODB_URI
vercel env add REDIS_URL
vercel env add ANTHROPIC_API_KEY
vercel env add OPENAI_API_KEY
vercel env add ENABLE_CACHING
vercel env add ENABLE_PROMPT_OPTIMIZATION
vercel env add ENABLE_SMART_ROUTING
```

6. Deploy to production:
```bash
vercel --prod
```

### Option B: Deploy via Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New Project"**
3. Import your Git repository
4. Configure project settings:
   - **Framework Preset:** Other
   - **Root Directory:** ./
   - **Build Command:** (leave empty)
   - **Output Directory:** (leave empty)

5. Add environment variables in the Vercel dashboard:
   - `MONGODB_URI` = Your MongoDB Atlas connection string
   - `REDIS_URL` = Your Upstash Redis URL
   - `ANTHROPIC_API_KEY` = Your Anthropic API key
   - `OPENAI_API_KEY` = Your OpenAI API key
   - `GOOGLE_API_KEY` = (optional) Your Google API key
   - `ENABLE_CACHING` = `true`
   - `CACHE_TTL` = `3600`
   - `ENABLE_PROMPT_OPTIMIZATION` = `true`
   - `ENABLE_SMART_ROUTING` = `true`
   - `RATE_LIMIT_WINDOW_MS` = `60000`
   - `RATE_LIMIT_MAX_REQUESTS` = `100`
   - `NODE_ENV` = `production`

6. Click **"Deploy"**

## Step 4: Verify Deployment

Once deployed, your API will be available at:
```
https://your-project-name.vercel.app
```

Test the endpoints:

### Health Check
```bash
curl https://your-project-name.vercel.app/api/health
```

### Proxy Request
```bash
curl -X POST https://your-project-name.vercel.app/api/proxy/chat \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What is the capital of France?",
    "model": "gpt-4",
    "provider": "openai"
  }'
```

### Dashboard Stats
```bash
curl https://your-project-name.vercel.app/api/dashboard/stats?timeframe=24h
```

## Important Considerations for Serverless

### Cold Starts
- Vercel serverless functions have cold starts (typically 1-3 seconds)
- Keep connections alive using the connection pooling strategy implemented in the code
- MongoDB and Redis connections are reused across invocations

### Execution Time Limits
- Vercel Free tier: 10 seconds max execution time
- Vercel Pro tier: 60 seconds max execution time
- If you need longer execution times, consider upgrading or using webhooks

### Memory Limits
- Default: 1024 MB
- Can be adjusted in vercel.json if needed

### Recommended Vercel Plan
- **Hobby (Free):** Good for testing and small projects
- **Pro:** Recommended for production use with higher traffic

## Monitoring and Logs

1. **View Logs:**
   - Go to your project in Vercel Dashboard
   - Click on "Deployments"
   - Select a deployment and view the "Runtime Logs"

2. **Monitor Performance:**
   - Use Vercel Analytics (available in dashboard)
   - Monitor MongoDB Atlas metrics
   - Monitor Upstash Redis metrics

3. **Set Up Alerts:**
   - Configure alerts in MongoDB Atlas for connection issues
   - Configure alerts in Upstash for high usage

## Troubleshooting

### Issue: MongoDB Connection Timeout
**Solution:** Make sure you've whitelisted all IPs (0.0.0.0/0) in MongoDB Atlas Network Access

### Issue: Redis Connection Error
**Solution:** Verify your REDIS_URL format is correct and the database is active in Upstash

### Issue: Rate Limit Errors
**Solution:** Adjust `RATE_LIMIT_MAX_REQUESTS` and `RATE_LIMIT_WINDOW_MS` environment variables

### Issue: Function Timeout
**Solution:**
- Optimize your prompts to reduce processing time
- Consider upgrading to Vercel Pro for longer timeout limits
- Check if caching is enabled to reduce API calls

## Custom Domain (Optional)

1. Go to your project settings in Vercel
2. Click on "Domains"
3. Add your custom domain
4. Update DNS records as instructed by Vercel

## Cost Optimization Tips

1. **Enable Caching:** Set `ENABLE_CACHING=true` to reduce API calls
2. **Use Free Tiers:** MongoDB Atlas M0 and Upstash free tier are sufficient for small-medium traffic
3. **Monitor Usage:** Check Vercel dashboard regularly for function invocations
4. **Set Rate Limits:** Protect against unexpected usage spikes

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGODB_URI` | Yes | - | MongoDB connection string from Atlas |
| `REDIS_URL` | Yes | - | Redis connection URL from Upstash |
| `ANTHROPIC_API_KEY` | Yes | - | Anthropic API key for Claude models |
| `OPENAI_API_KEY` | Yes | - | OpenAI API key for GPT models |
| `GOOGLE_API_KEY` | No | - | Google API key (if using Google models) |
| `ENABLE_CACHING` | No | true | Enable/disable response caching |
| `CACHE_TTL` | No | 3600 | Cache time-to-live in seconds |
| `ENABLE_PROMPT_OPTIMIZATION` | No | true | Enable/disable prompt optimization |
| `ENABLE_SMART_ROUTING` | No | true | Enable/disable smart model routing |
| `RATE_LIMIT_WINDOW_MS` | No | 60000 | Rate limit window in milliseconds |
| `RATE_LIMIT_MAX_REQUESTS` | No | 100 | Max requests per window |
| `NODE_ENV` | No | production | Node environment |

## Next Steps

After successful deployment:

1. Test all API endpoints
2. Set up monitoring and alerts
3. Configure custom domain (optional)
4. Share your API endpoint with your team
5. Monitor costs and usage in Vercel, MongoDB Atlas, and Upstash dashboards

## Support

- **Vercel Docs:** https://vercel.com/docs
- **MongoDB Atlas Docs:** https://docs.atlas.mongodb.com/
- **Upstash Docs:** https://docs.upstash.com/

---

**Your LLM Cost Optimizer Proxy is now running on Vercel!** 🚀
