# LLMS.txt Generator

> Automatically generate citation-worthy LLMS.txt files for websites using AI-powered content analysis

A Next.js application that crawls websites, identifies topical clusters, evaluates citation-worthiness, and generates structured LLMS.txt files optimized for AI systems. Built for teams that want to make their content more discoverable and useful for Large Language Models.

## What is LLMS.txt?

LLMS.txt is a structured documentation format that helps AI systems understand and cite your content accurately. This tool automates the creation of these files by:

- Crawling your website to understand content structure
- Identifying key topic clusters aligned with business priorities
- Scoring pages on citation-worthiness dimensions
- Discovering relevant off-site content (LinkedIn, YouTube, conferences)
- Generating comprehensive audit reports with improvement recommendations

## Key Features

### Core Functionality
- **Automated Website Crawling** - Uses Firecrawl v2 to analyze site structure and extract content
- **AI-Powered Topic Analysis** - GPT-5 identifies business priority topics and content clusters
- **User-Guided Topics** - Optional topic hints to guide clustering (see [TOPIC-GUIDANCE.md](TOPIC-GUIDANCE.md))
- **Citation-Worthiness Scoring** - Evaluates pages across 4 dimensions:
  - Quantifiable (data, stats, research)
  - Authority (credentials, citations, methodology)
  - Structure (formatting, schema markup, scannability)
  - Uniqueness (original insights vs commodity content)
- **Off-Site Content Discovery** - Finds relevant LinkedIn posts, YouTube videos, conference talks via SerpAPI
- **Social Profile Discovery & Validation** - Automatically discovers and validates official social media accounts with confidence scoring

### Advanced Features (New in Prototype)
- **Priority URLs** - Guarantee specific URLs are included in output
  - Internal priority URLs → Hub pages with priority badges
  - External priority URLs → Supporting Resources section
- **Recent Updates Detection** - Auto-analyzes publishing frequency and recent content
  - Smart recency window detection (30/60/90/180 days)
  - Categorizes as news, blog posts, or page updates
  - Publishing frequency rating (high/medium/low/static)
- **Domain-Aware Routing** - Intelligently routes internal vs external priority content to appropriate sections

### Infrastructure
- **Background Job Processing** - Long-running scans with granular progress tracking
- **Railway Deployment** - No timeout limits, persistent containers
- **Web API & CLI** - Both web interface and command-line tool available
- **Audit Reports** - Detailed recommendations for improving content citation-worthiness

## Tech Stack

### Current Prototype (Railway Deployment)
- **Framework:** Next.js 16.0.3 (App Router)
- **Hosting:** Railway (persistent containers)
- **Database:** In-memory storage (Map-based)
- **APIs:**
  - Firecrawl v2 (website crawling)
  - SerpAPI (brand/author searches, social discovery)
  - OpenAI GPT-5 (content analysis)
- **Styling:** Tailwind CSS + shadcn/ui

### Planned Production Stack (Future)
- **Framework:** Next.js 14+ (App Router)
- **Hosting:** Vercel Pro
- **Database:** Supabase (PostgreSQL + Auth)
- **Email:** Resend
- **Data Fetching:** TanStack Query (React Query)
- **Background Jobs:** DIY queue system with cron

## How It Works

### 1. Submit a Website
Enter your domain, business name, and any additional resources (team LinkedIn profiles, YouTube channels, etc.)

### 2. Automated Analysis (2-4 minutes)
The system:
- Crawls your entire site
- Identifies business priority topics
- Finds the best hub page for each topic
- Scores each page on citation-worthiness
- Discovers supporting off-site content
- Extracts authority signals (certifications, awards, credentials)

### 3. Get Results
- **LLMS.txt file** - Ready to deploy at `/llms.txt` on your domain
- **Audit report** - Detailed scores and recommendations for each hub page
- **Email notification** - When processing completes

## Processing Workflow

1. **Crawl** (30-180s) - Firecrawl extracts all pages, titles, content
2. **Analyze** (35-60s)
   - Identify business priority topics from homepage/services
   - Match pages to topic clusters
   - Score hub pages on citation-worthiness
3. **Discover** (40-80s)
   - Search for off-site content (LinkedIn, YouTube, etc.)
   - Rank by relevance, salience, engagement, recency, authority
4. **Finalize** (25-45s)
   - Extract authority signals
   - Generate LLMS.txt file
   - Compile audit report with recommendations
   - Send email notification

## Citation-Worthiness Scoring

Each hub page is scored 0-100 across four dimensions:

### Quantifiable (0-25)
Does the content include:
- Statistics and data points
- Research findings
- Quantified results
- Measurable outcomes

### Authority (0-25)
Does the content demonstrate:
- Author credentials
- Citations to reputable sources
- Clear methodology
- Expert knowledge

### Structure (0-25)
Does the page have:
- Clear formatting and headings
- Schema markup
- FAQs or structured data
- Good scannability

### Uniqueness (0-25)
Does the content offer:
- Original research or insights
- Unique perspective or POV
- Proprietary data or methodology
- Beyond commodity content

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase account
- Vercel Pro account (for Edge Function timeouts)
- API keys:
  - Firecrawl
  - SerpAPI
  - OpenAI
  - Resend

### Installation

1. Clone the repository:
```bash
git clone https://github.com/willscott-v2/llms.txt-generator.git
cd llms.txt-generator
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:
```bash
# Database
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# APIs
FIRECRAWL_API_KEY=your-firecrawl-key
SERPAPI_KEY=your-serpapi-key
OPENAI_API_KEY=your-openai-key

# Email
RESEND_API_KEY=your-resend-key
RESEND_FROM_EMAIL=noreply@yourdomain.com

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=random-secret-here
```

4. Set up Supabase:
   - Run the schema from [llms-txt-spec.md](llms-txt-spec.md#database-schema)
   - Configure authentication settings
   - Set up Row Level Security policies

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

### Deployment

1. Deploy to Vercel:
```bash
vercel --prod
```

2. Set up cron job:
   - Add Vercel cron configuration for `/api/cron/process-scan-jobs`
   - Schedule: Every 1 minute
   - Include `CRON_SECRET` header

3. Configure Supabase auth redirect URLs:
   - Add production URL to allowed redirect URLs

## Architecture

### Authentication Flow
- Magic link authentication via Supabase
- Email domain-based or allowlist-based access control
- Auto-join to organization on first login
- All data scoped to user's organization

### Database Schema
Core tables:
- `organizations` - Team accounts
- `organization_members` - User-to-org relationships
- `projects` - Websites being analyzed
- `scans` - Analysis runs
- `scan_jobs` - Background job processing state
- `content_clusters` - Identified topic clusters
- `hub_pages` - Main page per cluster with scores
- `offsite_content` - Supporting resources
- `llms_txt_versions` - Generated files

See [llms-txt-spec.md](llms-txt-spec.md) for complete schema.

### API Routes
- `/api/auth/*` - Authentication endpoints
- `/api/projects/*` - Project CRUD
- `/api/scans/*` - Scan status and results
- `/api/cron/*` - Background job processor
- `/api/edge/*` - Edge Functions (long timeouts)
- `/api/process/*` - Analysis processors
- `/api/admin/*` - Admin functions

### Background Processing
Uses a DIY queue system with:
- Cron-based job polling (every 1 minute)
- Multi-step processing with progress tracking
- Exponential backoff retry logic
- Job locking to prevent double-processing

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Project Status

**Current Status:** Working prototype deployed on Railway

The system is fully functional and generating production-ready LLMS.txt files. The prototype includes:

✅ **Completed Features:**
- Website crawling with Firecrawl v2
- GPT-5 topic identification and clustering
- User-guided topic definition with interactive review
- Citation-worthiness scoring (4 dimensions)
- Off-site content discovery via SerpAPI
- Social profile discovery and validation
- Priority URLs (internal & external routing)
- Recent updates detection and analysis
- Publishing frequency calculation
- LLMS.txt file generation
- Audit report generation
- CLI tool with progress tracking
- Web API with real-time progress
- Railway deployment with rate limiting

### Implementation Roadmap

**Phase 1: Prototype** ✅ Complete
- [x] Core crawling, analysis, and generation pipeline
- [x] CLI tool
- [x] Web API
- [x] Railway deployment

**Phase 2: Production Features** (Planned - See [llms-txt-spec.md](llms-txt-spec.md))
- [ ] Supabase authentication and database
- [ ] Team collaboration and multi-tenancy
- [ ] Background job queue with cron
- [ ] Email notifications via Resend
- [ ] Project management UI
- [ ] Scan history and versioning
- [ ] Admin panel
- [ ] Mobile-responsive design

**Phase 3: Advanced Features** (Future)
- [ ] Manual topic editing and refinement
- [ ] Custom scoring weights
- [ ] Content gap analysis
- [ ] Competitive benchmarking
- [ ] API for third-party integrations
- [ ] Scheduled rescans

## Support

For issues, questions, or feature requests, please [open an issue](https://github.com/willscott-v2/llms.txt-generator/issues).

## Acknowledgments

- Built for the [Search Influence](https://searchinfluence.com) team
- Inspired by the need for better AI content discoverability
- Powered by GPT-5, Firecrawl, and Supabase

---

**Made with by the Search Influence team**
