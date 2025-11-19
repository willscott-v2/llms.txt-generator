# Railway Deployment Guide

This guide explains how to deploy the LLMS.txt Generator web application to Railway.

## Why Railway?

Railway is perfect for this application because:
- **No timeout limits** - Our generation process takes 15-20 minutes
- **Persistent containers** - In-memory storage works reliably
- **Simple deployment** - No need for additional services like Inngest or Redis
- **Cost-effective** - Only pay for what you use

## Prerequisites

1. [Railway account](https://railway.app/) (free to start)
2. Railway CLI (optional, but recommended)
3. This Next.js application ready to deploy

## Environment Variables

You'll need to set these environment variables in Railway:

```
FIRECRAWL_API_KEY=your_firecrawl_api_key
OPENAI_API_KEY=your_openai_api_key
SERPAPI_KEY=your_serpapi_key
```

## Deployment Methods

### Method 1: Deploy via Railway Dashboard (Easiest)

1. **Login to Railway**
   - Go to [railway.app](https://railway.app/)
   - Sign in with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your GitHub account if needed
   - Select your repository

3. **Configure Build Settings**
   - Railway will auto-detect Next.js
   - The `railway.json` file configures:
     - Builder: NIXPACKS
     - Start command: `npm start`
     - Restart policy: ON_FAILURE with 10 max retries

4. **Set Environment Variables**
   - Go to your project settings
   - Click "Variables" tab
   - Add each environment variable:
     - `FIRECRAWL_API_KEY`
     - `OPENAI_API_KEY`
     - `SERPAPI_KEY`

5. **Deploy**
   - Railway will automatically deploy on every push to main
   - First deployment starts immediately
   - Watch the deployment logs for any issues

6. **Get Your URL**
   - Railway provides a public URL automatically
   - Find it in the "Settings" tab under "Domains"
   - Format: `your-app-name.up.railway.app`

### Method 2: Deploy via Railway CLI

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login**
   ```bash
   railway login
   ```

3. **Initialize Project**
   ```bash
   cd web
   railway init
   ```

4. **Set Environment Variables**
   ```bash
   railway variables set FIRECRAWL_API_KEY=your_key
   railway variables set OPENAI_API_KEY=your_key
   railway variables set SERPAPI_KEY=your_key
   ```

5. **Deploy**
   ```bash
   railway up
   ```

6. **Open in Browser**
   ```bash
   railway open
   ```

## Configuration Details

### railway.json

The `railway.json` file in the root of the web directory configures:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

- **NIXPACKS**: Railway's smart builder that auto-detects Next.js
- **Start Command**: Runs production build (`next start`)
- **Restart Policy**: Automatically restarts on failures (up to 10 times)

### Build Process

Railway will automatically:
1. Install dependencies (`npm install`)
2. Build the Next.js app (`npm run build`)
3. Start the production server (`npm start`)

### In-Memory Storage

The application uses an in-memory `Map` for scan status:

```typescript
const scanStore = new Map<string, { ... }>();
```

**Important Notes:**
- Works perfectly on Railway (persistent container)
- Data persists while container is running
- Data is lost on deployment/restart (acceptable for this use case)
- For production persistence, consider adding a database

## Custom Domain (Optional)

1. Go to your Railway project
2. Click "Settings" → "Domains"
3. Click "Add Domain"
4. Follow instructions to configure DNS

## Monitoring

### View Logs

**Via Dashboard:**
- Go to your Railway project
- Click "Deployments"
- Click on a deployment to view logs

**Via CLI:**
```bash
railway logs
```

### Check Status

Logs will show:
- `[scanId] Starting crawl for domain.com`
- `[scanId] ✓ Crawled N pages`
- `[scanId] ✓ Identified N topics`
- Progress through all stages

## Costs

Railway pricing (as of 2024):
- **Hobby Plan**: $5/month for 500 hours
- **Pro Plan**: $20/month for unlimited hours
- Pay only for active usage

Typical usage for this app:
- ~20 minutes per generation
- Most time spent waiting for external APIs
- Low compute requirements

## Troubleshooting

### Build Fails

**Check Node Version:**
Ensure your `package.json` specifies Node 18+:
```json
"engines": {
  "node": ">=18.0.0"
}
```

**Missing Environment Variables:**
Double-check all three API keys are set in Railway dashboard.

### Runtime Errors

**Check Logs:**
```bash
railway logs
```

**Common Issues:**
- Invalid API keys
- API rate limits exceeded
- Network timeouts (external APIs)

### 404 Errors After Deployment

If you see 404s on scan status:
- This is normal if you're checking old scan IDs
- Submit a new generation request
- Old IDs are cleared on deployment

## Production Recommendations

For production use, consider:

1. **Add Database**
   - Railway offers PostgreSQL
   - Store scan results permanently
   - Enable scan history

2. **Add Authentication**
   - Protect the generation endpoint
   - Track usage per user
   - Implement rate limiting

3. **Add Queue System**
   - Handle multiple concurrent generations
   - Better resource management
   - Job prioritization

4. **Add Analytics**
   - Track generation success rates
   - Monitor API usage
   - Performance metrics

## Support

- Railway Docs: https://docs.railway.app/
- Railway Discord: https://discord.gg/railway
- Project Issues: [Your GitHub repo]/issues
