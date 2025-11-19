import type { CrawledPage, RecencyAnalysis, RecentContent, Logger } from './types.js';
import { extractPageDate } from './date-extraction';

/**
 * Analyze the publishing frequency of a site based on extracted dates
 * @returns recencyWindowDays - The appropriate window for "recent" content
 */
export function analyzePublishingFrequency(pages: CrawledPage[]): {
  recencyWindowDays: number;
  publishingFrequency: 'high' | 'medium' | 'low' | 'static';
} {
  const datedPages: { page: CrawledPage; date: Date }[] = [];

  // Extract dates from all pages
  for (const page of pages) {
    const date = extractPageDate(page);
    if (date) {
      datedPages.push({ page, date });
    }
  }

  // If no dates found, assume static site
  if (datedPages.length === 0) {
    return { recencyWindowDays: 180, publishingFrequency: 'static' };
  }

  // Calculate time span and frequency
  const dates = datedPages.map(dp => dp.date.getTime()).sort((a, b) => a - b);
  const oldestDate = new Date(dates[0]);
  const newestDate = new Date(dates[dates.length - 1]);
  const daySpan = (newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24);

  // Avoid division by zero
  if (daySpan < 1) {
    return { recencyWindowDays: 60, publishingFrequency: 'medium' };
  }

  // Calculate posts per month
  const postsPerMonth = (datedPages.length / daySpan) * 30;

  // Determine frequency category and appropriate recency window
  if (postsPerMonth > 10) {
    // High frequency: daily or near-daily posts
    return { recencyWindowDays: 30, publishingFrequency: 'high' };
  } else if (postsPerMonth >= 3) {
    // Medium frequency: a few posts per month
    return { recencyWindowDays: 60, publishingFrequency: 'medium' };
  } else if (postsPerMonth >= 0.5) {
    // Low frequency: occasional updates
    return { recencyWindowDays: 90, publishingFrequency: 'low' };
  } else {
    // Very low frequency: rare updates
    return { recencyWindowDays: 180, publishingFrequency: 'static' };
  }
}

/**
 * Determine the category of a page based on URL patterns
 */
function categorizeContent(url: string): 'news' | 'blog' | 'page' {
  const urlLower = url.toLowerCase();

  // Check for news indicators
  if (urlLower.includes('/news/') ||
      urlLower.includes('/press/') ||
      urlLower.includes('/newsroom/') ||
      urlLower.includes('/press-release')) {
    return 'news';
  }

  // Check for blog indicators
  if (urlLower.includes('/blog/') ||
      urlLower.includes('/article/') ||
      urlLower.includes('/post/') ||
      urlLower.includes('/insights/') ||
      urlLower.includes('/articles/')) {
    return 'blog';
  }

  // Default to general page
  return 'page';
}

/**
 * Extract a brief excerpt from page content (first 150 characters)
 */
function extractExcerpt(markdown: string): string {
  // Remove markdown headers
  const cleaned = markdown
    .replace(/^#+\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove links but keep text
    .trim();

  // Get first 150 characters
  const excerpt = cleaned.substring(0, 150).trim();

  return excerpt.length === 150 ? excerpt + '...' : excerpt;
}

/**
 * Find and categorize recent content from crawled pages
 */
export function findRecentContent(
  pages: CrawledPage[],
  recencyWindowDays: number,
  logger: Logger
): {
  recentNews: RecentContent[];
  recentBlogPosts: RecentContent[];
  recentPages: RecentContent[];
} {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - recencyWindowDays);

  const recentNews: RecentContent[] = [];
  const recentBlogPosts: RecentContent[] = [];
  const recentPages: RecentContent[] = [];

  logger.info(`Finding content from the last ${recencyWindowDays} days (since ${cutoffDate.toLocaleDateString()})...`);

  for (const page of pages) {
    const publishedDate = extractPageDate(page);

    // Skip if no date or older than cutoff
    if (!publishedDate || publishedDate < cutoffDate) {
      continue;
    }

    // Categorize and add to appropriate list
    const category = categorizeContent(page.url);
    const content: RecentContent = {
      url: page.url,
      title: page.title,
      publishedDate,
      category,
      excerpt: extractExcerpt(page.markdown || page.content),
    };

    switch (category) {
      case 'news':
        recentNews.push(content);
        break;
      case 'blog':
        recentBlogPosts.push(content);
        break;
      case 'page':
        recentPages.push(content);
        break;
    }
  }

  // Sort all by date (newest first)
  const sortByDate = (a: RecentContent, b: RecentContent) =>
    b.publishedDate.getTime() - a.publishedDate.getTime();

  recentNews.sort(sortByDate);
  recentBlogPosts.sort(sortByDate);
  recentPages.sort(sortByDate);

  logger.info(`Found ${recentNews.length} news items, ${recentBlogPosts.length} blog posts, ${recentPages.length} new pages`);

  // Limit to top 10 per category
  return {
    recentNews: recentNews.slice(0, 10),
    recentBlogPosts: recentBlogPosts.slice(0, 10),
    recentPages: recentPages.slice(0, 10),
  };
}

/**
 * Main function: analyze recency and find recent content
 */
export function analyzeRecency(
  pages: CrawledPage[],
  logger: Logger
): RecencyAnalysis {
  logger.info('Analyzing content recency and publishing frequency...');

  // Determine appropriate recency window
  const { recencyWindowDays, publishingFrequency } = analyzePublishingFrequency(pages);
  logger.info(`Detected ${publishingFrequency} publishing frequency → ${recencyWindowDays}-day recency window`);

  // Find recent content
  const { recentNews, recentBlogPosts, recentPages } = findRecentContent(
    pages,
    recencyWindowDays,
    logger
  );

  return {
    recencyWindowDays,
    publishingFrequency,
    recentNews,
    recentBlogPosts,
    recentPages,
    analyzedAt: new Date().toISOString(),
  };
}
