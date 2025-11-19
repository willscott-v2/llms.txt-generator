# LLMS.txt Generator - Complete Architecture Specification

## Project Overview

A Next.js application that automatically generates LLMS.txt files for websites by crawling content, analyzing topical clusters, discovering off-site resources, and creating citation-worthy documentation for AI systems. Built for Search Influence team collaboration.
A Next.js application that automatically generates LLMS.txt files for websites by crawling content, analyzing topical clusters, discovering off-site resources, and creating citation-worthy documentation for AI systems. Built for Search Influence team collaboration.

**Key Features:**
- Automated website crawling and content analysis
- AI-powered topic cluster identification
- Citation-worthiness scoring with improvement recommendations
- Off-site content discovery (LinkedIn, YouTube, conferences)
- Background job processing with granular progress tracking
- Email notifications on completion
- Team-based multi-tenancy with magic link authentication

## Primary Audiences

- Higher Education Marketing Teams
- Healthcare Marketing
- Hospitality Marketing
- General Marketing Leaders & Practitioners (SEO, AI SEO, PPC, Content Marketing)

## Audience → Entity / Taxonomy Alignment

The system automatically identifies and tags content with relevant Schema.org entity types and NAICS industry codes to improve discoverability and context for AI systems.

- **Higher Education Marketing Teams** → schema.org/CollegeOrUniversity (audience: Marketer) | NAICS 6113
- **Healthcare Marketing** → schema.org/Hospital | MedicalOrganization (audience: Marketer) | NAICS 62
- **Hospitality Marketing** → schema.org/Hotel | TouristAttraction (audience: Marketer) | NAICS 72

### Lookup Functions

During project setup and analysis, the system will:

1. **NAICS Code Lookup**: Based on the business description and website content, GPT-5 identifies the most relevant NAICS industry classification code(s)
2. **Schema.org Entity Type**: Identifies appropriate Schema.org entity types for the organization (e.g., CollegeOrUniversity, Hospital, Hotel, LocalBusiness)
3. **Target Audience**: Determines the primary audience segment(s) from the Primary Audiences list based on content analysis

These taxonomies are stored in the project record and included in the LLMS.txt output to provide richer context for AI citation systems.

## Content Focus Areas

The system prioritizes content related to these marketing domains:

- SEO
- AI SEO
- PPC / Paid Advertising
- Content Marketing
- Higher Education Marketing
- Healthcare Marketing
- Hospitality Marketing

Topic clusters and hub pages are evaluated for relevance to these focus areas during the analysis phase.

## Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **Hosting:** Vercel Pro
- **Database:** Supabase (PostgreSQL + Auth)
- **Email:** Resend
- **APIs:** 
  - Firecrawl (site crawling)
  - SerpAPI (brand/author searches)
  - OpenAI GPT-5 (content analysis)
- **Styling:** Tailwind CSS
- **Data Fetching:** TanStack Query (React Query)

## Database Schema

```sql
-- Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization members (links Supabase auth.users to orgs)
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  organization_id UUID REFERENCES organizations NOT NULL,
  role TEXT DEFAULT 'member', -- admin, member, viewer
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

-- Allowed email domains for auto-join
CREATE TABLE allowed_email_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations NOT NULL,
  domain TEXT NOT NULL, -- e.g. 'searchinfluence.com'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allowed individual emails
CREATE TABLE allowed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations NOT NULL,
  email TEXT NOT NULL,
  invited_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, email)
);

-- Projects (websites being analyzed)
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations NOT NULL,
  domain TEXT NOT NULL,
  business_name TEXT NOT NULL,
  additional_resources TEXT, -- Flexible text area for URLs/notes
  naics_code TEXT, -- Primary NAICS industry code (e.g., "6113", "62", "72")
  schema_org_type TEXT[], -- Array of Schema.org entity types (e.g., ["CollegeOrUniversity", "EducationalOrganization"])
  target_audience TEXT[], -- Array of target audience segments from Primary Audiences list
  business_description TEXT, -- Auto-generated or user-provided description
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Social profiles (validated social media accounts)
CREATE TABLE social_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects NOT NULL,
  platform TEXT NOT NULL, -- linkedin, twitter, facebook, youtube, instagram
  profile_url TEXT NOT NULL,
  profile_handle TEXT, -- @username or company slug
  profile_name TEXT, -- Display name
  confidence_score INTEGER, -- 0-100
  validation_signals JSONB, -- Array of validation checks passed
  discovered_from TEXT, -- footer, contact_page, header, serpapi, etc.
  verified_badge BOOLEAN DEFAULT false,
  website_match BOOLEAN DEFAULT false, -- Does profile link back to domain?
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, platform, profile_url)
);

-- Scans (each generation run)
CREATE TABLE scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, processing, complete, failed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Scan jobs (processing state)
CREATE TABLE scan_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID REFERENCES scans NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, processing, complete, failed
  current_step INTEGER DEFAULT 0, -- 0-8
  current_substep TEXT, -- e.g. "Found 127 pages..."
  progress_percentage INTEGER DEFAULT 0,
  attempt_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,
  step_details JSONB DEFAULT '{}', -- Rich progress data
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content clusters (identified topics)
CREATE TABLE content_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID REFERENCES scans NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  business_priority_score INTEGER, -- Derived from homepage/services
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hub pages (main page per cluster)
CREATE TABLE hub_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID REFERENCES content_clusters NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  content_summary TEXT,
  last_updated_date DATE, -- Extracted or detected content update date
  date_confidence TEXT, -- high, medium, low, unknown
  -- Citation-worthiness scores (0-25 each, total out of 125)
  quantifiable_score INTEGER,
  authority_score INTEGER,
  structure_score INTEGER,
  uniqueness_score INTEGER,
  recency_score INTEGER, -- New: Content freshness and currency
  total_score INTEGER, -- Sum of all 5 scores (max 125)
  recommendations JSONB, -- Array of improvement suggestions
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Off-site content (supporting resources)
CREATE TABLE offsite_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID REFERENCES content_clusters NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  platform TEXT, -- linkedin, youtube, conference, etc.
  publication_date DATE, -- Extracted publication/last modified date
  date_confidence TEXT, -- high, medium, low, unknown
  relevance_score INTEGER,
  salience_score INTEGER,
  engagement_score INTEGER,
  recency_score INTEGER,
  authority_score INTEGER,
  total_score INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LLMS.txt versions (generated files)
CREATE TABLE llms_txt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID REFERENCES scans NOT NULL,
  content TEXT NOT NULL,
  version_number INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_projects_org ON projects(organization_id);
CREATE INDEX idx_social_profiles_project ON social_profiles(project_id);
CREATE INDEX idx_scans_project ON scans(project_id);
CREATE INDEX idx_scan_jobs_status ON scan_jobs(status, next_retry_at);
CREATE INDEX idx_clusters_scan ON content_clusters(scan_id);
CREATE INDEX idx_hub_pages_cluster ON hub_pages(cluster_id);
CREATE INDEX idx_offsite_cluster ON offsite_content(cluster_id);
```

## Authentication Flow

1. User enters email on login page
2. Check if email matches `allowed_email_domains` OR exists in `allowed_emails`
3. If authorized → Send Supabase magic link
4. If not → Show "Email not authorized" error
5. On first login → Auto-create entry in `organization_members`
6. All subsequent actions scoped to user's organization

## API Routes

```
/api/auth/
  send-magic-link          POST - Validate & send magic link

/api/projects/
  GET                      List org projects
  POST                     Create project
  [id]/
    GET                    Project details
    PUT                    Update project
    DELETE                 Archive project
    scan                   POST - Trigger scan
    scans/                 GET - Scan history

/api/scans/
  [id]/
    GET                    Scan details
    status                 GET - For polling
    llms-txt               GET - Download file
    audit-report           GET - View/download report

/api/cron/
  process-scan-jobs        GET - Cron handler (every 1 min)

/api/edge/
  crawl/[job_id]           POST - Edge Function (300s timeout)

/api/process/
  analyze/[job_id]         POST - Cluster analysis
  discover/[job_id]        POST - Off-site discovery
  finalize/[job_id]        POST - Generate outputs

/api/admin/
  allowed-emails           GET/POST/DELETE - Manage allowlist
```

## Processing Workflow

### Step 0: Trigger Scan
- POST `/api/projects/[id]/scan`
- Create `scan` and `scan_job` records
- Return scan_id immediately

### Step 1: Crawl (Edge Function - 30-180s)
**API:** `/api/edge/crawl/[job_id]`
- Use Firecrawl to crawl domain
- Extract for each page:
  - URL, title, H1s, content chunks, outbound links
  - **Metadata dates**: `last-modified` header, `article:published_time`, `article:modified_time`, `datePublished`, `dateModified` from schema markup
  - Copyright dates from footer content
  - Temporal indicators in content (e.g., "Updated: January 2025")
- Store in `step_details.crawl_data` including extracted dates
- Progress substeps: "Initializing...", "Found 50 pages...", "Found 100 pages...", "Complete - 150 pages"
- Update: `current_step=1, progress=15%`

### Step 2: Analysis (Serverless - 35-60s)
**API:** `/api/process/analyze/[job_id]`

**2a) Identify Business Taxonomies (progress 15-20%)**
- Find homepage + about pages
- GPT-5 prompt:
  ```
  Analyze this organization based on their homepage and about pages.

  Content: [homepage content, about content]

  Return JSON with:
  {
    "business_description": "2-3 sentence summary of what this organization does",
    "naics_code": "Most specific NAICS code (2-6 digits)",
    "naics_description": "Brief explanation of why this NAICS code fits",
    "schema_org_types": ["PrimaryType", "SecondaryType"],
    "target_audiences": ["Audience1", "Audience2"],
    "industry_focus": ["Industry1", "Industry2"]
  }

  Available Schema.org types: Organization, LocalBusiness, CollegeOrUniversity,
  EducationalOrganization, Hospital, MedicalOrganization, Physician, Hotel,
  TouristAttraction, Restaurant, etc.

  Available audiences: Higher Education Marketing Teams, Healthcare Marketing,
  Hospitality Marketing, General Marketing Leaders & Practitioners

  Available industry focuses: SEO, AI SEO, PPC, Content Marketing, Higher Education
  Marketing, Healthcare Marketing, Hospitality Marketing
  ```
- Update `projects` table with taxonomy data

**2b) Identify Business Priorities (progress 20-30%)**
- Find homepage + services/expertise pages
- GPT-5 prompt:
  ```
  Given these pages [homepage content, services content], identify 3-7 main
  business priority topics. For each provide:
  - Topic name
  - Brief description
  - Why it matters to this business

  Return as JSON array.
  ```
- Create `content_clusters` records

**2c) Find Hub Pages (progress 30-40%)**
- For each cluster, match pages by:
  - URL/title keyword match
  - Content relevance (semantic similarity)
- Select best hub page per cluster
- Create `hub_pages` records

**2d) Score Hub Pages (progress 40-55%)**
- For each hub page, GPT-5 analysis:
  ```
  Analyze this page content and score on these dimensions (0-25 each):

  1. Quantifiable: Stats, data points, numbers, research findings
     - Check if statistics are dated (flag any older than 2 years)
     - Verify if data sources are cited with publication dates

  2. Authority: Author credentials, citations, methodology, sources
     - Evaluate freshness of cited sources
     - Check for recent industry examples (within last 2-3 years)

  3. Structure: Formatting, schema markup, FAQ, scanability
     - Look for "Last Updated" dates or freshness indicators
     - Check for outdated references in examples

  4. Uniqueness: Original insights vs commodity content, unique POV
     - Assess if examples and case studies are recent
     - Identify any outdated terminology or deprecated practices

  5. Recency: Content freshness and currency (0-25)
     - Publication/last update date (if available)
     - Currency of examples, statistics, and references
     - Relevance to current industry practices
     - Flags for outdated information that needs updating

  For each dimension, provide:
  - Score (0-25)
  - Issues found (especially date-related concerns)
  - Specific recommendations (prioritize content freshness improvements)

  Return as JSON with total_score out of 125 (5 dimensions × 25 points).
  ```
- Store scores and recommendations in `hub_pages`
- Update: `current_step=2, progress=55%`

### Step 3: Off-site Discovery (Serverless - 40-80s)
**API:** `/api/process/discover/[job_id]`

**3a) Social Profile Discovery & Validation (progress 55-65%)**

*Phase 1: Collect Potential Social Profiles*
- Parse outbound links from crawled pages for social platform URLs:
  - LinkedIn: `/company/`, `/school/`, `/in/` patterns
  - Twitter/X: `twitter.com/`, `x.com/` patterns
  - Facebook: `/pages/`, company pages
  - YouTube: `/channel/`, `/c/`, `/@` patterns
  - Instagram: business account patterns
- Extract social links from common locations:
  - Footer links (highest confidence)
  - Header/navigation social icons
  - Contact/About pages
  - Dedicated "Follow Us" sections
- SerpAPI brand query: `"[business_name]" site:linkedin.com OR site:twitter.com OR site:facebook.com OR site:youtube.com`

*Phase 2: Validate & Verify Social Profiles*
For each discovered social profile, validate using multiple signals:

**LinkedIn Company/School Pages:**
- Verify company name matches in profile title/description
- Check if domain is listed in "Website" field (strong signal)
- Compare employee count reasonableness (if university, 500+; if small business, realistic range)
- GPT-5 validation: "Does this LinkedIn profile belong to [business_name] based on: profile name, description, website URL, location, and industry?"

**Twitter/X Accounts:**
- Check if account is verified (strong signal)
- Verify account name/handle contains business name
- Check if website link in bio matches domain
- Analyze recent tweets for brand relevance (not personal account, not parody)
- GPT-5 validation: "Analyze these tweets and profile. Is this the official account for [business_name]?"

**YouTube Channels:**
- Verify channel name matches business name
- Check "About" section for website link matching domain
- Validate content is brand-related (not user-generated or fan channel)
- Check channel age and subscriber count reasonableness

**Facebook Pages:**
- Verify page name matches business name
- Check "About" section website matches domain
- Validate it's a business page (not personal profile or fan page)
- Check page category matches business type

**Instagram Accounts:**
- Verify account name/handle
- Check bio website link matches domain
- Validate it's a business/professional account
- Check content relevance

*Phase 3: Confidence Scoring*
Assign confidence level to each social profile:
- **High (90-100%)**: Website link matches + official indicators (verified badge, footer link, domain match)
- **Medium (60-89%)**: Strong name match + found on Contact/About page + GPT-5 validation passes
- **Low (30-59%)**: Name match only or weak signals
- **Reject (<30%)**: Likely incorrect (personal account, fan page, different organization)

**Only include High and Medium confidence profiles in final output**

*Phase 4: Content Discovery from Validated Profiles*
- For validated profiles, search for topical content:
  - LinkedIn: Recent posts by company page related to cluster topics
  - YouTube: Videos from channel related to topics
  - Twitter: Threads/posts with significant engagement
- SerpAPI brand searches: `[business_name] + [cluster_topic]`
- SerpAPI author searches: `[author_name] + [topic]` (if team members identified)
- Include manual additions from `project.additional_resources`
- For each discovered URL, extract publication date via:
  - SerpAPI result metadata (when available)
  - HEAD request to check `last-modified` header
  - Fetch page metadata: Open Graph tags, schema.org dates, meta tags
  - GPT-5 date extraction from URL patterns (e.g., `/blog/2024/01/...`) or visible content

**3b) Filtering & Ranking (progress 65-80%)**
- For each discovered URL, score:
  - Topical relevance (GPT-5): 0-25
  - Content salience (length, depth, data): 0-25
  - Engagement (shares, views): 0-15
  - Recency: 0-20 (increased weight, **based on extracted publication_date**)
    - Published within last 6 months: 20 points
    - Published within last year: 15 points
    - Published within last 2 years: 10 points
    - Published within last 3 years: 5 points
    - Older than 3 years or unknown date: 0 points
  - Platform authority: 0-15 (rebalanced)
- **Recency Priority**: Strongly favor content from the last 2 years
- Keep top 3-5 per cluster, ensuring at least 2 are from last 18 months when available
- Create `offsite_content` records with `publication_date` field populated
- Update: `current_step=3, progress=80%`

### Step 4: Finalization (Serverless - 25-45s)
**API:** `/api/process/finalize/[job_id]`

**4a) Extract Authority Signals (progress 80-90%)**
- Identify About/Team/Footer pages
- Regex + GPT-5 to extract:
  - Certifications, partnerships
  - Awards, recognition
  - Team credentials
  - Years in business
- Store in `step_details.authority_signals`

**4b) Generate LLMS.txt (progress 90-95%)**
- Build structured LLMS.txt file (see format below)
- Include publication/update dates for all URLs:
  - Hub pages: Use `last_updated_date` from hub_pages table
  - Off-site resources: Use `publication_date` from offsite_content table
  - On-site supporting pages: Use dates from crawl_data metadata
  - Format dates consistently as YYYY-MM-DD or "Month YYYY" for readability
- Store in `llms_txt_versions`

**4c) Generate Audit Report (progress 95-98%)**
- Compile hub page scores + recommendations
- Prioritize recommendations (high/medium/low)
- Store as JSON in scan

**4d) Complete (progress 100%)**
- Update scan: `status='complete', completed_at=NOW()`
- Send Resend email notification
- Update: `current_step=4, status='complete', progress=100%`

### Retry Logic
- Attempts 1-2: Immediate retry (cron picks up next cycle)
- Attempts 3-5: Exponential backoff (5min, 15min, 30min)
- After 5 attempts: Mark as failed, send failure email

### Cron Job (`/api/cron/process-scan-jobs`)
Runs every 1 minute:
1. Query for jobs with `status='pending'` AND (`next_retry_at IS NULL` OR `next_retry_at <= NOW()`)
2. Lock job (set `locked_at`, `locked_by`)
3. Check `current_step`, call appropriate processor API
4. Each processor updates `current_step` when done
5. Cron picks up next step on next cycle

## LLMS.txt File Format

```markdown
# [Business Name]

## Organization Overview
- Name: [business_name]
- Domain: [domain]
- Description: [2-3 sentence GPT-5 summary from homepage]
- Established: [year, if found]
- Location: [city, state if found]

## Official Social Profiles
*These profiles have been validated as official organization accounts*
- LinkedIn: [URL] ([confidence level])
- Twitter/X: [URL] ([confidence level])
- YouTube: [URL] ([confidence level])
- Facebook: [URL] ([confidence level])
- Instagram: [URL] ([confidence level])

## Classification & Taxonomy
- Schema.org Type: [Primary Schema.org type(s), e.g., "CollegeOrUniversity, EducationalOrganization"]
- NAICS Code: [NAICS code] - [Brief description]
- Target Audience: [Comma-separated list of primary audience segments]
- Content Focus: [Comma-separated list of content/industry focus areas]

## Authority & Credentials
- [Certification/Partnership 1]
- [Award 1]
- [Team credential highlights]

## Priority Topics & Content Clusters

### [Cluster 1 Name]
**Business Context:** [Why this topic matters to the organization]

**Hub Page:** [URL] - [Title]
- **Citation Guidance:** For queries about [specific topics], this is the definitive resource
- **Last Updated:** [Date or "updated quarterly" - REQUIRED for citation-worthiness]
- **Content Freshness:** [Rating: Excellent/Good/Needs Update] - [Brief assessment]
- **Unique Value:** [Original research, proprietary data, unique methodology]
- **Citation Score:** [X/125] (Quantifiable: X/25, Authority: X/25, Structure: X/25, Uniqueness: X/25, Recency: X/25)

**Supporting Resources:**
- [Recent: YYYY-MM-DD] [On-site URL] - [Title and brief context]
- [Recent: YYYY-MM-DD] [LinkedIn URL] - [Article extending thinking on X topic]
- [YYYY-MM-DD] [Conference URL] - [Presentation at SMX Advanced on Y]
- [YYYY-MM-DD] [Guest article URL] - [Published in Industry Publication Z]

*Note: Resources are listed with publication dates, prioritizing content from the last 18 months*

[Repeat for each cluster]

## Contact & Action
- Primary Contact: [Contact page URL or email]
- Services: [Services page URL]
- About: [About page URL]
```

## Frontend Pages & Components

### Pages
1. `/login` - Magic link email entry
2. `/dashboard` - Project list (org scoped)
3. `/projects/new` - New project form
4. `/projects/[id]` - Project detail + scan history
5. `/projects/[id]/scans/[scanId]` - Scan progress OR results
6. `/admin/emails` - Manage allowed emails (admins only)

### Key Components
```
components/
  auth/
    MagicLinkForm.tsx
  projects/
    ProjectList.tsx
    ProjectCard.tsx
    NewProjectForm.tsx
  scans/
    ScanProgress.tsx          # Live progress with polling
    ScanHistoryTable.tsx
    ResultsViewer.tsx         # Tabs: LLMS.txt, Audit
    AuditReport.tsx           # Hub page scores + recommendations
  admin/
    EmailAllowlist.tsx
  ui/
    Button.tsx, Input.tsx, Card.tsx, etc. (shadcn/ui)
```

### ScanProgress Component Behavior
- Polls `/api/scans/[id]/status` every 2 seconds
- Shows progress bar with percentage
- Displays current step (1-8) and substep text
- Shows retry status if applicable:
  - "⚠️ Request timed out. Retrying... (Attempt 2 of 5)"
  - "⏱️ Temporary issue. Waiting 5 minutes... Next attempt at 2:47 PM"
- User can navigate away, progress persists
- Redirect to results when `status='complete'`

### Polling Implementation
```typescript
// Use TanStack Query with refetchInterval
const { data: status } = useQuery({
  queryKey: ['scan-status', scanId],
  queryFn: () => fetch(`/api/scans/${scanId}/status`).then(r => r.json()),
  refetchInterval: (data) => {
    // Stop polling when complete/failed
    return data?.status === 'complete' || data?.status === 'failed' 
      ? false 
      : 2000
  }
})
```

## Environment Variables

```bash
# Database
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# APIs
FIRECRAWL_API_KEY=
SERPAPI_KEY=
OPENAI_API_KEY=           # For GPT-5

# Email
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@searchinfluence.com

# App
NEXT_PUBLIC_APP_URL=https://llms-txt-generator.vercel.app
CRON_SECRET=random-secret-here  # Protect cron endpoint
```

## Implementation Priorities

### Phase 1: Core Infrastructure
1. Next.js app scaffold with App Router
2. Supabase setup + schema deployment
3. Auth flow with magic links
4. Basic UI shell (dashboard, project list)

### Phase 2: Project Management
1. New project form (domain + business name + additional resources)
2. Project CRUD operations
3. Scan trigger endpoint
4. Scan list view

### Phase 3: Processing Engine
1. Cron job handler
2. Edge Function for crawling (Firecrawl integration)
3. Analysis processor (GPT-5 integration)
4. Discovery processor (SerpAPI integration)
5. Finalization processor (LLMS.txt generation)
6. Retry logic implementation

### Phase 4: Progress & Results
1. Scan status polling
2. Progress UI with granular updates
3. LLMS.txt viewer/download
4. Audit report display
5. Email notifications (Resend)

### Phase 5: Polish
1. Admin email management
2. Error handling & user feedback
3. Loading states & animations
4. Mobile responsiveness
5. SEO & meta tags

## Key Technical Decisions

1. **Why Edge Functions for crawling?** 300s timeout on Vercel Pro allows most crawls to complete in single invocation
2. **Why DIY queue vs Inngest?** Validate product-market fit before $75/month recurring cost
3. **Why GPT-5?** Cheapest option ($1.25/1M input) with strong analytical performance
4. **Why TanStack Query?** Built-in polling, caching, and optimistic updates
5. **Why magic links?** Frictionless auth, email-based access control

## Security Considerations

1. Protect cron endpoint with `CRON_SECRET` header check
2. All API routes check Supabase auth + organization membership
3. Use Supabase RLS policies for data access control
4. Validate all user inputs (domain URLs, email addresses)
5. Rate limit magic link sends (prevent spam)

## Social Profile Validation Strategy

### Why Social Validation Matters
Incorrect social profiles damage credibility and can lead to citing competitor content or unrelated accounts. Proper validation ensures AI systems reference the correct official channels.

### Common Social Discovery Errors to Avoid
1. **Personal employee accounts** mistaken for company accounts
2. **Fan pages or parody accounts** confused with official pages
3. **Competitor profiles** with similar names
4. **Inactive or abandoned accounts** that are no longer maintained
5. **Local branches** of national organizations (when searching for HQ)
6. **Alumni/student groups** mistaken for university official accounts

### Multi-Signal Validation Approach

**Primary Validation Signals (High Confidence):**
- Website link in profile matches exact domain (not just similar domain)
- Profile linked from footer of official website
- Profile linked from official Contact or About page
- Verified badge/checkmark on platform
- Profile name exactly matches business name
- Recent activity (posted within last 90 days)

**Secondary Validation Signals (Medium Confidence):**
- Profile name contains business name (not exact match)
- Profile found via SerpAPI brand search
- Description/bio mentions correct location or services
- Follower/subscriber count is reasonable for organization size
- Content themes align with business focus areas

**Red Flags (Reject or Low Confidence):**
- Website link to different domain or no link
- Profile name significantly different from business name
- No recent activity (>180 days since last post)
- Very low follower/subscriber count for established business
- Personal account indicators (first-person language, personal photos)
- Parody/satire indicators in bio
- GPT-5 validation fails

### Platform-Specific Validation Rules

**LinkedIn:**
- Company pages preferred over personal profiles
- School pages for educational institutions (not alumni groups)
- Website field must match domain for high confidence
- Industry field should align with NAICS code

**Twitter/X:**
- Verified badge is strong signal (if present)
- Handle should be related to business name
- Bio link must match domain
- Check pinned tweet for brand relevance

**YouTube:**
- "About" section website must match
- Channel name should match business name
- Validate content is official (not user reviews, compilations, or tutorials about the company)
- Check for "Official Artist Channel" or verification badges

**Facebook:**
- Business/Brand page (not personal profile or community group)
- "About" section website must match
- Page category should align with business type
- Check "Page Transparency" section for official indicators

**Instagram:**
- Business or Creator account type
- Bio link must match domain
- Blue checkmark for verified accounts
- Professional account indicators

### Storage and Usage
- Store validated profiles in `social_profiles` table
- Include confidence_score (0-100) and validation_signals JSON
- Only include profiles with confidence_score ≥ 60 in LLMS.txt output
- List profiles in LLMS.txt with confidence level: "High Confidence" or "Medium Confidence"
- Use validated profiles as sources for content discovery in Step 3b

## Content Freshness & Recency Strategy

### Why Recency Matters
AI citation systems increasingly prioritize current, up-to-date information. Outdated content reduces citation-worthiness even if otherwise high-quality.

### Date Extraction Strategy

The system extracts publication and update dates from multiple sources to ensure accurate recency scoring:

**For On-Site Content (during crawl):**
1. HTTP `last-modified` header
2. HTML meta tags: `article:published_time`, `article:modified_time`
3. Schema.org markup: `datePublished`, `dateModified`
4. Visible "Last Updated" or "Published" labels in content
5. Copyright dates from footer
6. URL patterns (e.g., `/blog/2024/01/post-title`)

**For Off-Site Content (during discovery):**
1. SerpAPI result metadata (publication dates when available)
2. HTTP HEAD request for `last-modified` header
3. Platform-specific APIs (LinkedIn, YouTube) when available
4. Open Graph tags: `article:published_time`, `og:updated_time`
5. Schema.org markup from fetched pages
6. GPT-5 extraction from page content and URL structure

**Date Confidence Levels:**
- **High**: Schema.org markup, meta tags, platform APIs
- **Medium**: HTTP headers, visible labels, URL patterns
- **Low**: GPT-5 inference from content
- **Unknown**: No date found (penalized in recency scoring)

**Fallback Handling:**
- If no date found, mark as "Unknown" and assign 0 recency points
- Flag for manual review in audit report
- Deprioritize in LLMS.txt ordering (recent content listed first)

### Recency Scoring Approach

**Hub Pages (5th scoring dimension - 0-25 points):**
- Content published/updated within last 6 months: 20-25 points
- Content published/updated within last year: 15-20 points
- Content published/updated within last 2 years: 10-15 points
- Content older than 2 years: 0-10 points (requires update recommendations)

**Off-Site Resources (0-20 points, 20% of total weight):**
- Prioritize content from last 18 months
- Flag anything older than 3 years unless historically significant
- Ensure at least 60% of supporting resources are from last 2 years

### Freshness Indicators Extracted
- "Last Updated" dates from page metadata
- Publication dates from article schema
- Copyright dates and temporal references in content
- Examples/statistics with explicit years mentioned
- Tool/platform version numbers mentioned

### Recommendations Generated
- Flag statistics older than 2 years for refresh
- Identify outdated examples (e.g., "In 2019..." when it's now 2025)
- Suggest adding "Last Updated" dates to evergreen content
- Recommend quarterly review schedules for high-priority hubs
- Flag deprecated technologies or discontinued services

## Success Metrics

- Time to complete scan (target: 2-4 minutes)
- Scan success rate (target: >95%)
- Citation-worthiness score improvements over time
- User feedback on audit recommendations
- Average recency score across hub pages (target: >15/25)
- Percentage of supporting resources from last 18 months (target: >60%)

---

## Getting Started

1. Create new Next.js app: `npx create-next-app@latest llms-txt-generator --typescript --tailwind --app`
2. Install core dependencies
3. Set up Supabase project + run schema
4. Create seed data (Search Influence org + allowed domain)
5. Build auth flow
6. Scaffold API routes
7. Implement processing chunks
8. Build UI components

**Ready to build!**