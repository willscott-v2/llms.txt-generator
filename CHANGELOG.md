# Changelog

All notable changes to the LLMS.txt Generator project are documented here.

## [Prototype v0.3.0] - 2025-01-19

### Added - External Priority URL Routing

**What:** External priority URLs now route to the correct section in LLMS.txt output

**Implementation:**
- Added domain-aware routing logic in `analyze.ts:scoreHubPages()`
- New helper function `isUrlFromDomain()` to check URL domain matching
- Added `externalPriorityContent` field to `AnalysisResult` type
- Modified `generate.ts` to separate "Client Priority Resources" and "Auto-Discovered Content" subsections
- External URLs get perfect scores (100/100) and marked with `isPriority: true`

**Files Changed:**
- `lib/processor/types.ts` - Added `externalPriorityContent` to `AnalysisResult`, `isPriority` to `OffsiteContent`
- `lib/processor/analyze.ts` - Domain checking, routing logic, external priority handling
- `lib/processor/generate.ts` - Separate subsections for priority vs discovered resources
- `app/api/generate/route.ts` - Merge external priority content with discovered offsite content
- `lib/processor/index.ts` - Pass `targetDomain` parameter to `analyzeContent()`

**User Benefit:**
- External priority URLs (LinkedIn articles, YouTube videos, etc.) now appear in "Supporting Resources (Off-Site)" section
- Clear separation between client-specified resources and auto-discovered content
- Internal priority URLs still appear as hub pages in topic clusters

**Example:**
```bash
# Internal URL → Hub page with priority badge
# External URL → Supporting Resources > Client Priority Resources
npm start -- https://example.com --priority-urls "https://example.com/service,https://linkedin.com/article"
```

---

## [Prototype v0.2.0] - 2025-01-18

### Added - Recent Updates Detection & Priority URLs

**Priority URLs Feature:**

**What:** Guarantee specific URLs are included in LLMS.txt output regardless of citation-worthiness score

**Implementation:**
- Added `--priority-urls` CLI argument and web API parameter
- New function `ensurePriorityUrlsCrawled()` in `crawl.ts` to guarantee priority URLs are fetched
- Modified `scoreHubPages()` in `analyze.ts` to mark priority URLs with `isPriority: true`
- Priority URLs bypass normal filtering and get visual ⭐ badges in output
- If not already crawled, priority URLs are scraped individually via Firecrawl

**Files Changed:**
- `lib/processor/types.ts` - Added `isPriority` field to `HubPage`
- `lib/processor/crawl.ts` - Added `ensurePriorityUrlsCrawled()` function
- `lib/processor/analyze.ts` - Accept `priorityUrls` parameter, guarantee inclusion
- `lib/processor/generate.ts` - Display priority badges in output
- `app/api/generate/route.ts` - Accept `priorityUrls` from API
- `lib/processor/index.ts` - Parse `--priority-urls` CLI argument

**User Benefit:**
- Critical pages are always included even if they score poorly
- Useful for ensuring key service pages, important case studies, or foundational content appears
- Visual indicator shows which content was client-specified vs auto-discovered

**Example:**
```bash
npm start -- https://example.com --priority-urls "https://example.com/services,https://example.com/about"
```

---

**Recent Updates Detection:**

**What:** Automatically detect publishing frequency and highlight recent content

**Implementation:**
- New `date-extraction.ts` utility with functions:
  - `extractDateFromUrl()` - Parse dates from URL patterns like `/2024/11/19/`
  - `extractDateFromContent()` - Extract dates from markdown content
  - `extractPageDate()` - Main orchestration function
- New `recency-analyzer.ts` with functions:
  - `analyzePublishingFrequency()` - Calculate posts per month, determine recency window
  - `findRecentContent()` - Filter and categorize recent pages (news/blog/page)
  - `analyzeRecency()` - Main analysis function
- Added `RecencyAnalysis` type to `types.ts`
- Modified `generate.ts` to include "Recent Updates" section in LLMS.txt

**Files Changed:**
- `lib/processor/date-extraction.ts` - NEW: Date parsing utilities
- `lib/processor/recency-analyzer.ts` - NEW: Publishing frequency analysis
- `lib/processor/types.ts` - Added `RecentContent`, `RecencyAnalysis` types
- `lib/processor/generate.ts` - Include recency analysis in LLMS.txt output
- `app/api/generate/route.ts` - Call `analyzeRecency()` before generation

**User Benefit:**
- AI systems can see content freshness and publishing cadence
- Recent content is highlighted (30/60/90/180 day windows based on site)
- Categorized by content type (news, blog posts, page updates)
- Publishing frequency rating (high/medium/low/static)

**Example Output:**
```markdown
## Recent Updates

**Publishing Frequency:** Medium (2.5 posts/month)
**Recency Window:** Last 60 days

### Recent News
- [2025-01-15] New partnership announcement
- [2025-01-08] Q4 2024 results

### Recent Blog Posts
- [2025-01-12] SEO trends for 2025
- [2024-12-20] Content marketing guide
```

---

### Fixed - Firecrawl v2 API Compatibility

**What:** Updated code to work with Firecrawl v2 API changes

**Changes:**
- Changed `scrapeUrl()` to `scrape()` method name
- Removed `.success` check from Firecrawl response (v2 returns direct response object)
- Updated import paths to remove `.js` extensions for TypeScript compatibility

**Files Changed:**
- `lib/processor/crawl.ts` - Updated Firecrawl method calls
- `lib/processor/recency-analyzer.ts` - Fixed import extensions

**Reason:** Firecrawl v2 changed API structure and method names

---

## [Prototype v0.1.0] - 2025-01-17

### Added - User-Guided Topic Definition

**What:** Allow users to provide topic hints to guide GPT-5 clustering

**Implementation:**
- Added `--topics` CLI argument (comma-separated topic list)
- Modified `identifyTopics()` in `analyze.ts` to accept `userTopics` parameter
- GPT-5 uses topic hints as foundation and expands/refines them
- Added interactive topic review with Accept/Regenerate/Quit options
- Created `TOPIC-GUIDANCE.md` documentation

**Files Changed:**
- `lib/processor/index.ts` - Parse `--topics` CLI argument, add interactive review
- `lib/processor/analyze.ts` - Accept and use `userTopics` in GPT-5 prompt
- `TOPIC-GUIDANCE.md` - NEW: Comprehensive usage guide

**User Benefit:**
- Better control over topic identification
- Topics align with business priorities
- Can regenerate until satisfied with results
- Still allows GPT-5 to discover topics you didn't think of

**Example:**
```bash
npm start -- https://searchinfluence.com --topics "SEO,PPC,Content Marketing"
```

**Added:** `--auto-accept` flag to skip interactive review

---

### Added - Social Profile Discovery & Validation

**What:** Discover and validate official social media accounts

**Implementation:**
- New `social-discovery.ts` module with:
  - `discoverSocialProfiles()` - SerpAPI brand searches for social profiles
  - `mergeSocialProfiles()` - Deduplicate HTML-scraped + SerpAPI-discovered profiles
  - Platform-specific patterns for LinkedIn, Twitter, Facebook, YouTube, Instagram
- Modified `crawl.ts` to extract social links from crawled HTML
- Confidence scoring (90-100% = High, 60-89% = Medium, <60% = Rejected)
- Only includes High and Medium confidence profiles in output

**Files Changed:**
- `lib/processor/social-discovery.ts` - NEW: Social profile discovery and validation
- `lib/processor/types.ts` - Added `SocialProfile` type
- `lib/processor/crawl.ts` - Extract social links from pages
- `lib/processor/generate.ts` - Display validated social profiles in LLMS.txt

**Validation Signals:**
- Website link matches domain (strong signal)
- Found in footer/header/contact page (strong signal)
- Verified badge on platform
- Profile name matches business name
- Recent activity (within 90 days)

**User Benefit:**
- Avoid incorrect social profiles (competitors, fan pages, personal accounts)
- Confidence levels give transparency
- Validated profiles used as sources for content discovery

---

### Added - Base Prototype Architecture

**What:** Core LLMS.txt generation pipeline

**Implementation:**
- Firecrawl integration for website crawling
- GPT-5 integration for content analysis
- SerpAPI integration for off-site content discovery
- Citation-worthiness scoring (4 dimensions: quantifiable, authority, structure, uniqueness)
- Hub page identification
- LLMS.txt file generation
- Audit report generation
- CLI tool
- Web API with progress tracking
- In-memory storage with Map-based scan tracking

**Files:**
- `lib/processor/crawl.ts` - Firecrawl website crawling
- `lib/processor/analyze.ts` - GPT-5 topic identification and scoring
- `lib/processor/discover.ts` - SerpAPI off-site content discovery
- `lib/processor/generate.ts` - LLMS.txt and audit report generation
- `lib/processor/index.ts` - CLI entry point
- `lib/processor/types.ts` - TypeScript interfaces
- `app/api/generate/route.ts` - Web API endpoint
- `app/page.tsx` - Web UI

**User Benefit:**
- End-to-end LLMS.txt generation
- Both CLI and web interface
- Real-time progress tracking
- Comprehensive audit reports

---

### Added - Railway Deployment

**What:** Deploy to Railway for persistent containers and no timeout limits

**Implementation:**
- Created `railway.json` with NIXPACKS builder config
- In-memory scan storage (works on Railway, not serverless)
- Rate limiting (max 3 concurrent scans)
- Admin endpoints for clearing stuck scans
- Created `RAILWAY.md` deployment guide

**Files:**
- `railway.json` - NEW: Railway configuration
- `web/RAILWAY.md` - NEW: Deployment documentation
- `app/api/generate/route.ts` - In-memory storage, rate limiting

**User Benefit:**
- No 5-minute timeout limits (can process large sites)
- Persistent containers maintain scan state
- Simple deployment process

---

## Development Notes

### API Keys Required
- `FIRECRAWL_API_KEY` - Website crawling
- `OPENAI_API_KEY` - GPT-5 content analysis
- `SERPAPI_KEY` - Brand searches and social discovery

### Key Technical Decisions
- **Railway over Vercel:** Need persistent containers for long-running jobs (no 5-min timeout)
- **In-memory storage:** Simpler than database for prototype, acceptable for MVP
- **GPT-5 over GPT-4:** Cheaper ($1.25/1M input tokens) with strong analytical performance
- **Firecrawl v2:** Best-in-class crawling with JavaScript rendering and structured extraction

### Future Production Architecture
See [llms-txt-spec.md](llms-txt-spec.md) for planned features:
- Supabase authentication and PostgreSQL database
- Team collaboration and multi-tenancy
- Background job queue with cron
- Email notifications via Resend
- Project management UI
- Scan history and versioning

---

## Version History

- **v0.3.0** (2025-01-19): External priority URL routing
- **v0.2.0** (2025-01-18): Priority URLs + Recent updates detection
- **v0.1.0** (2025-01-17): User-guided topics, social discovery, base prototype
- **v0.0.1** (2025-01-15): Initial prototype scaffold

---

**Maintained by the Search Influence team**
