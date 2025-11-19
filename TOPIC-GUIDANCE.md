# User-Guided Topic Definition

The LLMS.txt Generator now supports optional user-provided topic hints to guide the content clustering process.

## Overview

Instead of relying entirely on GPT-5 to infer topics from crawled pages, you can now:
1. Provide topic hints as command-line arguments
2. GPT-5 uses your hints as a foundation and expands/refines them
3. Review and approve suggested topics before clustering begins
4. Regenerate topics if needed

## Usage

### Basic Usage (No Topic Hints)

```bash
npm start -- https://example.com
```

GPT-5 will analyze the crawled pages and infer 3-7 topics automatically (existing behavior).

### With Topic Hints

```bash
npm start -- https://example.com --topics "SEO,PPC,Content Marketing"
```

GPT-5 will:
- Use your suggested topics as a foundation
- Expand on them with more specific sub-topics if needed
- Refine or clarify the names
- Add any major topics you may have missed
- Ensure 3-7 distinct topics total

## Interactive Topic Review

After GPT-5 suggests topics, you'll see an interactive prompt:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 TOPIC REVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GPT-5 has identified 5 topics:

1. SEO Services
   Description: Comprehensive search engine optimization...
   Keywords: seo, optimization, rankings

2. Paid Media & PPC
   Description: Pay-per-click advertising campaigns...
   Keywords: ppc, ads, campaigns

...

Review these topics:
  [A]ccept and continue  [R]egenerate  [Q]uit

Your choice:
```

### Options

- **A** (Accept): Proceed with clustering using these topics
- **R** (Regenerate): Ask GPT-5 to suggest new topics
- **Q** (Quit): Exit the program

## Examples

### Example 1: Digital Marketing Agency

```bash
npm start -- https://searchinfluence.com --topics "SEO,PPC,Content Marketing,Analytics"
```

GPT-5 might expand this to:
1. SEO Services
2. Paid Media & PPC
3. Content Marketing Strategy
4. Analytics & ROI Tracking
5. Industries & Case Studies (discovered from pages)

### Example 2: SaaS Product

```bash
npm start -- https://example-saas.com --topics "Features,Pricing,Integrations,Documentation"
```

GPT-5 might refine this to:
1. Product Features
2. Pricing & Plans
3. Third-Party Integrations
4. Developer Documentation
5. Security & Compliance (discovered from pages)

### Example 3: E-commerce Site

```bash
npm start -- https://shop.example.com --topics "Products,Shipping,Returns"
```

GPT-5 might expand to:
1. Product Catalog
2. Shipping & Fulfillment
3. Returns & Refunds
4. Customer Support
5. About Us & Company Info (discovered from pages)

## Benefits

### 1. Better Control
You know your business priorities better than GPT-5. Providing hints ensures important topics aren't overlooked.

### 2. Consistency
Topics align with your existing content strategy, site structure, or SEO goals.

### 3. Flexibility
GPT-5 can still discover topics you didn't think of while respecting your guidance.

### 4. Validation
Interactive review lets you approve or regenerate topics before expensive clustering operations.

## Technical Details

### How It Works

1. **Crawling**: All pages are crawled (unchanged)
2. **Topic Identification**:
   - First 50 pages analyzed by GPT-5
   - User hints included in the prompt if provided
   - GPT-5 suggests 3-7 topics
3. **Interactive Review**: User approves or regenerates
4. **Clustering**: All 100 pages assigned to approved topics
5. **Scoring & Generation**: Hub pages scored, LLMS.txt generated

### Code Changes

- `src/index.ts`: Added `--topics` CLI argument parsing and interactive review
- `src/analyze.ts`: Modified `identifyTopics()` and `analyzeContent()` to accept optional user topics
- Backward compatible: works without user topics (original behavior)

## Best Practices

### Do Provide Topic Hints When:
- You have a clear content strategy
- Your site has distinct service/product categories
- You want to ensure specific topics are represented
- Your business priorities differ from what GPT might infer

### Don't Provide Topic Hints When:
- Exploring what GPT discovers on its own
- Your site has diverse, hard-to-categorize content
- You want unbiased topic identification
- Testing the tool for the first time

### Tips for Good Topic Hints
- Be concise (2-4 words per topic)
- Focus on business priorities, not page types
- Provide 3-5 hints (GPT will expand to 3-7 total)
- Use terminology that matches your industry
- Don't worry about being perfect - GPT will refine them

## Troubleshooting

### Topics seem too broad
Provide more specific hints:
```bash
# Instead of:
--topics "Marketing"

# Try:
--topics "SEO Services,PPC Advertising,Content Marketing,Email Campaigns"
```

### Topics don't match my site structure
Review and regenerate until you get topics that align with your goals. You can regenerate as many times as needed.

### I want to accept topics without interactive prompt
Use the `--auto-accept` flag:

```bash
npm start -- https://example.com --topics "SEO,PPC" --auto-accept
```

This will display the topics for reference but automatically accept them without prompting.

## Additional CLI Features

### Priority URLs

You can specify URLs that must be included in the output, regardless of their citation-worthiness score:

```bash
npm start -- https://example.com --topics "SEO,PPC" --priority-urls "https://example.com/important-page,https://example.com/key-service"
```

**Priority URL Routing:**
- **Internal URLs** (from your domain): Added to topic cluster hub pages with ⭐ priority badge
- **External URLs** (from other domains): Routed to "Supporting Resources (Off-Site)" section under "Client Priority Resources"

Priority URLs are always included even if they have low citation-worthiness scores, ensuring critical content appears in your LLMS.txt file.

### Recent Updates Detection

The system automatically analyzes publishing frequency and recent content:
- Extracts publication dates from URLs, metadata, and content
- Calculates recency window based on publishing patterns (30/60/90/180 days)
- Categorizes content as news, blog posts, or page updates
- Shows publishing frequency rating (high/medium/low/static)

This information appears in the "Recent Updates" section of the LLMS.txt output, helping AI systems understand content freshness.

## Future Enhancements

Potential improvements for the production web app:
- Allow editing individual topic names/descriptions
- Save/load topic templates for similar sites
- Topic merging/splitting in the UI
- Visual topic preview with page counts
- Export/import topic configurations
- Web UI for managing priority URLs
- Manual date override for pages with incorrect extraction
