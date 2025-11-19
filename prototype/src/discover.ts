import { getJson } from 'serpapi';
import type {
  ContentCluster,
  OffsiteContent,
  OffsiteScore,
  DiscoveryResult,
  Logger,
} from './types.js';

export async function discoverOffsiteContent(
  clusters: ContentCluster[],
  brandName: string,
  authorNames: string[],
  apiKey: string,
  logger: Logger,
  ownDomain?: string
): Promise<DiscoveryResult> {
  logger.info('Starting off-site content discovery...');

  const offsiteContent: OffsiteContent[] = [];

  // Third-party platforms to search
  const platforms = [
    { site: 'youtube.com', type: 'video' as const },
    { site: 'linkedin.com', type: 'article' as const },
    { site: 'medium.com', type: 'article' as const },
    { site: 'slideshare.net', type: 'other' as const },
    { site: 'podcasts.apple.com', type: 'podcast' as const },
    { site: 'spotify.com', type: 'podcast' as const },
  ];

  for (const cluster of clusters) {
    logger.info(`Searching for ${cluster.name} content...`);

    // Search each platform for brand + cluster topic
    for (const platform of platforms) {
      const query = `site:${platform.site} "${brandName}" ${cluster.keywords.slice(0, 3).join(' ')}`;
      const results = await searchSerpAPI(query, apiKey, logger);

      const scored = scoreAndFilterResults(
        results,
        cluster.id,
        cluster.name,
        cluster.keywords,
        ownDomain,
        platform.type
      );

      offsiteContent.push(...scored);

      // Small delay to avoid rate limits
      await delay(300);
    }

    // Also search for brand content on general web (excluding own domain)
    const generalQuery = `"${brandName}" ${cluster.name} -site:${ownDomain || ''}`;
    const generalResults = await searchSerpAPI(generalQuery, apiKey, logger);

    const generalScored = scoreAndFilterResults(
      generalResults,
      cluster.id,
      cluster.name,
      cluster.keywords,
      ownDomain
    );

    offsiteContent.push(...generalScored);

    // Search for authors + topic (if we have author names)
    if (authorNames.length > 0 && authorNames.length < 10) { // Only if we have real author names
      const authorQuery = `"${authorNames[0]}" ${cluster.name} -site:${ownDomain || ''}`;
      const authorResults = await searchSerpAPI(authorQuery, apiKey, logger);

      const authorScored = scoreAndFilterResults(
        authorResults,
        cluster.id,
        cluster.name,
        cluster.keywords,
        ownDomain
      );

      offsiteContent.push(...authorScored);
    }

    // Small delay between clusters
    await delay(500);
  }

  // Remove duplicates by URL
  const uniqueContent = deduplicateByUrl(offsiteContent);

  // Sort by score and keep top results
  uniqueContent.sort((a, b) => b.score.total - a.score.total);

  // Keep top 3-5 per cluster
  const finalContent = limitPerCluster(uniqueContent, 5);

  logger.success(`Found ${finalContent.length} high-quality off-site resources`);

  return {
    offsiteContent: finalContent,
    brandName,
    authorNames,
    discoveredAt: new Date().toISOString(),
  };
}

async function searchSerpAPI(
  query: string,
  apiKey: string,
  logger: Logger
): Promise<any[]> {
  try {
    const response = await getJson({
      api_key: apiKey,
      engine: 'google',
      q: query,
      num: 10, // Get 10 results
    });

    return response.organic_results || [];
  } catch (error) {
    logger.error(`SerpAPI search failed for "${query}":`, error as Error);
    return [];
  }
}

function scoreAndFilterResults(
  results: any[],
  clusterId: string,
  clusterName: string,
  keywords: string[],
  ownDomain?: string,
  platformType?: OffsiteContent['type']
): OffsiteContent[] {
  const scored: OffsiteContent[] = [];

  for (const result of results) {
    const url = result.link || '';
    const domain = extractDomain(url);

    // Skip own domain content
    if (ownDomain && domain.includes(ownDomain.replace('www.', ''))) {
      continue;
    }

    const score = scoreOffsiteResult(result, clusterName, keywords);

    // Lower threshold for platform-specific searches (50) since they're more targeted
    const threshold = platformType ? 50 : 60;

    if (score.total >= threshold) {
      scored.push({
        title: result.title || 'Untitled',
        url,
        type: platformType || determineContentType(result),
        source: domain,
        description: result.snippet || undefined,
        publishedDate: result.date || undefined,
        clusterId,
        clusterName,
        score,
      });
    }
  }

  return scored;
}

function scoreOffsiteResult(
  result: any,
  clusterName: string,
  keywords: string[]
): OffsiteScore {
  const title = (result.title || '').toLowerCase();
  const snippet = (result.snippet || '').toLowerCase();
  const combined = `${title} ${snippet}`;
  const clusterLower = clusterName.toLowerCase();

  // 1. RELEVANCE (0-20): How well does it match the cluster topic?
  let relevance = 5; // Base score for appearing in results
  if (combined.includes(clusterLower)) relevance += 10;
  const keywordMatches = keywords.filter(kw => combined.includes(kw.toLowerCase())).length;
  relevance += Math.min(5, keywordMatches * 2);

  // 2. SALIENCE (0-20): Does it appear to be in-depth content?
  let salience = 5; // Base score
  if (snippet.length > 150) salience += 5;
  if (snippet.length > 250) salience += 5;
  // Look for depth indicators
  const depthIndicators = ['guide', 'comprehensive', 'complete', 'detailed', 'ultimate', 'study', 'research', 'analysis', 'webinar', 'presentation'];
  if (depthIndicators.some(ind => combined.includes(ind))) salience += 5;

  // 3. ENGAGEMENT (0-20): Is it from an engaging format?
  let engagement = 5; // Base score
  const url = (result.link || '').toLowerCase();
  if (url.includes('youtube.com') || url.includes('vimeo.com')) engagement += 10;
  if (url.includes('podcast') || url.includes('spotify.com') || url.includes('apple.com/podcasts')) engagement += 10;
  if (url.includes('linkedin.com')) engagement += 5;
  if (title.includes('case study') || title.includes('tutorial') || title.includes('webinar')) engagement += 5;

  // 4. RECENCY (0-20): How recent is it?
  let recency = 10; // Default if no date
  if (result.date) {
    try {
      const date = new Date(result.date);
      const now = new Date();
      const daysSince = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSince < 90) recency = 20; // Last 3 months
      else if (daysSince < 180) recency = 15; // Last 6 months
      else if (daysSince < 365) recency = 10; // Last year
      else recency = 5; // Older
    } catch {
      recency = 10;
    }
  }

  // 5. AUTHORITY (0-20): Is the source authoritative?
  let authority = 5; // Base score
  const domain = extractDomain(result.link);
  const authDomains = [
    'harvard.edu', 'stanford.edu', 'mit.edu', // Academic
    'forbes.com', 'nytimes.com', 'wsj.com', 'economist.com', 'bloomberg.com', // Publications
    'techcrunch.com', 'wired.com', 'arstechnica.com', 'venturebeat.com', // Tech
    'youtube.com', 'linkedin.com', 'medium.com', 'slideshare.net', // Platforms
    'upcea.edu', 'educause.edu', 'chronicle.com', // Higher Ed specific
  ];
  if (authDomains.some(d => domain.includes(d))) authority += 10;
  if (domain.endsWith('.edu')) authority += 10;
  if (domain.endsWith('.gov')) authority += 15;

  const total = relevance + salience + engagement + recency + authority;

  return {
    relevance: Math.min(20, Math.max(0, relevance)),
    salience: Math.min(20, Math.max(0, salience)),
    engagement: Math.min(20, Math.max(0, engagement)),
    recency: Math.min(20, Math.max(0, recency)),
    authority: Math.min(20, Math.max(0, authority)),
    total: Math.min(100, Math.max(0, total)),
  };
}

function determineContentType(result: any): OffsiteContent['type'] {
  const url = (result.link || '').toLowerCase();
  const title = (result.title || '').toLowerCase();

  if (url.includes('youtube.com') || url.includes('vimeo.com') || title.includes('video')) {
    return 'video';
  }
  if (url.includes('podcast') || title.includes('podcast') || url.includes('audio')) {
    return 'podcast';
  }
  if (url.includes('.pdf') || title.includes('white paper') || title.includes('research paper')) {
    return 'paper';
  }

  return 'article';
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

function deduplicateByUrl(content: OffsiteContent[]): OffsiteContent[] {
  const seen = new Set<string>();
  return content.filter(item => {
    if (seen.has(item.url)) {
      return false;
    }
    seen.add(item.url);
    return true;
  });
}

function limitPerCluster(content: OffsiteContent[], maxPerCluster: number): OffsiteContent[] {
  const byCluster = new Map<string, OffsiteContent[]>();

  for (const item of content) {
    if (!byCluster.has(item.clusterId)) {
      byCluster.set(item.clusterId, []);
    }
    byCluster.get(item.clusterId)!.push(item);
  }

  const limited: OffsiteContent[] = [];
  for (const [, items] of byCluster) {
    limited.push(...items.slice(0, maxPerCluster));
  }

  return limited;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
