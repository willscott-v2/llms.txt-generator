#!/usr/bin/env node

import { config } from 'dotenv';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import * as readline from 'readline';
import { crawlWebsite, extractBrandAndAuthors } from './crawl.js';
import { analyzeContent } from './analyze.js';
import { discoverOffsiteContent } from './discover.js';
import { discoverSocialProfiles, mergeSocialProfiles } from './social-discovery.js';
import {
  generateLLMSTxt,
  generateLLMSTxtFile,
  generateAuditReport,
  generateAuditReportFile,
} from './generate.js';
import type { Logger, Topic } from './types.js';

// Load environment variables
config();

// Create logger
const logger: Logger = {
  log: (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`),
  error: (msg: string, error?: Error) => {
    console.error(`[${new Date().toISOString()}] ❌ ${msg}`);
    if (error) console.error(error);
  },
  success: (msg: string) => console.log(`[${new Date().toISOString()}] ✅ ${msg}`),
  info: (msg: string) => console.log(`[${new Date().toISOString()}] ℹ️  ${msg}`),
};

// Helper function to parse command line arguments
function parseArgs(): { domain: string; userTopics?: string[]; autoAccept?: boolean } {
  const args = process.argv.slice(2);
  let domain = '';
  let userTopics: string[] | undefined;
  let autoAccept = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--topics' && i + 1 < args.length) {
      userTopics = args[i + 1].split(',').map(t => t.trim()).filter(t => t.length > 0);
      i++; // Skip next arg
    } else if (args[i] === '--auto-accept') {
      autoAccept = true;
    } else if (!domain && !args[i].startsWith('--')) {
      domain = args[i];
    }
  }

  return { domain, userTopics, autoAccept };
}

// Helper function to prompt user for input
function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Interactive topic review
async function reviewTopics(topics: Topic[]): Promise<boolean> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 TOPIC REVIEW');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`GPT-5 has identified ${topics.length} topics:\n`);

  topics.forEach((topic, index) => {
    console.log(`${index + 1}. ${topic.name}`);
    console.log(`   Description: ${topic.description}`);
    console.log(`   Keywords: ${topic.keywords.join(', ')}`);
    console.log('');
  });

  const answer = await prompt('Review these topics:\n  [A]ccept and continue  [R]egenerate  [Q]uit\n\nYour choice: ');
  const choice = answer.toLowerCase();

  if (choice === 'a' || choice === 'accept') {
    return true; // Accept topics
  } else if (choice === 'r' || choice === 'regenerate') {
    return false; // Regenerate
  } else if (choice === 'q' || choice === 'quit') {
    console.log('\n👋 Exiting...\n');
    process.exit(0);
  } else {
    console.log('\n❌ Invalid choice. Please try again.\n');
    return await reviewTopics(topics); // Ask again
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║          LLMS.txt Generator - Prototype CLI              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Parse command line arguments
  const { domain, userTopics, autoAccept } = parseArgs();

  if (!domain) {
    console.error('Usage: npm start -- <domain> [--topics "Topic1,Topic2,Topic3"]');
    console.error('Example: npm start -- https://searchinfluence.com');
    console.error('Example with topics: npm start -- https://searchinfluence.com --topics "SEO,PPC,Content Marketing"');
    process.exit(1);
  }

  if (userTopics && userTopics.length > 0) {
    logger.info(`User-provided topic hints: ${userTopics.join(', ')}`);
  }

  // Validate environment variables
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const serpApiKey = process.env.SERPAPI_KEY;

  if (!firecrawlKey) {
    logger.error('FIRECRAWL_API_KEY is required. Please set it in .env file.');
    process.exit(1);
  }

  if (!openaiKey) {
    logger.error('OPENAI_API_KEY is required. Please set it in .env file.');
    process.exit(1);
  }

  if (!serpApiKey) {
    logger.error('SERPAPI_KEY is required. Please set it in .env file.');
    process.exit(1);
  }

  const startTime = Date.now();

  try {
    // Ensure output directory exists
    const outputDir = join(process.cwd(), 'output');
    await mkdir(outputDir, { recursive: true });

    // ============================================================
    // STEP 1: CRAWL
    // ============================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📡 STEP 1: CRAWLING WEBSITE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const crawlResult = await crawlWebsite(domain, firecrawlKey, logger);

    // Discover social profiles via SerpAPI
    logger.info('Discovering social profiles...');
    const brandInfo = extractBrandAndAuthors(crawlResult.pages);
    const serpSocialProfiles = await discoverSocialProfiles(
      brandInfo.brandName,
      crawlResult.domain,
      serpApiKey,
      logger
    );

    // Merge HTML-scraped profiles with SerpAPI-discovered profiles
    const htmlProfiles = crawlResult.pages
      .flatMap(page => page.socialProfiles || []);
    const mergedSocials = mergeSocialProfiles(htmlProfiles, serpSocialProfiles);

    // Add merged social profiles to crawl result
    crawlResult.pages[0].socialProfiles = mergedSocials;

    // Save crawl data
    await writeFile(
      join(outputDir, 'crawl-data.json'),
      JSON.stringify(crawlResult, null, 2)
    );

    logger.success(`Crawl complete! Saved to output/crawl-data.json`);
    logger.info(`Social profiles discovered: ${mergedSocials.map(p => `${p.platform} (${p.confidence}%)`).join(', ')}`);

    // ============================================================
    // STEP 2: ANALYZE
    // ============================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧠 STEP 2: ANALYZING CONTENT WITH GPT-5');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let topicsAccepted = false;
    let analysisResult = await analyzeContent(crawlResult.pages, openaiKey, logger, userTopics);

    // Loop until user accepts the topics (or auto-accept if flag is set)
    if (autoAccept) {
      console.log('\n📋 Auto-accepting topics (--auto-accept flag set)\n');
      topicsAccepted = true;
      // Still display the topics for reference
      analysisResult.topics.forEach((topic, index) => {
        console.log(`${index + 1}. ${topic.name}`);
        console.log(`   Description: ${topic.description}`);
        console.log(`   Keywords: ${topic.keywords.join(', ')}`);
        console.log('');
      });
    } else {
      while (!topicsAccepted) {
        topicsAccepted = await reviewTopics(analysisResult.topics);

        if (!topicsAccepted) {
          logger.info('Regenerating topics...');
          analysisResult = await analyzeContent(crawlResult.pages, openaiKey, logger, userTopics);
        }
      }
    }

    logger.success('Topics accepted! Continuing with analysis...');

    // Save analysis data
    await writeFile(
      join(outputDir, 'analysis.json'),
      JSON.stringify(analysisResult, null, 2)
    );

    logger.success(`Analysis complete! Saved to output/analysis.json`);

    // ============================================================
    // STEP 3: DISCOVER
    // ============================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 STEP 3: DISCOVERING OFF-SITE CONTENT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const { brandName, authorNames } = extractBrandAndAuthors(crawlResult.pages);
    logger.info(`Brand: ${brandName}`);
    if (authorNames.length > 0) {
      logger.info(`Authors: ${authorNames.join(', ')}`);
    }

    const discoveryResult = await discoverOffsiteContent(
      analysisResult.clusters,
      brandName,
      authorNames,
      serpApiKey,
      logger,
      crawlResult.domain
    );

    // Save discovery data
    await writeFile(
      join(outputDir, 'discovery.json'),
      JSON.stringify(discoveryResult, null, 2)
    );

    logger.success(`Discovery complete! Saved to output/discovery.json`);

    // ============================================================
    // STEP 4: GENERATE
    // ============================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 STEP 4: GENERATING LLMS.TXT FILE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Generate LLMS.txt content
    const llmsTxtContent = generateLLMSTxt(
      crawlResult.domain,
      brandName,
      analysisResult.clusters,
      discoveryResult.offsiteContent,
      crawlResult.pages,
      logger
    );

    // Generate LLMS.txt file
    const llmsTxtFile = generateLLMSTxtFile(llmsTxtContent);
    await writeFile(join(outputDir, 'llms.txt'), llmsTxtFile);

    logger.success(`LLMS.txt generated! Saved to output/llms.txt`);

    // Generate audit report
    const auditReport = generateAuditReport(
      analysisResult.clusters,
      crawlResult.pages,
      logger
    );

    const auditReportFile = generateAuditReportFile(auditReport);
    await writeFile(join(outputDir, 'audit-report.md'), auditReportFile);

    logger.success(`Audit report generated! Saved to output/audit-report.md`);

    // ============================================================
    // COMPLETION
    // ============================================================
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ COMPLETE!                           ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log(`⏱️  Total time: ${duration} seconds\n`);

    console.log('📊 Results Summary:');
    console.log(`   • Pages crawled: ${crawlResult.totalPages}`);
    console.log(`   • Topics identified: ${analysisResult.topics.length}`);
    console.log(`   • Hub pages found: ${analysisResult.hubPages.length}`);
    console.log(`   • Off-site resources: ${discoveryResult.offsiteContent.length}`);
    console.log(`   • Authority signals: ${llmsTxtContent.authoritySignals.length}`);
    console.log('');

    console.log('📁 Output Files:');
    console.log('   • output/crawl-data.json     - Raw crawl results');
    console.log('   • output/analysis.json       - Topic clusters & scores');
    console.log('   • output/discovery.json      - Off-site content');
    console.log('   • output/llms.txt            - 🎯 Final LLMS.txt file');
    console.log('   • output/audit-report.md     - Content audit & recommendations');
    console.log('');

    // Print top hub pages
    console.log('🏆 Top Hub Pages:');
    const topPages = analysisResult.hubPages
      .sort((a, b) => b.score.total - a.score.total)
      .slice(0, 5);

    for (let i = 0; i < topPages.length; i++) {
      const page = topPages[i];
      console.log(`   ${i + 1}. ${page.title} (${page.score.total}/100)`);
      console.log(`      ${page.clusterName}`);
    }

    console.log('\n✨ Done! Check the output/ directory for results.\n');
  } catch (error) {
    logger.error('Pipeline failed:', error as Error);
    console.log('\n❌ Pipeline failed. Check the error message above for details.\n');
    process.exit(1);
  }
}

// Run the pipeline
main();
