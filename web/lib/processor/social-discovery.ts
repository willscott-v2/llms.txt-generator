import { getJson } from 'serpapi';
import type { SocialProfile, Logger } from './types.js';

const SOCIAL_PLATFORMS = [
  {
    name: 'twitter',
    patterns: ['twitter.com', 'x.com'],
    profilePattern: /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/?$/,
    channelPattern: /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/?$/,
    excludePatterns: ['/intent/', '/share', '/hashtag/', '/i/'],
  },
  {
    name: 'linkedin',
    patterns: ['linkedin.com'],
    profilePattern: /^https?:\/\/(www\.)?linkedin\.com\/(in|company)\/([a-zA-Z0-9-]+)\/?$/,
    channelPattern: /^https?:\/\/(www\.)?linkedin\.com\/company\/([a-zA-Z0-9-]+)\/?$/,
    excludePatterns: ['/share', '/pub/'],
  },
  {
    name: 'facebook',
    patterns: ['facebook.com'],
    profilePattern: /^https?:\/\/(www\.)?facebook\.com\/([a-zA-Z0-9.]+)\/?$/,
    channelPattern: /^https?:\/\/(www\.)?facebook\.com\/([a-zA-Z0-9.]+)\/?$/,
    excludePatterns: ['/dialog/', '/sharer/', '/plugins/', '/share.php'],
  },
  {
    name: 'instagram',
    patterns: ['instagram.com'],
    profilePattern: /^https?:\/\/(www\.)?instagram\.com\/([a-zA-Z0-9_.]+)\/?$/,
    channelPattern: /^https?:\/\/(www\.)?instagram\.com\/([a-zA-Z0-9_.]+)\/?$/,
    excludePatterns: ['/p/', '/reel/', '/tv/'],
  },
  {
    name: 'youtube',
    patterns: ['youtube.com'],
    profilePattern: /^https?:\/\/(www\.)?youtube\.com\/(c\/|channel\/|user\/|@)([a-zA-Z0-9_-]+)\/?$/,
    channelPattern: /^https?:\/\/(www\.)?youtube\.com\/(c\/|channel\/|user\/|@)([a-zA-Z0-9_-]+)\/?$/,
    excludePatterns: ['/watch', '/embed/', '/shorts/'],
  },
  {
    name: 'github',
    patterns: ['github.com'],
    profilePattern: /^https?:\/\/(www\.)?github\.com\/([a-zA-Z0-9_-]+)\/?$/,
    channelPattern: /^https?:\/\/(www\.)?github\.com\/([a-zA-Z0-9_-]+)\/?$/,
    excludePatterns: ['/issues/', '/pull/', '/blob/', '/tree/'],
  },
];

/**
 * Discover social profiles using SerpAPI
 */
export async function discoverSocialProfiles(
  brandName: string,
  domain: string,
  apiKey: string,
  logger: Logger
): Promise<SocialProfile[]> {
  logger.info('Discovering social profiles via SerpAPI...');

  const profiles: SocialProfile[] = [];

  // Search for brand social profiles
  const query = `"${brandName}" site:twitter.com OR site:facebook.com OR site:linkedin.com OR site:instagram.com OR site:youtube.com`;

  try {
    const response = await getJson({
      api_key: apiKey,
      engine: 'google',
      q: query,
      num: 20,
    });

    const results = response.organic_results || [];

    for (const result of results) {
      const url = result.link;
      if (!url) continue;

      const profile = validateAndExtractProfile(url, brandName, domain);
      if (profile) {
        profile.discoveryMethod = 'serpapi';
        profiles.push(profile);
      }
    }
  } catch (error) {
    logger.error('SerpAPI social discovery failed:', error as Error);
  }

  // Deduplicate by platform (keep highest confidence)
  const deduped = deduplicateByPlatform(profiles);

  logger.success(`Found ${deduped.length} social profiles via SerpAPI`);

  return deduped;
}

/**
 * Validate and extract profile from URL
 */
function validateAndExtractProfile(
  url: string,
  brandName: string,
  domain: string
): SocialProfile | null {
  for (const platform of SOCIAL_PLATFORMS) {
    // Check if URL matches platform domain
    if (!platform.patterns.some(pattern => url.includes(pattern))) {
      continue;
    }

    // Check for excluded patterns (share buttons, etc.)
    if (platform.excludePatterns.some(pattern => url.includes(pattern))) {
      continue;
    }

    // Validate URL structure
    const match = url.match(platform.channelPattern);
    if (!match) {
      continue;
    }

    // Extract handle from URL
    const handle = extractHandle(url, platform.name);
    if (!handle) {
      continue;
    }

    // Calculate confidence score
    const confidence = calculateConfidence(url, handle, brandName, domain);

    // Only return profiles with confidence >= 60
    if (confidence >= 60) {
      return {
        platform: platform.name,
        url: cleanUrl(url),
        handle,
        confidence,
      };
    }
  }

  return null;
}

/**
 * Extract handle from social URL
 */
function extractHandle(url: string, platform: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    switch (platform) {
      case 'twitter':
      case 'facebook':
      case 'instagram':
        // Extract @handle
        const parts = pathname.split('/').filter(p => p.length > 0);
        return parts[0] || null;

      case 'linkedin':
        // Extract company or personal profile
        const linkedinParts = pathname.split('/').filter(p => p.length > 0);
        return linkedinParts[1] || null; // Skip 'in' or 'company'

      case 'youtube':
        // Extract channel handle
        const ytParts = pathname.split('/').filter(p => p.length > 0);
        return ytParts[1] || null; // Skip 'c', 'channel', 'user', or '@'

      case 'github':
        // Extract org/user
        const ghParts = pathname.split('/').filter(p => p.length > 0);
        return ghParts[0] || null;

      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * Calculate confidence score for a social profile
 */
function calculateConfidence(
  url: string,
  handle: string,
  brandName: string,
  domain: string
): number {
  let confidence = 50; // Base score

  const handleLower = handle.toLowerCase();
  const brandLower = brandName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const domainParts = domain.replace('www.', '').split('.');
  const domainName = domainParts[0].toLowerCase();

  // 1. Handle matches brand name exactly (+40)
  if (handleLower === brandLower) {
    confidence += 40;
  }
  // 2. Handle contains brand name (+30)
  else if (handleLower.includes(brandLower) || brandLower.includes(handleLower)) {
    confidence += 30;
  }
  // 3. Handle matches domain name (+30)
  else if (handleLower === domainName) {
    confidence += 30;
  }
  // 4. Handle contains domain name (+20)
  else if (handleLower.includes(domainName) || domainName.includes(handleLower)) {
    confidence += 20;
  }

  // 5. URL is HTTPS (+5)
  if (url.startsWith('https://')) {
    confidence += 5;
  }

  // 6. No numbers in handle (+5, more likely official)
  if (!/\d/.test(handle)) {
    confidence += 5;
  }

  return Math.min(100, confidence);
}

/**
 * Clean URL (remove tracking params, etc.)
 */
function cleanUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove common tracking parameters
    urlObj.search = '';
    urlObj.hash = '';
    return urlObj.href;
  } catch {
    return url;
  }
}

/**
 * Deduplicate profiles by platform, keeping highest confidence
 */
function deduplicateByPlatform(profiles: SocialProfile[]): SocialProfile[] {
  const byPlatform = new Map<string, SocialProfile>();

  for (const profile of profiles) {
    const existing = byPlatform.get(profile.platform);
    if (!existing || (profile.confidence || 0) > (existing.confidence || 0)) {
      byPlatform.set(profile.platform, profile);
    }
  }

  return Array.from(byPlatform.values()).sort((a, b) => {
    return (b.confidence || 0) - (a.confidence || 0);
  });
}

/**
 * Merge HTML-scraped profiles with SerpAPI-discovered profiles
 */
export function mergeSocialProfiles(
  htmlProfiles: SocialProfile[],
  serpProfiles: SocialProfile[]
): SocialProfile[] {
  const merged = new Map<string, SocialProfile>();

  // Add SerpAPI profiles first (higher quality)
  for (const profile of serpProfiles) {
    merged.set(profile.platform, profile);
  }

  // Add HTML profiles only if platform not already found
  for (const profile of htmlProfiles) {
    if (!merged.has(profile.platform)) {
      // Validate the HTML profile before adding
      const validated = validateHtmlProfile(profile);
      if (validated && (validated.confidence || 0) >= 60) {
        merged.set(profile.platform, validated);
      }
    }
  }

  return Array.from(merged.values()).sort((a, b) => {
    return (b.confidence || 0) - (a.confidence || 0);
  });
}

/**
 * Validate HTML-scraped profile
 */
function validateHtmlProfile(profile: SocialProfile): SocialProfile | null {
  for (const platform of SOCIAL_PLATFORMS) {
    if (profile.platform !== platform.name) continue;

    // Check for excluded patterns
    if (platform.excludePatterns.some(pattern => profile.url.includes(pattern))) {
      return null;
    }

    // Validate URL structure
    const match = profile.url.match(platform.channelPattern);
    if (!match) {
      return null;
    }

    // Extract handle
    const handle = extractHandle(profile.url, platform.name);
    if (!handle) {
      return null;
    }

    // Return with medium confidence for HTML-scraped profiles
    return {
      ...profile,
      handle,
      confidence: 50, // Medium confidence for HTML scraping
      discoveryMethod: 'html_scrape',
    };
  }

  return null;
}
