import type { CrawledPage } from './types.js';

/**
 * Extract date from URL patterns like:
 * - /2024/11/19/article-title
 * - /blog/2024-11-19-post
 * - /news/2024/11/article
 */
export function extractDateFromUrl(url: string): Date | null {
  // Pattern 1: /YYYY/MM/DD/ or /YYYY/MM/
  const pattern1 = /\/(\d{4})\/(\d{1,2})(?:\/(\d{1,2}))?/;
  const match1 = url.match(pattern1);
  if (match1) {
    const year = parseInt(match1[1]);
    const month = parseInt(match1[2]);
    const day = match1[3] ? parseInt(match1[3]) : 1;

    // Validate date ranges
    if (year >= 2000 && year <= new Date().getFullYear() + 1 &&
        month >= 1 && month <= 12 &&
        day >= 1 && day <= 31) {
      try {
        return new Date(year, month - 1, day);
      } catch {
        return null;
      }
    }
  }

  // Pattern 2: YYYY-MM-DD anywhere in URL
  const pattern2 = /(\d{4})-(\d{2})-(\d{2})/;
  const match2 = url.match(pattern2);
  if (match2) {
    const year = parseInt(match2[1]);
    const month = parseInt(match2[2]);
    const day = parseInt(match2[3]);

    if (year >= 2000 && year <= new Date().getFullYear() + 1 &&
        month >= 1 && month <= 12 &&
        day >= 1 && day <= 31) {
      try {
        return new Date(year, month - 1, day);
      } catch {
        return null;
      }
    }
  }

  return null;
}

/**
 * Extract date from content patterns like:
 * - "Published: November 19, 2024"
 * - "Updated: 2024-11-19"
 * - "Posted on Nov 19, 2024"
 * - "Date: 11/19/2024"
 */
export function extractDateFromContent(markdown: string): Date | null {
  // Common date keyword patterns
  const patterns = [
    // "Published: November 19, 2024" or "Published November 19, 2024"
    /(?:published|posted|updated|date)[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,

    // "Published: 2024-11-19" or "Date: 11/19/2024"
    /(?:published|posted|updated|date)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/i,

    // "Nov 19, 2024" or "November 19, 2024" at start of content
    /^([A-Za-z]+\s+\d{1,2},?\s+\d{4})/m,

    // ISO format: 2024-11-19
    /(\d{4}-\d{2}-\d{2})/,
  ];

  for (const pattern of patterns) {
    const match = markdown.match(pattern);
    if (match) {
      try {
        const dateStr = match[1];
        const parsed = new Date(dateStr);

        // Validate parsed date
        if (!isNaN(parsed.getTime()) &&
            parsed.getFullYear() >= 2000 &&
            parsed.getFullYear() <= new Date().getFullYear() + 1) {
          return parsed;
        }
      } catch {
        continue;
      }
    }
  }

  return null;
}

/**
 * Extract date from page metadata (if available from Firecrawl)
 */
export function extractDateFromMetadata(page: CrawledPage): Date | null {
  // Check if Firecrawl returned any metadata with dates
  // This would need to be extended based on actual Firecrawl response structure
  // For now, we'll look for common patterns in the title or content

  // Try extracting from title first
  if (page.title) {
    const dateFromTitle = extractDateFromContent(page.title);
    if (dateFromTitle) return dateFromTitle;
  }

  return null;
}

/**
 * Main function: tries all extraction methods in priority order
 */
export function extractPageDate(page: CrawledPage): Date | null {
  // Priority 1: URL (most reliable for dated content)
  const urlDate = extractDateFromUrl(page.url);
  if (urlDate) return urlDate;

  // Priority 2: Content patterns
  const contentDate = extractDateFromContent(page.markdown || page.content);
  if (contentDate) return contentDate;

  // Priority 3: Metadata
  const metadataDate = extractDateFromMetadata(page);
  if (metadataDate) return metadataDate;

  return null;
}
