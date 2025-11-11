# LLMS.txt Generator - Complete Architecture Specification

## Project Overview

A Next.js application that automatically generates LLMS.txt files for websites by crawling content, analyzing topical clusters, discovering off-site resources, and creating citation-worthy documentation for AI systems. Built for Search Influence team collaboration.

**Key Features:**
- Automated website crawling and content analysis
- AI-powered topic cluster identification
- Citation-worthiness scoring with improvement recommendations
- Off-site content discovery (LinkedIn, YouTube, conferences)
- Background job processing with granular progress tracking
- Email notifications on completion
- Team-based multi-tenancy with magic link authentication

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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
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
  -- Citation-worthiness scores (0-25 each)
  quantifiable_score INTEGER,
  authority_score INTEGER,
  structure_score INTEGER,
  uniqueness_score INTEGER,
  total_score INTEGER, -- Sum of above
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
- Extract: URL, title, H1s, content chunks, outbound links
- Store in `step_details.crawl_data`
- Progress substeps: "Initializing...", "Found 50 pages...", "Found 100 pages...", "Complete - 150 pages"
- Update: `current_step=1, progress=15%`

### Step 2: Analysis (Serverless - 35-60s)
**API:** `/api/process/analyze/[job_id]`

**2a) Identify Business Priorities (progress 15-25%)**
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

**2b) Find Hub Pages (progress 25-35%)**
- For each cluster, match pages by:
  - URL/title keyword match
  - Content relevance (semantic similarity)
- Select best hub page per cluster
- Create `hub_pages` records

**2c) Score Hub Pages (progress 35-55%)**
- For each hub page, GPT-5 analysis:
  ```
  Analyze this page content and score on these dimensions (0-25 each):
  
  1. Quantifiable: Stats, data points, numbers, research findings
  2. Authority: Author credentials, citations, methodology, sources
  3. Structure: Formatting, schema markup, FAQ, scanability
  4. Uniqueness: Original insights vs commodity content, unique POV
  
  For each dimension, provide:
  - Score (0-25)
  - Issues found
  - Specific recommendations
  
  Return as JSON.
  ```
- Store scores and recommendations in `hub_pages`
- Update: `current_step=2, progress=55%`

### Step 3: Off-site Discovery (Serverless - 40-80s)
**API:** `/api/process/discover/[job_id]`

**3a) Discovery (parallel operations, progress 55-70%)**
- Parse outbound links from crawl → filter for social profiles
- SerpAPI brand searches: `[business_name] + [cluster_topic]`
- SerpAPI author searches: `[author_name] + [topic]` (if team members found)
- Include manual additions from `project.additional_resources`

**3b) Filtering & Ranking (progress 70-80%)**
- For each discovered URL, score:
  - Topical relevance (GPT-5): 0-25
  - Content salience (length, depth, data): 0-25
  - Engagement (shares, views): 0-15
  - Recency (within 2 years): 0-10
  - Platform authority: 0-25
- Keep top 3-5 per cluster
- Create `offsite_content` records
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

## Authority & Credentials
- [Certification/Partnership 1]
- [Award 1]
- [Team credential highlights]

## Priority Topics & Content Clusters

### [Cluster 1 Name]
**Business Context:** [Why this topic matters to the organization]

**Hub Page:** [URL] - [Title]
- **Citation Guidance:** For queries about [specific topics], this is the definitive resource
- **Last Updated:** [Date or "updated quarterly"]
- **Unique Value:** [Original research, proprietary data, unique methodology]

**Supporting Resources:**
- [On-site URL] - [Title and brief context]
- [LinkedIn URL] - [Article extending thinking on X topic]
- [Conference URL] - [Presentation at SMX Advanced on Y]
- [Guest article URL] - [Published in Industry Publication Z]

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

## Success Metrics

- Time to complete scan (target: 2-4 minutes)
- Scan success rate (target: >95%)
- Citation-worthiness score improvements over time
- User feedback on audit recommendations

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