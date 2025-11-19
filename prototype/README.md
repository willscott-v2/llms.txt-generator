# LLMS.txt Generator - Prototype CLI

A command-line prototype for generating LLMS.txt files through automated website crawling, content analysis, clustering, and scoring.

## What It Does

This prototype validates the core pipeline for LLMS.txt generation:

1. **Crawls** a website using Firecrawl to extract pages, titles, headings, and content
2. **Analyzes** content using GPT-5 to identify 3-7 main topic areas and cluster pages
3. **Scores** each page on 4 dimensions (0-25 each):
   - Quantifiable: Data, statistics, research
   - Authority: Credentials, citations, methodology
   - Structure: Formatting, scannability
   - Uniqueness: Original insights vs commodity content
4. **Discovers** off-site content using SerpAPI to find supporting resources
5. **Generates** a comprehensive LLMS.txt file and audit report

## Requirements

- Node.js 18+ (20+ recommended)
- API Keys for:
  - [Firecrawl](https://www.firecrawl.dev/) - Website crawling
  - [OpenAI](https://platform.openai.com/) - GPT-5 content analysis
  - [SerpAPI](https://serpapi.com/) - Search for off-site content

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` and add your API keys:**
   ```
   FIRECRAWL_API_KEY=fc-xxxxx
   OPENAI_API_KEY=sk-xxxxx
   SERPAPI_KEY=xxxxx
   ```

## Usage

Run the CLI with a domain to analyze:

```bash
npm start -- https://searchinfluence.com
```

Or using tsx directly:

```bash
npx tsx src/index.ts https://example.com
```

### Optional: Guide Topic Identification

You can provide topic hints to guide GPT-5's content clustering:

```bash
npm start -- https://searchinfluence.com --topics "SEO,PPC,Content Marketing"
```

GPT-5 will use your hints as a foundation and expand on them. You'll be able to review and approve (or regenerate) topics before clustering begins.

**See [TOPIC-GUIDANCE.md](../TOPIC-GUIDANCE.md) for detailed usage instructions.**

### What Happens

The tool will:

1. **Crawl the website** (30-180 seconds depending on site size)
2. **Analyze content with GPT-5** (1-2 minutes)
3. **Discover off-site resources** (30-60 seconds)
4. **Generate output files** (< 5 seconds)

Total time: **2-4 minutes** for most sites

## Output Files

All results are saved to the `output/` directory:

### Primary Outputs

- **`llms.txt`** - The final LLMS.txt file ready for deployment
- **`audit-report.md`** - Content audit with scores and recommendations

### Intermediate Data (for debugging)

- **`crawl-data.json`** - Raw crawl results from Firecrawl
- **`analysis.json`** - Topic clusters, page assignments, and scores
- **`discovery.json`** - Off-site content findings

## Output Format

### llms.txt Structure

```markdown
# LLMS.txt - AI Citation Guide

## Organization Overview
[Brand description and focus areas]

## Authority & Credentials
[Certifications, awards, press mentions]

## Priority Topics & Citation-Worthy Content
### [Topic Name]
[Description and keywords]

#### Hub Pages (Citation-Worthy Content)
**[Page Title](URL)** - Score: 85/100
- Citation guidance
- Strengths: Q=22/25, A=21/25, S=23/25, U=19/25
- Key points from the page

## Supporting Resources (Off-Site)
[Third-party articles, videos, papers by topic]

## Contact & Recommended Actions
[Website, social media, citation recommendations]
```

### Audit Report Structure

- **Executive Summary**: Overall stats and score distribution
- **Top Performing Pages**: Best 10 pages by citation score
- **Content Gaps**: Missing topics or weak areas
- **Recommendations**: Action items to improve citation-worthiness

## Scoring System

Each hub page receives a **citation-worthiness score (0-100)** based on:

| Dimension       | Max | Description                                      |
|----------------|-----|--------------------------------------------------|
| Quantifiable   | 25  | Data, statistics, research findings              |
| Authority      | 25  | Credentials, citations, methodology              |
| Structure      | 25  | Formatting, headings, scannability               |
| Uniqueness     | 25  | Original insights vs generic content             |
| **Total**      | **100** | **Sum of all dimensions**                    |

**Score Interpretation:**
- **80-100**: Excellent - Highly citation-worthy
- **60-79**: Good - Suitable for citations
- **40-59**: Fair - Could be improved
- **0-39**: Poor - Not recommended for citations

## Example Output

After running on `searchinfluence.com`:

```
✅ COMPLETE!

⏱️  Total time: 142.3 seconds

📊 Results Summary:
   • Pages crawled: 47
   • Topics identified: 5
   • Hub pages found: 18
   • Off-site resources: 12
   • Authority signals: 3

🏆 Top Hub Pages:
   1. The Complete Guide to SEO in 2024 (92/100)
      SEO Strategy
   2. Content Marketing ROI Calculator (88/100)
      Content Marketing
   3. Local Search Ranking Factors Study (85/100)
      Local SEO
```

## API Costs (Estimated)

For a typical website (50-100 pages):

- **Firecrawl**: ~$0.50-2.00 (depends on pages crawled)
- **OpenAI (GPT-5)**: ~$0.10-0.30 (lower cost than GPT-4)
- **SerpAPI**: ~$0.05-0.15 (depends on searches)

**Total per run: $0.65-2.45**

## Limitations

This is a **prototype** focused on validating core algorithms. It does NOT include:

- ❌ Web UI (Next.js app)
- ❌ Database persistence
- ❌ User authentication
- ❌ Background job processing
- ❌ Email notifications
- ❌ Multi-tenant support

These features will be added in the production application.

## Troubleshooting

### Error: "FIRECRAWL_API_KEY is required"

Make sure you've created a `.env` file with all three API keys. Check that the file is in the `prototype/` directory.

### Error: Firecrawl timeout

Large sites may take longer to crawl. The current limit is 100 pages. To adjust:

Edit `src/crawl.ts` and change the `limit` parameter:
```typescript
limit: 50, // Reduce for faster testing
```

### Error: OpenAI rate limit

If you hit rate limits:
1. Wait a few seconds and try again
2. Reduce batch size in `src/analyze.ts` (line 89):
   ```typescript
   const batchSize = 5; // Reduce from 10
   ```

### Error: Model 'gpt-5' not found

GPT-5 may not be available yet. Edit `src/analyze.ts` (line 11) to use GPT-4:
```typescript
const GPT_MODEL = 'gpt-4-turbo-preview'; // Fallback to GPT-4
```

## Development

### Project Structure

```
prototype/
├── src/
│   ├── index.ts       # CLI entry point & pipeline
│   ├── crawl.ts       # Firecrawl integration
│   ├── analyze.ts     # GPT-5 analysis & scoring
│   ├── discover.ts    # SerpAPI discovery
│   ├── generate.ts    # LLMS.txt generation
│   └── types.ts       # TypeScript interfaces
├── output/            # Generated files (gitignored)
├── .env               # API keys (gitignored)
├── package.json
└── tsconfig.json
```

### Run in Dev Mode

Watch for changes and auto-reload:
```bash
npm run dev -- https://example.com
```

### Modify Prompts

All GPT-5 prompts are in `src/analyze.ts`. Search for the `prompt` variable to customize:

- Topic identification (line ~35)
- Page clustering (line ~85)
- Page scoring (line ~160)

## Next Steps

After validating the prototype:

1. **Review** the generated `llms.txt` for your test site
2. **Adjust** scoring weights and prompts as needed
3. **Test** with multiple domains to refine the algorithm
4. **Build** the full Next.js application with the validated pipeline

## License

MIT

## Questions?

Open an issue in the repository or check the main project README for more information.
