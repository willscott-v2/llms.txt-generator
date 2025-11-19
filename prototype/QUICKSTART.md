# Quick Start Guide

Get your LLMS.txt prototype running in 5 minutes!

## Step 1: Install Dependencies (30 seconds)

```bash
cd prototype
npm install
```

## Step 2: Get API Keys (5 minutes)

You'll need three API keys:

### Firecrawl (Website Crawling)
1. Go to https://www.firecrawl.dev/
2. Sign up for an account
3. Get your API key from the dashboard
4. **Free tier**: 500 pages/month

### OpenAI (GPT-5 Analysis)
1. Go to https://platform.openai.com/
2. Create an account or sign in
3. Go to API Keys section
4. Create a new key
5. **Cost**: ~$0.10-0.30 per website

### SerpAPI (Search)
1. Go to https://serpapi.com/
2. Sign up for an account
3. Get your API key
4. **Free tier**: 100 searches/month

## Step 3: Configure (30 seconds)

```bash
# Copy the template
cp .env.example .env

# Edit with your API keys
nano .env  # or use any text editor
```

Your `.env` should look like:
```
FIRECRAWL_API_KEY=fc-xxxxxxxxxxxxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxx
SERPAPI_KEY=xxxxxxxxxxxxxxxxxx
```

## Step 4: Run! (2-4 minutes)

```bash
npm start -- https://searchinfluence.com
```

**Note**: Replace `searchinfluence.com` with any domain you want to analyze.

## What to Expect

### Console Output

You'll see progress through 4 steps:

```
╔════════════════════════════════════════════════════════════╗
║          LLMS.txt Generator - Prototype CLI              ║
╚════════════════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 STEP 1: CRAWLING WEBSITE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Timestamp] ℹ️  Starting crawl of https://searchinfluence.com...
[Timestamp] ✅ Crawl completed! Found 47 pages
[Timestamp] ✅ Crawl complete! Saved to output/crawl-data.json

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 STEP 2: ANALYZING CONTENT WITH GPT-5
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Timestamp] ℹ️  Starting content analysis with GPT-5...
[Timestamp] ✅ Found 5 main topics
...
```

### Output Files

Check the `output/` folder for:

1. **llms.txt** ⭐ - Your final LLMS.txt file
2. **audit-report.md** - Content recommendations
3. **crawl-data.json** - Raw data (debug)
4. **analysis.json** - Clusters & scores (debug)
5. **discovery.json** - Off-site resources (debug)

## Troubleshooting

### GPT-5 Not Available?

If you get `model 'gpt-5' not found`, edit `src/analyze.ts` line 11:

```typescript
const GPT_MODEL = 'gpt-4-turbo-preview'; // Use GPT-4 instead
```

### Rate Limits?

Wait 30 seconds and try again, or reduce the crawl limit in `src/crawl.ts` line 24:

```typescript
limit: 25, // Crawl fewer pages for testing
```

### Other Issues?

Check the full [README.md](README.md) for detailed troubleshooting.

## Next Steps

1. **Review** your `output/llms.txt` file
2. **Check** the `output/audit-report.md` for insights
3. **Try** with different websites
4. **Adjust** prompts in `src/analyze.ts` if needed
5. **Build** the full web application when ready!

## Example Output Preview

Your `llms.txt` will look like this:

```markdown
# LLMS.txt - AI Citation Guide

## Organization Overview
[Brand description with focus areas]

## Authority & Credentials
- **Featured in Forbes and TechCrunch**
  Year: 2023
...

## Priority Topics & Citation-Worthy Content

### SEO Strategy
Top-tier content about search engine optimization...

#### Hub Pages (Citation-Worthy Content)

**The Complete Guide to SEO in 2024**
*Citation Score: 92/100*

- Best cited for data-rich content, authoritative sources, well-structured information
- **Strengths:** Quantifiable (23/25), Authority (22/25), Structure (24/25), Uniqueness (23/25)
...
```

Enjoy! 🎉
