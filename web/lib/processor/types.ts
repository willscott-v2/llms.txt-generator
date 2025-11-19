// Crawl Types
export interface CrawledPage {
  url: string;
  title: string;
  h1Tags: string[];
  content: string;
  markdown: string;
  outboundLinks: string[];
  socialProfiles?: SocialProfile[];
}

export interface SocialProfile {
  platform: string;
  url: string;
  handle?: string;
  confidence?: number; // 0-100 confidence score
  discoveryMethod?: 'html_scrape' | 'serpapi' | 'manual';
}

export interface CrawlResult {
  pages: CrawledPage[];
  totalPages: number;
  domain: string;
  crawledAt: string;
}

// Analysis Types
export interface Topic {
  name: string;
  description: string;
  keywords: string[];
}

export interface PageScore {
  quantifiable: number; // 0-25: data, stats, research
  authority: number; // 0-25: credentials, citations, methodology
  structure: number; // 0-25: formatting, scannability
  uniqueness: number; // 0-25: original insights
  total: number; // 0-100
}

export interface HubPage {
  url: string;
  title: string;
  clusterId: string;
  clusterName: string;
  score: PageScore;
  citationGuidance: string;
  keyPoints: string[];
  isPriority?: boolean; // Marks client-specified priority URLs
}

export interface ContentCluster {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  pages: CrawledPage[];
  hubPages: HubPage[];
}

export interface AnalysisResult {
  topics: Topic[];
  clusters: ContentCluster[];
  hubPages: HubPage[];
  analyzedAt: string;
}

// Discovery Types
export interface OffsiteScore {
  relevance: number; // 0-20
  salience: number; // 0-20
  engagement: number; // 0-20
  recency: number; // 0-20
  authority: number; // 0-20
  total: number; // 0-100
}

export interface OffsiteContent {
  title: string;
  url: string;
  type: 'article' | 'video' | 'podcast' | 'paper' | 'other';
  source: string;
  description?: string;
  publishedDate?: string;
  clusterId: string;
  clusterName: string;
  score: OffsiteScore;
}

export interface DiscoveryResult {
  offsiteContent: OffsiteContent[];
  brandName: string;
  authorNames: string[];
  discoveredAt: string;
}

// Generation Types
export interface AuthoritySignal {
  type: 'certification' | 'award' | 'credential' | 'press' | 'other';
  title: string;
  description?: string;
  year?: number;
  url?: string;
}

export interface AudienceTaxonomy {
  audience: string;
  schemaOrgTypes: string[];
  naicsCode: string;
}

export interface CustomerTestimonial {
  customer: string;
  quote: string;
  url?: string;
  industry?: string;
}

export interface LLMSTxtContent {
  brandName: string;
  organizationOverview: string;
  primaryAudiences: string[];
  audienceTaxonomies: AudienceTaxonomy[];
  contentFocusAreas: string[];
  authoritySignals: AuthoritySignal[];
  customers?: string[];
  testimonials?: CustomerTestimonial[];
  clusters: ContentCluster[];
  offsiteResources: OffsiteContent[];
  recentUpdates?: RecencyAnalysis;
  contactInfo: {
    website: string;
    email?: string;
    phone?: string;
    address?: string;
    social?: SocialProfile[];
  };
  recommendations: string[];
  generatedAt: string;
}

export interface AuditReport {
  summary: string;
  topHubPages: HubPage[];
  contentGaps: string[];
  recommendations: string[];
  scoreDistribution: {
    excellent: number; // 80-100
    good: number; // 60-79
    fair: number; // 40-59
    poor: number; // 0-39
  };
  generatedAt: string;
}

// Pipeline Output
export interface PipelineOutput {
  crawlResult: CrawlResult;
  analysisResult: AnalysisResult;
  discoveryResult: DiscoveryResult;
  llmsTxtContent: LLMSTxtContent;
  auditReport: AuditReport;
  llmsTxtFile: string;
}

// Recent Updates Types
export interface RecentContent {
  url: string;
  title: string;
  publishedDate: Date;
  category: 'news' | 'blog' | 'page';
  excerpt?: string;
}

export interface RecencyAnalysis {
  recencyWindowDays: number;
  publishingFrequency: 'high' | 'medium' | 'low' | 'static';
  recentNews: RecentContent[];
  recentBlogPosts: RecentContent[];
  recentPages: RecentContent[];
  analyzedAt: string;
}

// Utility Types
export interface RetryOptions {
  maxAttempts: number;
  backoffMs: number[];
}

export interface Logger {
  log: (message: string) => void;
  error: (message: string, error?: Error) => void;
  success: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}
