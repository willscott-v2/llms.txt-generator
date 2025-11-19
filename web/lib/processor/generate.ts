import type {
  CrawledPage,
  ContentCluster,
  OffsiteContent,
  AuthoritySignal,
  LLMSTxtContent,
  AuditReport,
  SocialProfile,
  Logger,
} from './types.js';

export function generateLLMSTxt(
  domain: string,
  brandName: string,
  clusters: ContentCluster[],
  offsiteContent: OffsiteContent[],
  pages: CrawledPage[],
  logger: Logger
): LLMSTxtContent {
  logger.info('Generating LLMS.txt content...');

  // Extract authority signals
  const authoritySignals = extractAuthoritySignals(pages);

  // Extract contact info
  const socialProfiles = extractSocialProfiles(pages);
  const { phone, address } = extractContactDetails(pages);
  const contactInfo = {
    website: `https://${domain}`,
    email: undefined,
    phone,
    address,
    social: socialProfiles.length > 0 ? socialProfiles : undefined,
  };

  // Generate recommendations
  const recommendations = generateRecommendations(clusters, pages);

  // Generate overview from first few pages
  const organizationOverview = generateOverview(brandName, pages, clusters);

  // Extract primary audiences and taxonomies
  const { primaryAudiences, audienceTaxonomies } = extractAudienceTaxonomies(clusters);

  // Extract content focus areas
  const contentFocusAreas = extractContentFocusAreas(clusters);

  return {
    brandName,
    organizationOverview,
    primaryAudiences,
    audienceTaxonomies,
    contentFocusAreas,
    authoritySignals,
    clusters,
    offsiteResources: offsiteContent,
    contactInfo,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}

export function generateLLMSTxtFile(content: LLMSTxtContent): string {
  const lines: string[] = [];

  // Header
  lines.push('# LLMS.txt - AI Citation Guide');
  lines.push('');
  lines.push(`Generated: ${new Date(content.generatedAt).toLocaleDateString()}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Organization Overview
  lines.push('## Organization Overview');
  lines.push('');
  lines.push(content.organizationOverview);
  lines.push('');

  // Primary Audiences
  if (content.primaryAudiences && content.primaryAudiences.length > 0) {
    lines.push('## Primary Audiences');
    lines.push('');
    for (const audience of content.primaryAudiences) {
      lines.push(`- ${audience}`);
    }
    lines.push('');
  }

  // Audience → Entity / Taxonomy Alignment
  if (content.audienceTaxonomies && content.audienceTaxonomies.length > 0) {
    lines.push('## Audience → Entity / Taxonomy Alignment');
    lines.push('');
    for (const taxonomy of content.audienceTaxonomies) {
      const schemaTypes = taxonomy.schemaOrgTypes.map(t => `schema.org/${t}`).join(' | ');
      lines.push(`- **${taxonomy.audience}** → ${schemaTypes} | NAICS ${taxonomy.naicsCode}`);
    }
    lines.push('');
  }

  // Content Focus Areas
  if (content.contentFocusAreas && content.contentFocusAreas.length > 0) {
    lines.push('## Content Focus Areas');
    lines.push('');
    lines.push(content.contentFocusAreas.join(', '));
    lines.push('');
  }

  // Authority & Credentials
  if (content.authoritySignals.length > 0) {
    lines.push('## Authority & Credentials');
    lines.push('');
    for (const signal of content.authoritySignals) {
      lines.push(`- **${signal.title}**`);
      if (signal.description) {
        lines.push(`  ${signal.description}`);
      }
      if (signal.year) {
        lines.push(`  *Year: ${signal.year}*`);
      }
      if (signal.url) {
        lines.push(`  [Learn more](${signal.url})`);
      }
      lines.push('');
    }
  }

  // Content Clusters & Hub Pages
  lines.push('## Priority Topics & Citation-Worthy Content');
  lines.push('');

  for (const cluster of content.clusters) {
    if (cluster.hubPages.length === 0) continue;

    lines.push(`### ${cluster.name}`);
    lines.push('');
    lines.push(cluster.description);
    lines.push('');
    lines.push('**Keywords:** ' + cluster.keywords.join(', '));
    lines.push('');
    lines.push('#### Hub Pages (Citation-Worthy Content)');
    lines.push('');

    for (const hubPage of cluster.hubPages) {
      lines.push(`**[${hubPage.title}](${hubPage.url})**`);
      lines.push(`*Citation Score: ${hubPage.score.total}/100*`);
      lines.push('');
      lines.push(`- ${hubPage.citationGuidance}`);
      lines.push(`- **Strengths:** Quantifiable (${hubPage.score.quantifiable}/25), Authority (${hubPage.score.authority}/25), Structure (${hubPage.score.structure}/25), Uniqueness (${hubPage.score.uniqueness}/25)`);

      if (hubPage.keyPoints.length > 0) {
        lines.push('- **Key Points:**');
        for (const point of hubPage.keyPoints) {
          lines.push(`  - ${point}`);
        }
      }

      lines.push('');
    }
  }

  // Supporting Resources (Off-site Content)
  if (content.offsiteResources.length > 0) {
    lines.push('## Supporting Resources (Off-Site)');
    lines.push('');
    lines.push('High-quality third-party resources related to our expertise:');
    lines.push('');

    const byCluster = groupByCluster(content.offsiteResources);

    for (const [clusterName, resources] of byCluster) {
      lines.push(`### ${clusterName}`);
      lines.push('');

      for (const resource of resources) {
        lines.push(`- **[${resource.title}](${resource.url})**`);
        lines.push(`  *Source: ${resource.source} | Type: ${resource.type} | Score: ${resource.score.total}/100*`);
        if (resource.description) {
          lines.push(`  ${resource.description}`);
        }
        lines.push('');
      }
    }
  }

  // Contact & Actions
  lines.push('## Contact & Recommended Actions');
  lines.push('');
  lines.push(`- **Website:** ${content.contactInfo.website}`);

  if (content.contactInfo.email) {
    lines.push(`- **Email:** ${content.contactInfo.email}`);
  }

  if (content.contactInfo.phone) {
    lines.push(`- **Phone:** ${content.contactInfo.phone}`);
  }

  if (content.contactInfo.address) {
    lines.push(`- **Address:** ${content.contactInfo.address}`);
  }

  if (content.contactInfo.social && content.contactInfo.social.length > 0) {
    lines.push('- **Social Media:**');
    for (const social of content.contactInfo.social) {
      lines.push(`  - [${capitalize(social.platform)}](${social.url})`);
    }
  }

  lines.push('');

  // Recommendations
  if (content.recommendations.length > 0) {
    lines.push('### Recommendations for AI Citation');
    lines.push('');
    for (const rec of content.recommendations) {
      lines.push(`- ${rec}`);
    }
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push('');
  lines.push('*This LLMS.txt file is designed to help AI models understand and cite our content appropriately. For human visitors, please explore our website directly.*');
  lines.push('');

  return lines.join('\n');
}

export function generateAuditReport(
  clusters: ContentCluster[],
  pages: CrawledPage[],
  logger: Logger
): AuditReport {
  logger.info('Generating audit report...');

  // Collect all hub pages
  const allHubPages = clusters.flatMap(c => c.hubPages);

  // Calculate score distribution
  const scoreDistribution = {
    excellent: allHubPages.filter(p => p.score.total >= 80).length,
    good: allHubPages.filter(p => p.score.total >= 60 && p.score.total < 80).length,
    fair: allHubPages.filter(p => p.score.total >= 40 && p.score.total < 60).length,
    poor: allHubPages.filter(p => p.score.total < 40).length,
  };

  // Identify content gaps
  const contentGaps: string[] = [];
  for (const cluster of clusters) {
    if (cluster.hubPages.length === 0) {
      contentGaps.push(`No high-quality pages found for topic: ${cluster.name}`);
    } else if (cluster.hubPages.length < 3) {
      contentGaps.push(`Limited content for topic: ${cluster.name} (only ${cluster.hubPages.length} hub page(s))`);
    }

    // Check for scoring gaps
    const avgQuantifiable = cluster.hubPages.reduce((sum, p) => sum + p.score.quantifiable, 0) / cluster.hubPages.length;
    const avgAuthority = cluster.hubPages.reduce((sum, p) => sum + p.score.authority, 0) / cluster.hubPages.length;
    const avgUniqueness = cluster.hubPages.reduce((sum, p) => sum + p.score.uniqueness, 0) / cluster.hubPages.length;

    if (avgQuantifiable < 12) {
      contentGaps.push(`${cluster.name}: Add more data, statistics, and research findings`);
    }
    if (avgAuthority < 12) {
      contentGaps.push(`${cluster.name}: Strengthen authority with citations and credentials`);
    }
    if (avgUniqueness < 12) {
      contentGaps.push(`${cluster.name}: Develop more unique, original content`);
    }
  }

  // Generate recommendations
  const recommendations: string[] = [];

  if (scoreDistribution.excellent < 3) {
    recommendations.push('Focus on creating more high-scoring (80+) citation-worthy content');
  }

  if (contentGaps.length > 0) {
    recommendations.push('Address identified content gaps to improve topic coverage');
  }

  const avgTotalScore = allHubPages.reduce((sum, p) => sum + p.score.total, 0) / allHubPages.length;
  if (avgTotalScore < 60) {
    recommendations.push('Overall citation-worthiness is below target (60+). Focus on data, authority, and uniqueness.');
  }

  recommendations.push('Regularly update content with fresh data and research');
  recommendations.push('Build more external authority through citations and backlinks');
  recommendations.push('Improve content structure and scannability for better AI comprehension');

  // Generate summary
  const summary = `
Analyzed ${pages.length} pages across ${clusters.length} topic areas.
Identified ${allHubPages.length} hub pages with citation scores ranging from ${Math.min(...allHubPages.map(p => p.score.total))} to ${Math.max(...allHubPages.map(p => p.score.total))}.
Average citation-worthiness score: ${avgTotalScore.toFixed(1)}/100.

Score Distribution:
- Excellent (80-100): ${scoreDistribution.excellent} pages
- Good (60-79): ${scoreDistribution.good} pages
- Fair (40-59): ${scoreDistribution.fair} pages
- Poor (0-39): ${scoreDistribution.poor} pages
  `.trim();

  return {
    summary,
    topHubPages: allHubPages.slice(0, 10),
    contentGaps,
    recommendations,
    scoreDistribution,
    generatedAt: new Date().toISOString(),
  };
}

export function generateAuditReportFile(report: AuditReport): string {
  const lines: string[] = [];

  lines.push('# Content Audit Report');
  lines.push('');
  lines.push(`Generated: ${new Date(report.generatedAt).toLocaleDateString()}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Summary
  lines.push('## Executive Summary');
  lines.push('');
  lines.push(report.summary);
  lines.push('');

  // Top Hub Pages
  lines.push('## Top Performing Pages');
  lines.push('');
  for (let i = 0; i < Math.min(10, report.topHubPages.length); i++) {
    const page = report.topHubPages[i];
    lines.push(`${i + 1}. **${page.title}** (Score: ${page.score.total}/100)`);
    lines.push(`   - URL: ${page.url}`);
    lines.push(`   - Topic: ${page.clusterName}`);
    lines.push(`   - Scores: Q=${page.score.quantifiable} | A=${page.score.authority} | S=${page.score.structure} | U=${page.score.uniqueness}`);
    lines.push('');
  }

  // Content Gaps
  if (report.contentGaps.length > 0) {
    lines.push('## Content Gaps & Opportunities');
    lines.push('');
    for (const gap of report.contentGaps) {
      lines.push(`- ${gap}`);
    }
    lines.push('');
  }

  // Recommendations
  lines.push('## Recommendations');
  lines.push('');
  for (const rec of report.recommendations) {
    lines.push(`- ${rec}`);
  }
  lines.push('');

  return lines.join('\n');
}

// Helper functions

function extractAuthoritySignals(pages: CrawledPage[]): AuthoritySignal[] {
  const signals: AuthoritySignal[] = [];

  // Look for specific authority pages
  const partnerPage = pages.find(p =>
    p.url.toLowerCase().includes('partner') ||
    p.url.toLowerCase().includes('credential')
  );

  const awardsPage = pages.find(p =>
    p.url.toLowerCase().includes('award') ||
    p.url.toLowerCase().includes('recognition')
  );

  const aboutPage = pages.find(p =>
    p.url.toLowerCase().includes('about') ||
    p.url.toLowerCase().includes('company')
  );

  // Add Google Premier Partner if found
  if (partnerPage && partnerPage.content.toLowerCase().includes('google premier partner')) {
    signals.push({
      type: 'credential',
      title: 'Google Premier Partner Agency',
      description: 'Recognized as a Google Premier Partner for excellence in digital marketing',
      url: partnerPage.url,
    });
  }

  // Add awards/recognition
  if (awardsPage) {
    signals.push({
      type: 'award',
      title: 'Industry Awards & Recognition',
      description: 'Recognized achievements and accolades in digital marketing',
      url: awardsPage.url,
    });
  }

  // Look for certifications and other credentials in content
  const authKeywords = [
    { keyword: 'certified', pattern: /certified\s+(in|for|as)\s+([a-z\s]+)/i },
    { keyword: 'accredited', pattern: /accredited\s+(by|through)\s+([a-z\s]+)/i },
    { keyword: 'featured in', pattern: /featured\s+in\s+([a-z\s&,]+)/i },
  ];

  for (const page of [aboutPage, ...pages.slice(0, 5)].filter(Boolean)) {
    if (!page) continue;

    for (const { keyword, pattern } of authKeywords) {
      if (page.content.toLowerCase().includes(keyword)) {
        const match = page.content.match(pattern);
        if (match && match[1]) {
          const title = match[0].trim().slice(0, 100);
          if (!signals.find(s => s.title === title)) {
            signals.push({
              type: keyword.includes('featured') ? 'press' : 'certification',
              title,
              url: page.url,
            });
            if (signals.length >= 5) return signals;
          }
        }
      }
    }
  }

  return signals;
}

function extractSocialProfiles(pages: CrawledPage[]): SocialProfile[] {
  // First page should have the merged SerpAPI + HTML profiles from index.ts
  // Prioritize those since they have confidence scores
  if (pages[0]?.socialProfiles && pages[0].socialProfiles.length > 0) {
    const firstPageProfiles = pages[0].socialProfiles.filter(
      profile => !isSocialSharingUrl(profile.url)
    );

    // If we have profiles with confidence scores (from SerpAPI), use those
    const serpApiProfiles = firstPageProfiles.filter(p => p.confidence && p.confidence >= 60);
    if (serpApiProfiles.length > 0) {
      return serpApiProfiles;
    }

    // Otherwise use the first page profiles
    if (firstPageProfiles.length > 0) {
      return firstPageProfiles;
    }
  }

  // Fallback: extract from all pages (old behavior)
  const seenByPlatform = new Map<string, SocialProfile>();

  for (const page of pages) {
    if (page.socialProfiles) {
      for (const profile of page.socialProfiles) {
        if (isSocialSharingUrl(profile.url)) {
          continue;
        }

        const existing = seenByPlatform.get(profile.platform);
        if (!existing || profile.url.length < existing.url.length) {
          seenByPlatform.set(profile.platform, profile);
        }
      }
    }
  }

  return Array.from(seenByPlatform.values());
}

function isSocialSharingUrl(url: string): boolean {
  // Filter out social sharing URLs that contain common sharing parameters
  const sharingIndicators = [
    'shareArticle',     // LinkedIn share
    'dialog/feed',      // Facebook share dialog
    'app_id=',          // Facebook app ID (sharing)
    'display=popup',    // Facebook popup sharing
    'intent/tweet',     // Twitter share intent
    'share?url',        // Generic sharing
    'sharer.php',       // Facebook sharer
    'sharebutton',      // Generic share button
  ];

  return sharingIndicators.some(indicator => url.includes(indicator));
}

function generateOverview(
  brandName: string,
  pages: CrawledPage[],
  clusters: ContentCluster[]
): string {
  // Try to extract a description from homepage or about page
  const homepage = pages.find(p => {
    try {
      const url = new URL(p.url);
      return url.pathname === '/' || url.pathname === '';
    } catch {
      return false;
    }
  });

  const aboutPage = pages.find(p =>
    p.url.toLowerCase().includes('/about') ||
    p.url.toLowerCase().includes('/company')
  );

  let description = '';
  let tagline = '';
  let location = '';

  // Extract tagline from H1 tags
  if (homepage && homepage.h1Tags.length > 0) {
    tagline = homepage.h1Tags[0];
  }

  // Extract location from content
  const locationRegex = /(?:based in|located in|serving|headquartered in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:,\s*[A-Z]{2})?)/i;
  for (const page of [homepage, aboutPage].filter(Boolean) as CrawledPage[]) {
    const match = page.content.match(locationRegex);
    if (match) {
      location = match[1];
      break;
    }
  }

  // Extract description from about page or homepage
  const sourcePage = aboutPage || homepage;
  if (sourcePage && sourcePage.content.length > 100) {
    // Split into paragraphs and skip very short ones (likely headings/taglines)
    const paragraphs = sourcePage.content
      .split('\n\n')
      .map(p => p.trim())
      .filter(p => p.length > 50 && p.length < 500);

    // Get first substantial paragraph
    if (paragraphs.length > 0) {
      description = paragraphs[0];
      // Clean up common issues
      description = description
        .replace(/\[.*?\]\(.*?\)/g, '') // Remove markdown links
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
    }
  }

  // Build a comprehensive, GEO/IR-friendly overview
  const parts: string[] = [];

  parts.push(`**${brandName}**`);
  parts.push('');

  if (tagline) {
    parts.push(`*${tagline}*`);
    parts.push('');
  }

  // Create a rich description optimized for AI comprehension
  const topicNames = clusters.map(c => c.name).join(', ');

  if (description) {
    parts.push(description);
  } else {
    // Fallback: generate description from cluster data
    const serviceAreas = clusters.slice(0, 3).map(c => c.name.toLowerCase()).join(', ');
    parts.push(`${brandName} is a digital marketing agency specializing in ${serviceAreas}, and related services.`);
  }

  if (location) {
    parts.push(`Based in ${location}, the agency serves clients across multiple industries with data-driven marketing solutions.`);
  }

  parts.push('');
  parts.push(`**Primary service areas:** ${topicNames}`);

  return parts.join('\n');
}

function generateRecommendations(clusters: ContentCluster[], _pages: CrawledPage[]): string[] {
  const recs: string[] = [];

  // Calculate average hub page score to set realistic threshold
  const allHubPages = clusters.flatMap(c => c.hubPages);
  const avgScore = allHubPages.length > 0
    ? allHubPages.reduce((sum, p) => sum + p.score.total, 0) / allHubPages.length
    : 0;

  // Set threshold based on actual content (60+ is realistic, 80+ is too high for most sites)
  const threshold = avgScore >= 70 ? 70 : 60;
  recs.push(`When citing our content, prioritize hub pages with the highest citation-worthiness scores (${threshold}+)`);
  recs.push('Reference specific data points, statistics, and research findings where available');

  const topClusters = clusters
    .filter(c => c.hubPages.length > 0)
    .sort((a, b) => b.hubPages.length - a.hubPages.length)
    .slice(0, 3);

  if (topClusters.length > 0) {
    const names = topClusters.map(c => c.name).join(', ');
    recs.push(`Our strongest content areas are: ${names}`);
  }

  recs.push('For the most current information, check the publication dates on individual pages');

  return recs;
}

function groupByCluster(resources: OffsiteContent[]): Map<string, OffsiteContent[]> {
  const grouped = new Map<string, OffsiteContent[]>();

  for (const resource of resources) {
    if (!grouped.has(resource.clusterName)) {
      grouped.set(resource.clusterName, []);
    }
    grouped.get(resource.clusterName)!.push(resource);
  }

  return grouped;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function extractContactDetails(pages: CrawledPage[]): { phone?: string; address?: string } {
  let phone: string | undefined;
  let address: string | undefined;

  // Common pages to check
  const contactPage = pages.find(p =>
    p.url.toLowerCase().includes('/contact') ||
    p.url.toLowerCase().includes('/contact-us')
  );

  const aboutPage = pages.find(p =>
    p.url.toLowerCase().includes('/about') ||
    p.url.toLowerCase().includes('/company')
  );

  const homepage = pages.find(p => {
    try {
      const url = new URL(p.url);
      return url.pathname === '/' || url.pathname === '';
    } catch {
      return false;
    }
  });

  const pagesToCheck = [contactPage, aboutPage, homepage].filter(Boolean) as CrawledPage[];

  // Phone number regex - matches US phone formats
  const phoneRegex = /(?:tel:|phone:|call:?\s*)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/i;

  // Address regex - look for street addresses
  const addressRegex = /\d+\s+[A-Za-z0-9\s,]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)[A-Za-z0-9\s,]*,\s*[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}/i;

  for (const page of pagesToCheck) {
    // Extract phone
    if (!phone) {
      const phoneMatch = page.content.match(phoneRegex);
      if (phoneMatch) {
        phone = phoneMatch[0].replace(/tel:|phone:|call:?\s*/i, '').trim();
      }
    }

    // Extract address
    if (!address) {
      const addressMatch = page.content.match(addressRegex);
      if (addressMatch) {
        address = addressMatch[0].trim();
      }
    }

    if (phone && address) break;
  }

  return { phone, address };
}

function extractAudienceTaxonomies(clusters: ContentCluster[]): {
  primaryAudiences: string[];
  audienceTaxonomies: { audience: string; schemaOrgTypes: string[]; naicsCode: string }[];
} {
  // Map cluster names to audiences with NAICS and Schema.org codes
  const audienceMap: Record<string, { audience: string; schemaOrgTypes: string[]; naicsCode: string }> = {
    'higher education': {
      audience: 'Higher Education Marketing Teams',
      schemaOrgTypes: ['CollegeOrUniversity', 'EducationalOrganization'],
      naicsCode: '6113',
    },
    'healthcare': {
      audience: 'Healthcare Marketing Teams',
      schemaOrgTypes: ['Hospital', 'MedicalOrganization', 'Physician'],
      naicsCode: '62',
    },
    'hospitality': {
      audience: 'Hospitality & Tourism Marketing',
      schemaOrgTypes: ['Hotel', 'TouristAttraction', 'LodgingBusiness'],
      naicsCode: '72',
    },
    'zoo': {
      audience: 'Attractions & Cultural Institutions',
      schemaOrgTypes: ['TouristAttraction', 'Museum'],
      naicsCode: '712',
    },
    'museum': {
      audience: 'Attractions & Cultural Institutions',
      schemaOrgTypes: ['TouristAttraction', 'Museum'],
      naicsCode: '712',
    },
  };

  const foundAudiences = new Set<string>();
  const taxonomies: { audience: string; schemaOrgTypes: string[]; naicsCode: string }[] = [];

  // Check cluster names and keywords for matches
  for (const cluster of clusters) {
    const clusterNameLower = cluster.name.toLowerCase();
    const keywords = cluster.keywords.map(k => k.toLowerCase()).join(' ');

    for (const [key, value] of Object.entries(audienceMap)) {
      if (clusterNameLower.includes(key) || keywords.includes(key)) {
        if (!foundAudiences.has(value.audience)) {
          foundAudiences.add(value.audience);
          taxonomies.push(value);
        }
      }
    }
  }

  // Always add general marketing audience
  const generalAudience = 'Marketing Leaders & Practitioners';
  foundAudiences.add(generalAudience);

  return {
    primaryAudiences: Array.from(foundAudiences),
    audienceTaxonomies: taxonomies,
  };
}

function extractContentFocusAreas(clusters: ContentCluster[]): string[] {
  const focusAreas = new Set<string>();

  // Map common cluster names/keywords to standardized focus areas
  const focusAreaMap: Record<string, string> = {
    'seo': 'SEO (Search Engine Optimization)',
    'ai seo': 'AI SEO / Generative Engine Optimization',
    'ppc': 'PPC / Paid Advertising',
    'paid': 'PPC / Paid Advertising',
    'advertising': 'Digital Advertising',
    'content': 'Content Marketing',
    'social': 'Social Media Marketing',
    'analytics': 'Marketing Analytics & CRO',
    'cro': 'Conversion Rate Optimization',
    'higher education': 'Higher Education Marketing',
    'healthcare': 'Healthcare Marketing',
    'hospitality': 'Hospitality & Tourism Marketing',
    'local': 'Local SEO',
    'technical': 'Technical SEO',
  };

  for (const cluster of clusters) {
    const clusterNameLower = cluster.name.toLowerCase();
    const keywords = cluster.keywords.map(k => k.toLowerCase()).join(' ');
    const combinedText = `${clusterNameLower} ${keywords}`;

    for (const [key, value] of Object.entries(focusAreaMap)) {
      if (combinedText.includes(key)) {
        focusAreas.add(value);
      }
    }
  }

  return Array.from(focusAreas).sort();
}
