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

  // Process all clusters in parallel for better performance
  const clusterPromises = clusters.map(async (cluster) => {
    logger.info(`Searching for ${cluster.name} content...`);

    const searchPromises: Promise<OffsiteContent[]>[] = [];

    // Create all search promises for this cluster
    for (const platform of platforms) {
      const promise = (async () => {
        await delay(Math.random() * 500); // Stagger requests slightly
        const query = `site:${platform.site} "${brandName}" ${cluster.keywords.slice(0, 3).join(' ')}`;
        const results = await searchSerpAPI(query, apiKey, logger);

        return scoreAndFilterResults(
          results,
          cluster.id,
          cluster.name,
          cluster.keywords,
          ownDomain,
          platform.type,
          brandName
        );
      })();
      searchPromises.push(promise);
    }

    // Add general web search
    const generalPromise = (async () => {
      await delay(Math.random() * 500);
      const generalQuery = `"${brandName}" ${cluster.name} -site:${ownDomain || ''}`;
      const generalResults = await searchSerpAPI(generalQuery, apiKey, logger);

      return scoreAndFilterResults(
        generalResults,
        cluster.id,
        cluster.name,
        cluster.keywords,
        ownDomain,
        undefined,
        brandName
      );
    })();
    searchPromises.push(generalPromise);

    // Add author search if applicable
    if (authorNames.length > 0 && authorNames.length < 10) {
      const authorPromise = (async () => {
        await delay(Math.random() * 500);
        const authorQuery = `"${authorNames[0]}" ${cluster.name} -site:${ownDomain || ''}`;
        const authorResults = await searchSerpAPI(authorQuery, apiKey, logger);

        return scoreAndFilterResults(
          authorResults,
          cluster.id,
          cluster.name,
          cluster.keywords,
          ownDomain,
          undefined,
          brandName
        );
      })();
      searchPromises.push(authorPromise);
    }

    // Wait for all searches for this cluster to complete
    const clusterResults = await Promise.all(searchPromises);
    return clusterResults.flat();
  });

  // Wait for all clusters to complete
  const allResults = await Promise.all(clusterPromises);
  offsiteContent.push(...allResults.flat());

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
  platformType?: OffsiteContent['type'],
  brandName?: string
): OffsiteContent[] {
  const scored: OffsiteContent[] = [];

  for (const result of results) {
    const url = result.link || '';
    const domain = extractDomain(url);

    // Skip own domain content
    if (ownDomain && domain.includes(ownDomain.replace('www.', ''))) {
      continue;
    }

    // Require brand name to appear in title or snippet if provided
    if (brandName) {
      const title = (result.title || '').toLowerCase();
      const snippet = (result.snippet || '').toLowerCase();
      const brandLower = brandName.toLowerCase();

      // Check if brand name appears as complete words (not just substring)
      const brandWords = brandLower.split(/\s+/);
      const combinedText = `${title} ${snippet}`;

      // Brand must have at least 50% of its words present
      const matchedWords = brandWords.filter(word =>
        combinedText.includes(word) && word.length > 2 // ignore short words like "a", "of"
      );

      if (matchedWords.length < brandWords.length * 0.5) {
        continue; // Skip if brand not sufficiently represented
      }
    }

    const score = scoreOffsiteResult(result, clusterName, keywords, brandName);

    // Higher threshold for platform searches (60) to ensure quality
    const threshold = platformType ? 60 : 65;

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
  keywords: string[],
  brandName?: string
): OffsiteScore {
  const title = (result.title || '').toLowerCase();
  const snippet = (result.snippet || '').toLowerCase();
  const combined = `${title} ${snippet}`;
  const clusterLower = clusterName.toLowerCase();

  // 1. RELEVANCE (0-25): How well does it match the cluster topic and brand?
  let relevance = 0; // No base score - must earn it

  // Brand name mention (most important)
  if (brandName) {
    const brandLower = brandName.toLowerCase();
    if (title.includes(brandLower)) relevance += 12; // Full brand in title
    else if (snippet.includes(brandLower)) relevance += 8; // Full brand in snippet
  }

  // Cluster topic match
  if (combined.includes(clusterLower)) relevance += 8;

  // Keyword matches
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
    relevance: Math.min(25, Math.max(0, relevance)),
    salience: Math.min(20, Math.max(0, salience)),
    engagement: Math.min(20, Math.max(0, engagement)),
    recency: Math.min(20, Math.max(0, recency)),
    authority: Math.min(20, Math.max(0, authority)),
    total: Math.min(105, Math.max(0, total)),
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
