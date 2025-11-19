import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { crawlWebsite, extractBrandAndAuthors } from '@/lib/processor/crawl';
import { analyzeContent } from '@/lib/processor/analyze';
import { discoverOffsiteContent } from '@/lib/processor/discover';
import { discoverSocialProfiles, mergeSocialProfiles } from '@/lib/processor/social-discovery';
import { generateLLMSTxt as generateContent, generateLLMSTxtFile } from '@/lib/processor/generate';

// In-memory store for scan status (works on Railway!)
const scanStore = new Map<string, {
  status: 'crawling' | 'analyzing' | 'discovering' | 'generating' | 'completed' | 'error';
  progress: number;
  currentStep: string;
  error?: string;
  result?: {
    llmsTxt: string;
    analysisData: any;
  };
  createdAt: Date;
}>();

// Rate limiting: track concurrent scans
let activeScanCount = 0;
const MAX_CONCURRENT_SCANS = 3;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { domain, topics } = body;

    if (!domain) {
      return NextResponse.json(
        { error: 'Domain is required' },
        { status: 400 }
      );
    }

    // Check rate limit
    if (activeScanCount >= MAX_CONCURRENT_SCANS) {
      return NextResponse.json(
        { error: `Server is currently processing ${activeScanCount} generation${activeScanCount > 1 ? 's' : ''}. Please try again in a few minutes.` },
        { status: 503 }
      );
    }

    // Generate unique scan ID
    const scanId = randomUUID();

    // Initialize scan status
    scanStore.set(scanId, {
      status: 'crawling',
      progress: 0,
      currentStep: 'Starting crawl...',
      createdAt: new Date(),
    });

    // Increment active scan count
    activeScanCount++;
    console.log(`[Rate Limiter] Active scans: ${activeScanCount}/${MAX_CONCURRENT_SCANS}`);

    // Start processing in background (works on Railway - not serverless!)
    processGeneration(scanId, domain, topics || [])
      .catch(error => {
        console.error('Generation error:', error);
        scanStore.set(scanId, {
          status: 'error',
          progress: 0,
          currentStep: 'Error occurred',
          error: error instanceof Error ? error.message : 'Unknown error',
          createdAt: new Date(),
        });
      })
      .finally(() => {
        // Always decrement count when done (success or error)
        activeScanCount--;
        console.log(`[Rate Limiter] Active scans: ${activeScanCount}/${MAX_CONCURRENT_SCANS}`);
      });

    return NextResponse.json({ scanId });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start generation' },
      { status: 500 }
    );
  }
}

// GET endpoint to check scan status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scanId = searchParams.get('scanId');

  if (!scanId) {
    return NextResponse.json(
      { error: 'scanId is required' },
      { status: 400 }
    );
  }

  const scan = scanStore.get(scanId);

  if (!scan) {
    return NextResponse.json(
      { error: 'Scan not found' },
      { status: 404 }
    );
  }

  return NextResponse.json(scan);
}

async function processGeneration(scanId: string, domain: string, topics: string[]) {
  const updateStatus = (
    status: 'crawling' | 'analyzing' | 'discovering' | 'generating' | 'completed' | 'error',
    progress: number,
    currentStep: string
  ) => {
    const current = scanStore.get(scanId);
    if (current) {
      scanStore.set(scanId, {
        ...current,
        status,
        progress,
        currentStep,
      });
    }
  };

  const logger = {
    info: (msg: string) => console.log(`[${scanId}] ${msg}`),
    success: (msg: string) => console.log(`[${scanId}] ✓ ${msg}`),
    error: (msg: string) => console.error(`[${scanId}] ✗ ${msg}`),
    warning: (msg: string) => console.warn(`[${scanId}] ⚠ ${msg}`),
    log: (msg: string) => console.log(`[${scanId}] ${msg}`),
  };

  try {
    // Validate environment variables
    if (!process.env.FIRECRAWL_API_KEY) {
      throw new Error('FIRECRAWL_API_KEY is not set');
    }
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    if (!process.env.SERPAPI_KEY) {
      throw new Error('SERPAPI_KEY is not set');
    }

    // Step 1: Crawling
    updateStatus('crawling', 10, 'Crawling website pages...');
    logger.info(`Starting crawl for ${domain}`);
    const crawlResult = await crawlWebsite(domain, process.env.FIRECRAWL_API_KEY, logger);
    logger.success(`Crawled ${crawlResult.pages.length} pages`);

    // Discover social profiles
    updateStatus('crawling', 20, 'Discovering social profiles...');
    const brandInfo = extractBrandAndAuthors(crawlResult.pages);
    const serpSocialProfiles = await discoverSocialProfiles(
      brandInfo.brandName,
      crawlResult.domain,
      process.env.SERPAPI_KEY,
      logger
    );

    const htmlProfiles = crawlResult.pages.flatMap(page => page.socialProfiles || []);
    const mergedSocials = mergeSocialProfiles(htmlProfiles, serpSocialProfiles);
    crawlResult.pages[0].socialProfiles = mergedSocials;

    // Step 2: Analyzing
    updateStatus('analyzing', 40, 'Analyzing content and identifying topics...');
    logger.info('Analyzing content...');
    const analysisResult = await analyzeContent(
      crawlResult.pages,
      process.env.OPENAI_API_KEY,
      logger,
      topics.length > 0 ? topics : undefined
    );
    logger.success(`Identified ${analysisResult.topics.length} topics`);

    // Step 3: Discovering
    updateStatus('discovering', 65, 'Discovering third-party content...');
    logger.info('Discovering offsite content...');
    const { brandName, authorNames } = extractBrandAndAuthors(crawlResult.pages);
    const discoveryResult = await discoverOffsiteContent(
      analysisResult.clusters,
      brandName,
      authorNames,
      process.env.SERPAPI_KEY,
      logger,
      crawlResult.domain
    );
    logger.success(`Found ${discoveryResult.offsiteContent.length} offsite resources`);

    // Step 4: Generating
    updateStatus('generating', 85, 'Generating LLMS.txt file...');
    logger.info('Generating LLMS.txt...');
    const llmsTxtContent = generateContent(
      crawlResult.domain,
      brandName,
      analysisResult.clusters,
      discoveryResult.offsiteContent,
      crawlResult.pages,
      logger
    );
    const llmsTxtFile = generateLLMSTxtFile(llmsTxtContent);
    logger.success('LLMS.txt generated successfully');

    // Complete
    const current = scanStore.get(scanId);
    if (current) {
      scanStore.set(scanId, {
        ...current,
        status: 'completed',
        progress: 100,
        currentStep: 'Generation complete!',
        result: {
          llmsTxt: llmsTxtFile,
          analysisData: {
            topics: analysisResult.topics,
            clusters: analysisResult.clusters,
            hubPages: analysisResult.hubPages,
            offsiteContent: discoveryResult.offsiteContent,
            socialProfiles: mergedSocials,
          },
        },
      });
    }
  } catch (error) {
    console.error('Processing error:', error);
    const current = scanStore.get(scanId);
    if (current) {
      scanStore.set(scanId, {
        ...current,
        status: 'error',
        progress: 0,
        currentStep: 'Error occurred',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
