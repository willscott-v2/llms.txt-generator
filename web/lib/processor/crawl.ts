import FirecrawlApp from '@mendable/firecrawl-js';
import type { CrawlResult, CrawledPage, SocialProfile, Logger } from './types.js';

const SOCIAL_PLATFORMS = [
  { name: 'twitter', patterns: ['twitter.com', 'x.com'] },
  { name: 'linkedin', patterns: ['linkedin.com'] },
  { name: 'facebook', patterns: ['facebook.com'] },
  { name: 'instagram', patterns: ['instagram.com'] },
  { name: 'youtube', patterns: ['youtube.com'] },
  { name: 'github', patterns: ['github.com'] },
];

export async function crawlWebsite(
  domain: string,
  apiKey: string,
  logger: Logger
): Promise<CrawlResult> {
  logger.info(`Starting crawl of ${domain}...`);

  const firecrawl = new FirecrawlApp({ apiKey });

  try {
    // Normalize domain URL
    const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;

    // Start the async crawl using the correct method name
    const asyncResponse = await firecrawl.startCrawl(baseUrl, {
      limit: 100, // Max pages to crawl
      scrapeOptions: {
        formats: ['markdown', 'html'],
        includeTags: ['h1', 'h2', 'h3', 'a'],
        excludeTags: ['nav', 'footer', 'script', 'style'],
        waitFor: 1000, // Wait 1s for dynamic content
      },
    });

    if (!asyncResponse.id) {
      throw new Error(`Failed to start crawl: ${JSON.stringify(asyncResponse)}`);
    }

    const crawlId = asyncResponse.id;
    logger.info(`Crawl job started with ID: ${crawlId}. Waiting for completion...`);

    // Poll for completion
    let crawlJob: any;
    const maxAttempts = 120; // 10 minutes max (5s intervals)
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

      try {
        crawlJob = await firecrawl.getCrawlStatus(crawlId);
      } catch (error: any) {
        // Handle timeout errors - Firecrawl SDK has 60s timeout per request
        if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
          logger.info(`Status check timed out, retrying... (${attempts * 5}s elapsed)`);
          attempts++;
          continue; // Retry on next iteration
        }
        throw error; // Re-throw other errors
      }

      if (crawlJob.status === 'completed') {
        break;
      } else if (crawlJob.status === 'failed') {
        throw new Error(`Crawl job failed`);
      }

      attempts++;
      if (attempts % 6 === 0) { // Every 30 seconds
        logger.info(`Still crawling... (${attempts * 5}s elapsed)`);
      }
    }

    if (!crawlJob || crawlJob.status !== 'completed') {
      throw new Error(`Crawl timeout or failed with status: ${crawlJob?.status || 'unknown'}`);
    }

    const crawledPages = crawlJob.data || [];
    logger.success(`Crawl completed! Found ${crawledPages.length} pages`);

    // Process crawl results
    const pages: CrawledPage[] = crawledPages.map((page: any) => {
      // Extract H1 tags from HTML
      const h1Tags = extractH1Tags(page.html || '');

      // Extract outbound links
      const outboundLinks = extractOutboundLinks(page.html || '', baseUrl);

      // Detect social profiles
      const socialProfiles = detectSocialProfiles(outboundLinks);

      return {
        url: page.metadata?.url || page.url || '',
        title: page.metadata?.title || 'Untitled',
        h1Tags,
        content: page.content || page.markdown || '',
        markdown: page.markdown || '',
        outboundLinks,
        socialProfiles: socialProfiles.length > 0 ? socialProfiles : undefined,
      };
    });

    return {
      pages,
      totalPages: pages.length,
      domain: new URL(baseUrl).hostname,
      crawledAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Crawl failed:', error as Error);
    throw error;
  }
}

function extractH1Tags(html: string): string[] {
  const h1Regex = /<h1[^>]*>(.*?)<\/h1>/gi;
  const matches = [...html.matchAll(h1Regex)];
  return matches
    .map(match => stripHtmlTags(match[1]))
    .filter(text => text.trim().length > 0);
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

function extractOutboundLinks(html: string, baseUrl: string): string[] {
  const linkRegex = /<a[^>]+href=["']([^"']+)["']/gi;
  const matches = [...html.matchAll(linkRegex)];
  const baseDomain = new URL(baseUrl).hostname;

  return matches
    .map(match => {
      try {
        const url = new URL(match[1], baseUrl);
        // Only return external links
        return url.hostname !== baseDomain ? url.href : null;
      } catch {
        return null;
      }
    })
    .filter((url): url is string => url !== null)
    .filter((url, index, self) => self.indexOf(url) === index); // Unique
}

function detectSocialProfiles(links: string[]): SocialProfile[] {
  const profiles: SocialProfile[] = [];

  for (const link of links) {
    for (const platform of SOCIAL_PLATFORMS) {
      if (platform.patterns.some(pattern => link.includes(pattern))) {
        profiles.push({
          platform: platform.name,
          url: link,
        });
        break;
      }
    }
  }

  // Remove duplicates
  return profiles.filter(
    (profile, index, self) =>
      self.findIndex(p => p.platform === profile.platform) === index
  );
}

export function extractBrandAndAuthors(pages: CrawledPage[]): {
  brandName: string;
  authorNames: string[];
} {
  let brandName = 'Unknown';

  // Try to extract brand name from title or content
  const homepage = pages.find(p => {
    try {
      const url = new URL(p.url);
      return url.pathname === '/' || url.pathname === '';
    } catch {
      return false;
    }
  });

  if (homepage) {
    // Try to extract from title (often in format "Brand Name - Tagline", "Brand Name: Tagline", or "Brand Name | Tagline")
    const titleMatch = homepage.title.match(/^([^-:|]+)(?:\s*[-:|]|$)/);
    if (titleMatch && titleMatch[1].trim().length > 0 && titleMatch[1].trim().length < 50) {
      brandName = titleMatch[1].trim();
    } else {
      // Fallback: use domain with capitalization
      const domain = new URL(homepage.url).hostname.replace('www.', '');
      // Convert "searchinfluence.com" to "Search Influence"
      brandName = domain
        .replace(/\.com|\.org|\.net|\.io$/i, '')
        .split(/(?=[A-Z])|[-_.]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
  } else if (pages[0]?.url) {
    // Last resort: use domain with capitalization
    const domain = new URL(pages[0].url).hostname.replace('www.', '');
    brandName = domain
      .replace(/\.com|\.org|\.net|\.io$/i, '')
      .split(/(?=[A-Z])|[-_.]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Look for author mentions in content (simplified)
  const authorNames: string[] = [];
  const authorRegex = /(?:by|author:|written by)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/gi;

  for (const page of pages.slice(0, 10)) {
    // Check first 10 pages
    const matches = [...page.content.matchAll(authorRegex)];
    for (const match of matches) {
      const author = match[1].trim();
      if (!authorNames.includes(author)) {
        authorNames.push(author);
      }
    }
  }

  return {
    brandName,
    authorNames: authorNames.slice(0, 5), // Max 5 authors
  };
}

/**
 * Ensure priority URLs are included in crawled pages
 * If a priority URL hasn't been crawled, scrape it individually
 */
export async function ensurePriorityUrlsCrawled(
  existingPages: CrawledPage[],
  priorityUrls: string[],
  apiKey: string,
  logger: Logger
): Promise<CrawledPage[]> {
  if (!priorityUrls || priorityUrls.length === 0) {
    return existingPages;
  }

  logger.info(`Checking ${priorityUrls.length} priority URLs...`);

  const missingUrls: string[] = [];
  const normalizedExistingUrls = new Set(
    existingPages.map(p => normalizeUrl(p.url))
  );

  // Find priority URLs that weren't crawled
  for (const priorityUrl of priorityUrls) {
    const normalized = normalizeUrl(priorityUrl);
    if (!normalizedExistingUrls.has(normalized)) {
      missingUrls.push(priorityUrl);
    }
  }

  if (missingUrls.length === 0) {
    logger.info('All priority URLs already crawled');
    return existingPages;
  }

  logger.info(`Scraping ${missingUrls.length} missing priority URLs...`);

  const firecrawl = new FirecrawlApp({ apiKey });
  const newPages: CrawledPage[] = [];

  // Scrape each missing URL individually
  for (const url of missingUrls) {
    try {
      logger.info(`Scraping priority URL: ${url}`);

      const result = await firecrawl.scrape(url, {
        formats: ['markdown', 'html'],
        includeTags: ['h1', 'h2', 'h3', 'a'],
        excludeTags: ['nav', 'footer', 'script', 'style'],
        waitFor: 1000,
      });

      if (result) {
        const h1Tags = extractH1Tags(result.html || '');
        const outboundLinks = extractOutboundLinks(result.html || '', url);
        const socialProfiles = detectSocialProfiles(outboundLinks);

        newPages.push({
          url: result.metadata?.url || url,
          title: result.metadata?.title || 'Untitled',
          h1Tags,
          content: result.markdown || '',
          markdown: result.markdown || '',
          outboundLinks,
          socialProfiles: socialProfiles.length > 0 ? socialProfiles : undefined,
        });

        logger.success(`Scraped: ${result.metadata?.title || url}`);
      } else {
        logger.warning(`Failed to scrape priority URL: ${url}`);
      }
    } catch (error) {
      logger.warning(`Error scraping priority URL ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  logger.success(`Added ${newPages.length} priority URLs to crawl results`);

  return [...existingPages, ...newPages];
}

/**
 * Normalize URL for comparison (remove trailing slashes, fragments, query params)
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove trailing slash, fragment, and query params
    let normalized = `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`;
    normalized = normalized.replace(/\/$/, '');
    return normalized.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}
