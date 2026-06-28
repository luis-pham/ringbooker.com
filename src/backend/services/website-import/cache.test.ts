import test from 'node:test';
import assert from 'node:assert/strict';

import { clearWebsiteImportCache, importWebsiteWithCache } from './cache';
import type { WebsiteImportResult } from './types';

function result(overrides: Partial<WebsiteImportResult> = {}): WebsiteImportResult {
  return {
    ok: true,
    suggestions: {
      status: 'success',
      sourceUrl: 'https://demo.test',
      sourceType: 'normal_website',
      warnings: [],
      businessProfile: {
        name: { value: 'Demo Salon', confidence: 0.8, source: 'Website' },
        primaryType: { value: null, confidence: 0, source: null },
        phone: { value: null, confidence: 0, source: null },
        website: { value: 'https://demo.test', confidence: 0.8, source: 'Website' },
        address: { value: null, confidence: 0, source: null },
        timezone: { value: null, confidence: 0, source: null },
      },
      hours: { value: null, confidence: 0, source: null },
      serviceCatalog: { confidence: 0, source: null, categories: [], services: [] },
      alsoOffers: [],
      bookingUrl: { value: null, confidence: 0, source: null },
      languages: [],
      staffSuggestions: [],
      policySuggestions: [],
      faqSuggestions: [],
      promotionSuggestions: [],
      bookingSetupSuggestions: [],
      completeness: {
        businessProfileCompleteness: 0,
        contactCompleteness: 0,
        hoursCompleteness: 0,
        serviceCompleteness: 0,
        overallConfidence: 0,
        missingFields: [],
        lowConfidenceFields: [],
        recommendedNextAction: 'ready_for_review',
      },
    },
    diagnostics: {
      selectedPages: [],
      skippedPagesSummary: [],
      sitemapSourcesFound: [],
      serviceHubPagesFound: [],
      childServicePagesFound: [],
      confidenceSummary: {},
      warnings: [],
      fallbackUsed: ['static'],
    },
    ...overrides,
  };
}

test('website import cache reuses normal successful imports', async () => {
  clearWebsiteImportCache();
  let calls = 0;
  const run = () => importWebsiteWithCache({ url: 'https://demo.test', qualityBudgetMs: 1000 }, async () => {
    calls += 1;
    return result();
  });

  await run();
  await run();

  assert.equal(calls, 1);
});

test('website import cache does not store incomplete JS-rendered static results', async () => {
  clearWebsiteImportCache();
  let calls = 0;
  const run = () => importWebsiteWithCache({ url: 'https://square-spa.test', qualityBudgetMs: 1000 }, async () => {
    calls += 1;
    return result({
      diagnostics: {
        selectedPages: [],
        skippedPagesSummary: [],
        sitemapSourcesFound: [],
        serviceHubPagesFound: [],
        childServicePagesFound: [],
        confidenceSummary: {},
        warnings: [
          'Site appears to be a JavaScript-rendered site (square_weebly). Extracted content may be incomplete — configure a headless-render service (WEBSITE_IMPORT_RENDER_URL) for full extraction.',
        ],
        fallbackUsed: ['static'],
      },
    });
  });

  await run();
  await run();

  assert.equal(calls, 2);
});
