import OpenAI from 'openai';
import type {
  CrawledPage,
  Topic,
  ContentCluster,
  HubPage,
  PageScore,
  AnalysisResult,
  OffsiteContent,
  OffsiteScore,
  Logger,
} from './types.js';

const GPT_MODEL = 'gpt-5'; // Using GPT-5 for lower token costs

// Retry helper for rate limit handling
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  logger: Logger,
  maxRetries = 5
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRateLimitError = error?.status === 429 || error?.code === 'rate_limit_exceeded';
      const isLastAttempt = attempt === maxRetries - 1;

      if (!isRateLimitError || isLastAttempt) {
        throw error;
      }

      // Exponential backoff: 2^attempt * 1000ms (1s, 2s, 4s, 8s, 16s)
      const delay = Math.pow(2, attempt) * 1000;
      logger.warning(`Rate limit hit, retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

export async function analyzeContent(
  pages: CrawledPage[],
  apiKey: string,
  logger: Logger,
  targetDomain: string,
  userTopics?: string[],
  priorityUrls?: string[]
): Promise<AnalysisResult> {
  const openai = new OpenAI({ apiKey });

  logger.info('Starting content analysis with GPT-5...');

  // Step 1: Identify business priorities/topics
  logger.info('Step 1: Identifying main topics...');
  const topics = await identifyTopics(pages, openai, userTopics);
  logger.success(`Found ${topics.length} main topics`);

  // Step 2: Cluster pages by topic
  logger.info('Step 2: Clustering pages...');
  const clusters = await clusterPages(pages, topics, openai, logger);
  logger.success(`Created ${clusters.length} content clusters`);

  // Step 3: Score hub pages and process priority URLs
  logger.info('Step 3: Scoring hub pages...');
  const { hubPages, externalPriorityContent } = await scoreHubPages(
    clusters,
    openai,
    logger,
    pages,
    targetDomain,
    priorityUrls
  );
  logger.success(`Identified ${hubPages.length} hub pages`);
  if (externalPriorityContent.length > 0) {
    logger.success(`Identified ${externalPriorityContent.length} external priority URLs`);
  }

  return {
    topics,
    clusters,
    hubPages,
    externalPriorityContent,
    analyzedAt: new Date().toISOString(),
  };
}

async function identifyTopics(pages: CrawledPage[], openai: OpenAI, userTopics?: string[]): Promise<Topic[]> {
  // Prepare page summaries (title + H1s)
  const pageSummaries = pages
    .slice(0, 50) // Limit to first 50 pages to avoid token limits
    .map(page => ({
      title: page.title,
      h1s: page.h1Tags.join(', '),
      url: page.url,
    }));

  const userTopicsSection = userTopics && userTopics.length > 0
    ? `\nIMPORTANT: The user has explicitly requested these topic areas (MUST include all):
${userTopics.map(t => `- ${t}`).join('\n')}

REQUIREMENTS:
- You MUST include ALL of the user's requested topics in your response
- Treat these as the PRIMARY topics and prioritize them in your output
- You may add 1-3 additional topics if there are significant content areas not covered by the user's topics
- Keep the user's topic names as close to their original phrasing as possible
- Total topics should still be 3-7\n`
    : '';

  const prompt = `You are analyzing a website's content to identify 3-7 main business priorities or topic areas.
${userTopicsSection}
Here are the pages from the website:
${JSON.stringify(pageSummaries, null, 2)}

Based on ${userTopics && userTopics.length > 0 ? 'the user\'s REQUIRED topics and ' : ''}these pages, identify 3-7 distinct topic areas that represent the main business priorities or content categories of this website.

For each topic, provide:
1. A clear, concise name (2-4 words)
2. A brief description (1-2 sentences)
3. 3-5 relevant keywords

Return your response as a JSON array of topics in this exact format:
{
  "topics": [
    {
      "name": "Topic Name",
      "description": "Brief description of what this topic covers.",
      "keywords": ["keyword1", "keyword2", "keyword3"]
    }
  ]
}`;

  // Dummy logger for this function (since we don't have access to the main logger here)
  const dummyLogger = {
    info: () => {},
    success: () => {},
    error: () => {},
    warning: (msg: string) => console.warn(msg),
    log: () => {},
  };

  const response = await retryWithBackoff(
    () => openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
    dummyLogger
  );

  const result = JSON.parse(response.choices[0].message.content || '{}');
  return result.topics || [];
}

async function clusterPages(
  pages: CrawledPage[],
  topics: Topic[],
  openai: OpenAI,
  logger: Logger
): Promise<ContentCluster[]> {
  const clusters: ContentCluster[] = topics.map((topic, index) => ({
    id: `cluster-${index + 1}`,
    name: topic.name,
    description: topic.description,
    keywords: topic.keywords,
    pages: [],
    hubPages: [],
  }));

  // Assign pages to clusters (process in batches)
  const batchSize = 10;
  for (let i = 0; i < pages.length; i += batchSize) {
    const batch = pages.slice(i, Math.min(i + batchSize, pages.length));

    const prompt = `You are assigning web pages to topic clusters.

Topics:
${topics.map((t, idx) => `${idx + 1}. ${t.name}: ${t.description}`).join('\n')}

Pages:
${batch.map((p, idx) => `${i + idx + 1}. "${p.title}" - ${p.h1Tags.join(', ')}`).join('\n')}

For each page, determine which topic (1-${topics.length}) it best matches. If a page doesn't clearly fit any topic, assign it to the most relevant one.

Return your response as a JSON array in this exact format:
{
  "assignments": [
    { "pageIndex": ${i + 1}, "topicIndex": 1 },
    { "pageIndex": ${i + 2}, "topicIndex": 2 }
  ]
}`;

    const response = await retryWithBackoff(
      () => openai.chat.completions.create({
        model: GPT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
      logger
    );

    const result = JSON.parse(response.choices[0].message.content || '{}');
    const assignments = result.assignments || [];

    for (const assignment of assignments) {
      const pageIndex = assignment.pageIndex - 1;
      const topicIndex = assignment.topicIndex - 1;

      if (pageIndex >= 0 && pageIndex < pages.length && topicIndex >= 0 && topicIndex < clusters.length) {
        clusters[topicIndex].pages.push(pages[pageIndex]);
      }
    }

    logger.info(`Processed ${Math.min(i + batchSize, pages.length)}/${pages.length} pages`);
  }

  return clusters;
}

async function scoreHubPages(
  clusters: ContentCluster[],
  openai: OpenAI,
  logger: Logger,
  allPages: CrawledPage[],
  targetDomain: string,
  priorityUrls?: string[]
): Promise<{ hubPages: HubPage[]; externalPriorityContent: OffsiteContent[] }> {
  const allHubPages: HubPage[] = [];
  const externalPriorityContent: OffsiteContent[] = [];

  for (const cluster of clusters) {
    if (cluster.pages.length === 0) {
      logger.info(`Skipping ${cluster.name} (no pages)`);
      continue;
    }

    logger.info(`Scoring pages in ${cluster.name} (${cluster.pages.length} pages)...`);

    // Score top pages (limit to 10 to avoid token limits)
    const pagesToScore = cluster.pages.slice(0, 10);

    for (const page of pagesToScore) {
      const score = await scorePage(page, cluster.name, openai, logger);

      if (score.total >= 40) { // Only include pages with decent scores
        const hubPage: HubPage = {
          url: page.url,
          title: page.title,
          clusterId: cluster.id,
          clusterName: cluster.name,
          score,
          citationGuidance: generateCitationGuidance(page, score),
          keyPoints: extractKeyPoints(page),
        };

        allHubPages.push(hubPage);
        cluster.hubPages.push(hubPage);
      }
    }

    // Sort hub pages by score and keep top 5
    cluster.hubPages.sort((a, b) => b.score.total - a.score.total);
    cluster.hubPages = cluster.hubPages.slice(0, 5);

    logger.info(`Found ${cluster.hubPages.length} hub pages for ${cluster.name}`);
  }

  // Sort all hub pages by score
  allHubPages.sort((a, b) => b.score.total - a.score.total);

  // Handle priority URLs - ensure they're included even if they didn't score high
  if (priorityUrls && priorityUrls.length > 0) {
    logger.info(`Processing ${priorityUrls.length} priority URLs...`);

    const normalizedPriorityUrls = priorityUrls.map(url => normalizeUrl(url));
    const existingHubUrls = new Set(allHubPages.map(hp => normalizeUrl(hp.url)));

    for (const priorityUrl of priorityUrls) {
      const normalized = normalizeUrl(priorityUrl);

      // Check if this URL is from the target domain
      const isInternal = isUrlFromDomain(priorityUrl, targetDomain);

      if (isInternal) {
        // INTERNAL PRIORITY URL - add to hub pages

        // Skip if already in hub pages
        if (existingHubUrls.has(normalized)) {
          // Mark existing hub page as priority
          const existingHub = allHubPages.find(hp => normalizeUrl(hp.url) === normalized);
          if (existingHub) {
            existingHub.isPriority = true;
            logger.info(`Priority URL already in hub pages: ${priorityUrl}`);
          }
          continue;
        }

        // Find the page in all pages
        const page = allPages.find(p => normalizeUrl(p.url) === normalized);
        if (!page) {
          logger.warning(`Priority URL not found in crawled pages: ${priorityUrl}`);
          continue;
        }

        // Find best matching cluster for this page
        let bestCluster = clusters[0]; // Default to first cluster
        for (const cluster of clusters) {
          const clusterPage = cluster.pages.find(p => normalizeUrl(p.url) === normalized);
          if (clusterPage) {
            bestCluster = cluster;
            break;
          }
        }

        // Score the priority page
        logger.info(`Scoring priority URL: ${priorityUrl}`);
        const score = await scorePage(page, bestCluster.name, openai, logger);

        const priorityHubPage: HubPage = {
          url: page.url,
          title: page.title,
          clusterId: bestCluster.id,
          clusterName: bestCluster.name,
          score,
          citationGuidance: generateCitationGuidance(page, score),
          keyPoints: extractKeyPoints(page),
          isPriority: true,
        };

        allHubPages.push(priorityHubPage);
        bestCluster.hubPages.push(priorityHubPage);

        logger.success(`Added priority URL: ${page.title} (score: ${score.total}/100)`);
      } else {
        // EXTERNAL PRIORITY URL - add to offsite content

        // Find the page in all pages
        const page = allPages.find(p => normalizeUrl(p.url) === normalized);
        if (!page) {
          logger.warning(`External priority URL not found in crawled pages: ${priorityUrl}`);
          continue;
        }

        // Find best matching cluster for context
        let bestCluster = clusters[0]; // Default to first cluster
        for (const cluster of clusters) {
          const clusterPage = cluster.pages.find(p => normalizeUrl(p.url) === normalized);
          if (clusterPage) {
            bestCluster = cluster;
            break;
          }
        }

        // Extract source domain
        let sourceDomain = '';
        try {
          sourceDomain = new URL(priorityUrl).hostname.replace('www.', '');
        } catch {
          sourceDomain = 'External Source';
        }

        // Create offsite content entry
        const externalPriority: OffsiteContent = {
          title: page.title,
          url: page.url,
          type: 'article', // Default type
          source: sourceDomain,
          description: page.content.substring(0, 150) + '...',
          clusterId: bestCluster.id,
          clusterName: bestCluster.name,
          score: {
            relevance: 20,
            salience: 20,
            engagement: 20,
            recency: 20,
            authority: 20,
            total: 100,
          },
          isPriority: true,
        };

        externalPriorityContent.push(externalPriority);
        logger.success(`Added external priority URL: ${page.title}`);
      }
    }

    // Re-sort: priority pages first, then by score
    allHubPages.sort((a, b) => {
      if (a.isPriority && !b.isPriority) return -1;
      if (!a.isPriority && b.isPriority) return 1;
      return b.score.total - a.score.total;
    });
  }

  return { hubPages: allHubPages, externalPriorityContent };
}

/**
 * Normalize URL for comparison (remove trailing slashes, fragments, query params)
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    let normalized = `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`;
    normalized = normalized.replace(/\/$/, '');
    return normalized.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Check if a URL is from a specific domain
 */
function isUrlFromDomain(url: string, targetDomain: string): boolean {
  try {
    const urlHostname = new URL(url).hostname.replace('www.', '');
    const targetHostname = targetDomain.replace('www.', '').replace(/^https?:\/\//, '');
    return urlHostname === targetHostname;
  } catch {
    return false;
  }
}

async function scorePage(
  page: CrawledPage,
  clusterName: string,
  openai: OpenAI,
  logger: Logger
): Promise<PageScore> {
  // Truncate content to avoid token limits
  const contentPreview = page.markdown.slice(0, 4000);

  const prompt = `You are scoring a web page for "citation-worthiness" - how suitable it is to be cited by AI models.

Page Title: ${page.title}
Topic: ${clusterName}
Content Preview:
${contentPreview}

Score this page on 4 dimensions (0-25 points each):

1. QUANTIFIABLE (0-25): Does it contain data, statistics, research findings, or measurable insights?
   - 20-25: Rich with data, statistics, and research
   - 15-19: Multiple quantifiable points
   - 10-14: Some data or numbers
   - 5-9: Minimal quantifiable content
   - 0-4: No data or statistics

2. AUTHORITY (0-25): Does it demonstrate expertise through credentials, citations, methodology, or authoritative sources?
   - 20-25: Strong credentials, well-cited, clear methodology
   - 15-19: Good authority signals
   - 10-14: Some authority indicators
   - 5-9: Minimal authority signals
   - 0-4: No authority indicators

3. STRUCTURE (0-25): Is it well-formatted, scannable, with clear headings and organization?
   - 20-25: Excellent structure, very scannable
   - 15-19: Good formatting and organization
   - 10-14: Decent structure
   - 5-9: Poor structure
   - 0-4: Very poor or no structure

4. UNIQUENESS (0-25): Does it offer original insights, unique perspectives, or novel information?
   - 20-25: Highly original and unique
   - 15-19: Several unique insights
   - 10-14: Some original content
   - 5-9: Mostly generic
   - 0-4: Entirely commodity content

Return your response as JSON in this exact format:
{
  "quantifiable": 15,
  "authority": 18,
  "structure": 20,
  "uniqueness": 12,
  "reasoning": "Brief explanation of scores"
}`;

  const response = await retryWithBackoff(
    () => openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
    logger
  );

  const result = JSON.parse(response.choices[0].message.content || '{}');

  return {
    quantifiable: Math.min(25, Math.max(0, result.quantifiable || 0)),
    authority: Math.min(25, Math.max(0, result.authority || 0)),
    structure: Math.min(25, Math.max(0, result.structure || 0)),
    uniqueness: Math.min(25, Math.max(0, result.uniqueness || 0)),
    total:
      (result.quantifiable || 0) +
      (result.authority || 0) +
      (result.structure || 0) +
      (result.uniqueness || 0),
  };
}

function generateCitationGuidance(page: CrawledPage, score: PageScore): string {
  const strengths: string[] = [];

  if (score.quantifiable >= 15) strengths.push('data-rich content');
  if (score.authority >= 15) strengths.push('authoritative sources');
  if (score.structure >= 15) strengths.push('well-structured information');
  if (score.uniqueness >= 15) strengths.push('unique insights');

  if (strengths.length === 0) {
    return 'Use as general reference';
  }

  return `Best cited for ${strengths.join(', ')}. ${score.total >= 80 ? 'Highly recommended for citations.' : 'Suitable for citations.'}`;
}

function extractKeyPoints(page: CrawledPage): string[] {
  // Extract H1s and H2s as key points (simplified approach)
  const keyPoints: string[] = [];

  // Add H1 tags
  keyPoints.push(...page.h1Tags.filter(h1 => h1.length > 10 && h1.length < 100));

  // Extract H2s from markdown (simplified regex)
  const h2Regex = /^## (.+)$/gm;
  const h2Matches = [...page.markdown.matchAll(h2Regex)];
  const h2s = h2Matches
    .map(match => match[1].trim())
    .filter(h2 => h2.length > 10 && h2.length < 100)
    .slice(0, 3);

  keyPoints.push(...h2s);

  return keyPoints.slice(0, 5); // Max 5 key points
}
