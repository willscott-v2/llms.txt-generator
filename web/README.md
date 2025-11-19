# LLMS.txt Generator - Web Application

A Next.js application that automatically generates LLMS.txt files for websites by crawling content, analyzing topical clusters, discovering off-site resources, and creating citation-worthy documentation for AI systems.

## Project Structure

This is the web interface and API for the LLMS.txt Generator. It includes:

- **Web UI**: Next.js 16 App Router with Tailwind CSS
- **API Routes**: RESTful API for scan management
- **Processing Engine**: Background job processing with progress tracking
- **CLI Tool**: Command-line interface for local testing

## Tech Stack

- **Framework**: Next.js 16.0.3 (App Router)
- **Hosting**: Railway (persistent containers)
- **Database**: In-memory storage (Map-based for prototype)
- **APIs**:
  - Firecrawl v2 (website crawling)
  - SerpAPI (brand/author searches, social discovery)
  - OpenAI GPT-5 (content analysis)
- **Styling**: Tailwind CSS + shadcn/ui components

## Getting Started

### Prerequisites

- Node.js 18+
- API keys for Firecrawl, SerpAPI, and OpenAI

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```bash
FIRECRAWL_API_KEY=your_firecrawl_key
SERPAPI_KEY=your_serpapi_key
OPENAI_API_KEY=your_openai_key
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

### CLI Usage

Test the processor locally with the CLI:

```bash
# Basic usage
npm start -- https://example.com

# With topic hints
npm start -- https://example.com --topics "SEO,PPC,Content Marketing"

# With auto-accept (skip topic review)
npm start -- https://example.com --topics "SEO,PPC" --auto-accept
```

See [TOPIC-GUIDANCE.md](../TOPIC-GUIDANCE.md) for more CLI options.

## Key Features

### 1. Priority URLs
Guarantee specific URLs are included in the output:
- **Internal Priority URLs**: URLs from your domain that must appear as hub pages
- **External Priority URLs**: Third-party resources (articles, videos) that route to "Supporting Resources"
- Visual priority badges in output

### 2. Recent Updates Detection
Auto-detects publishing frequency and recent content:
- Analyzes publish dates to determine recency window (30/60/90/180 days)
- Categorizes as news, blog posts, or page updates
- Shows publishing frequency rating (high/medium/low/static)

### 3. External Priority Routing
Smart routing based on domain:
- Internal URLs → Topic cluster hub pages
- External URLs → Supporting Resources (Off-Site)
- Separate "Client Priority Resources" subsection

### 4. Social Profile Discovery
Discovers and validates official social media accounts:
- Scrapes social links from website (footer, headers, contact pages)
- SerpAPI searches for brand social profiles
- Validates with confidence scoring (90-100% = High, 60-89% = Medium)
- Only includes verified profiles in output

### 5. Citation-Worthiness Scoring
Scores pages 0-100 across 4 dimensions:
- **Quantifiable** (0-25): Data, stats, research
- **Authority** (0-25): Credentials, citations, methodology
- **Structure** (0-25): Formatting, schema, scannability
- **Uniqueness** (0-25): Original insights vs commodity content

## API Routes

```
POST /api/generate
  Body: { domain, topics?, priorityUrls? }
  Returns: { scanId }

GET /api/generate?scanId=xxx
  Returns: { status, progress, currentStep, result? }
```

## Processing Pipeline

1. **Crawl** (10-20%): Firecrawl extracts pages, content, social links
2. **Analyze** (40-55%): GPT-5 identifies topics, clusters content, scores pages
3. **Discover** (65-80%): SerpAPI finds off-site content, validates social profiles
4. **Generate** (85-100%): Creates LLMS.txt file and audit report

Total time: 2-5 minutes depending on site size

## File Structure

```
web/
├── app/
│   ├── page.tsx                    # Homepage
│   └── api/
│       └── generate/
│           └── route.ts            # Main API endpoint
├── lib/
│   └── processor/
│       ├── index.ts                # CLI entry point
│       ├── crawl.ts                # Firecrawl integration
│       ├── analyze.ts              # GPT-5 content analysis
│       ├── discover.ts             # Off-site content discovery
│       ├── social-discovery.ts     # Social profile validation
│       ├── generate.ts             # LLMS.txt generation
│       ├── recency-analyzer.ts     # Publishing frequency analysis
│       ├── date-extraction.ts      # Date extraction utilities
│       └── types.ts                # TypeScript interfaces
├── components/                     # React components (shadcn/ui)
└── output/                        # CLI output files
```

## Deployment

See [RAILWAY.md](RAILWAY.md) for Railway deployment instructions.

### Build for Production

```bash
npm run build
npm start
```

### Deploy to Railway

```bash
railway login
railway init
railway up
```

## Development

### Type Checking

```bash
npm run build
```

### Output Files (CLI)

When using the CLI, output files are saved to `output/`:
- `crawl-data.json` - Raw crawl results
- `analysis.json` - Topic clusters & scores
- `discovery.json` - Off-site content
- `llms.txt` - Final LLMS.txt file
- `audit-report.md` - Content audit & recommendations

## Documentation

- [TOPIC-GUIDANCE.md](../TOPIC-GUIDANCE.md) - User-guided topic definition
- [RAILWAY.md](RAILWAY.md) - Railway deployment guide
- [llms-txt-spec.md](../llms-txt-spec.md) - Complete architecture spec (future Supabase version)
- [README.md](../README.md) - Project overview

## Project Status

This is a working prototype deployed on Railway. The system processes real sites and generates production-ready LLMS.txt files.

### Completed Features

- Website crawling with Firecrawl v2
- GPT-5 topic identification and clustering
- Citation-worthiness scoring
- Off-site content discovery
- Social profile discovery and validation
- Priority URLs (internal & external)
- Recent updates detection
- LLMS.txt file generation
- Audit report generation
- CLI interface
- Web API with progress tracking
- Railway deployment

### Roadmap

See [llms-txt-spec.md](../llms-txt-spec.md) for the planned production architecture with:
- Supabase authentication and database
- Team collaboration features
- Background job queue
- Email notifications
- Admin panel
- Multi-tenant architecture

---

**Built for the Search Influence team**
