import test from 'node:test';
import assert from 'node:assert/strict';

import { importWebsiteForOnboarding } from './importer';
import { buildLlmImportPayload } from './llm';
import { previewHtml } from './html';

function response(body: string, url: string, type = 'text/html') {
  return new Response(body, { status: 200, headers: { 'content-type': type } }) as Response & { url: string };
}

const lookup = async () => [{ address: '93.184.216.34', family: 4 }];

test('normal website import discovers service hub and child service pages', async () => {
  const html: Record<string, string> = {
    'https://demo.test': '<html><head><title>Demo Salon</title></head><body><h1>Demo Salon</h1><a href="/salon">Services</a><a href="/contact">Contact</a></body></html>',
    'https://demo.test/robots.txt': 'Sitemap: https://demo.test/sitemap.xml',
    'https://demo.test/sitemap.xml': '<urlset><url><loc>https://demo.test/salon</loc></url><url><loc>https://demo.test/blog/story</loc></url></urlset>',
    'https://demo.test/salon': '<h1>Salon Services</h1><a href="/salon/balayage">Balayage</a><p>Haircut $55 45 minutes</p>',
    'https://demo.test/salon/balayage': '<h1>Balayage</h1><p>Balayage starts at $180 120 minutes.</p>',
    'https://demo.test/contact': '<h1>Contact</h1><p>Call (555) 111-2222</p>',
  };
  const result = await importWebsiteForOnboarding({ url: 'https://demo.test' }, {
    lookup,
    fetcher: async (url) => response(html[url] ?? '', url, url.endsWith('.xml') ? 'application/xml' : 'text/html'),
  });
  assert.equal(result.ok, true);
  assert.ok(result.suggestions.serviceCatalog.services.some((service) => service.name.toLowerCase().includes('balayage')));
  assert.ok(result.diagnostics.serviceHubPagesFound.some((url) => url.includes('/salon')));
  assert.ok(result.diagnostics.childServicePagesFound.some((url) => url.includes('/salon/balayage')));
});

test('selected service child pages are fetched even when outside initial preview window', async () => {
  const fillerLinks = Array.from({ length: 30 }, (_, index) => `<a href="/page-${index}">About ${index}</a>`).join('');
  const html: Record<string, string> = {
    'https://late-child.test/': `<html><head><title>Late Child Salon</title></head><body><h1>Late Child Salon</h1>${fillerLinks}<a href="/services/balayage">Balayage</a></body></html>`,
    'https://late-child.test/robots.txt': '',
    'https://late-child.test/services/balayage': '<h1>Balayage</h1><p>Balayage starts at $180 120 minutes.</p>',
  };
  const result = await importWebsiteForOnboarding({ url: 'https://late-child.test' }, {
    lookup,
    fetcher: async (url) => response(html[url] ?? '<h1>About</h1>', url),
  });
  const balayage = result.suggestions.serviceCatalog.services.find((service) => service.name === 'Balayage');
  assert.equal(balayage?.priceAmount, 180);
});

test('normal website import probes common services path when homepage does not link it', async () => {
  const html: Record<string, string> = {
    'https://env.test/': '<html><head><title>enV salon</title></head><body><h1>enV salon</h1><p>An Aveda Concept Salon</p></body></html>',
    'https://env.test/robots.txt': '',
    'https://env.test/services': '<h1>Services</h1><h2>Color</h2><p>Face Frame Retouch Color Retouch Corrective Color Partial Highlight Full Highlight</p><h2>Hair Cuts</h2><p>Women Men Children Bang Trim Beard Trim Consultation</p><h2>Nails</h2><p>Manicure Pedicure</p>',
    'https://env.test/services/': '<h1>Services</h1><h2>Color</h2><p>Face Frame Retouch Color Retouch Corrective Color Partial Highlight Full Highlight</p><h2>Hair Cuts</h2><p>Women Men Children Bang Trim Beard Trim Consultation</p><h2>Nails</h2><p>Manicure Pedicure</p>',
  };
  const result = await importWebsiteForOnboarding({ url: 'https://env.test' }, {
    lookup,
    fetcher: async (url) => response(html[url] ?? '<h1>Not found</h1>', url),
  });
  assert.ok(result.suggestions.serviceCatalog.services.some((service) => service.categoryName === 'Color' && service.name === 'Color Retouch'));
  assert.ok(result.suggestions.serviceCatalog.services.some((service) => service.categoryName === 'Hair Cuts' && service.name === 'Women'));
  assert.ok(result.diagnostics.serviceHubPagesFound.some((url) => url.includes('/services')));
});

test('normal website import from a services URL still reads root homepage footer hours', async () => {
  const html: Record<string, string> = {
    'https://deep-hours.test/services/': '<html><head><title>Deep Hours Services</title></head><body><h1>Services</h1><p>Balayage starts at $180.</p></body></html>',
    'https://deep-hours.test/': '<html><head><title>Deep Hours Salon</title></head><body><h1>Deep Hours Salon</h1><footer><h2>Hours</h2><p>Monday 10 AM - 8 PM</p><p>Closed Sunday</p></footer></body></html>',
    'https://deep-hours.test/robots.txt': '',
  };
  const result = await importWebsiteForOnboarding({ url: 'https://deep-hours.test/services/' }, {
    lookup,
    fetcher: async (url) => response(html[url] ?? '<h1>Not found</h1>', url),
  });
  assert.deepEqual(result.suggestions.hours.value?.mon, { open: '10:00', close: '20:00' });
  assert.deepEqual(result.suggestions.hours.value?.sun, { closed: true });
});

test('normal website import probes common artists path for staff suggestions', async () => {
  const html: Record<string, string> = {
    'https://artists.test/': '<html><head><title>Artist Salon</title></head><body><h1>Artist Salon</h1><p>Hair salon.</p></body></html>',
    'https://artists.test/robots.txt': '',
    'https://artists.test/artists': '<html><head><title>Artists - Artist Salon</title></head><body class="artists"><div class="flexible-column-wrapper"><h3>Danielle</h3></div><div class="flexible-column-wrapper"><h3>Maryann</h3><p>Senior color artist.</p></div></body></html>',
    'https://artists.test/artists/': '<html><head><title>Artists - Artist Salon</title></head><body class="artists"><div class="flexible-column-wrapper"><h3>Danielle</h3></div><div class="flexible-column-wrapper"><h3>Maryann</h3><p>Senior color artist.</p></div></body></html>',
  };
  const result = await importWebsiteForOnboarding({ url: 'https://artists.test' }, {
    lookup,
    fetcher: async (url) => response(html[url] ?? '<h1>Not found</h1>', url),
  });
  assert.ok(result.suggestions.staffSuggestions.some((staff) => staff.name === 'Danielle'));
  assert.equal(result.suggestions.staffSuggestions.find((staff) => staff.name === 'Maryann')?.bio, 'Senior color artist.');
  assert.equal(result.suggestions.staffSuggestions.some((staff) => /Artists?|Salon/i.test(staff.name)), false);
  assert.ok(result.diagnostics.selectedPages.some((page) => page.bucket === 'staff_team' && page.url.includes('/artists')));
});

test('WordPress-style trailing slash redirects are followed without normalization loops', async () => {
  const html: Record<string, string> = {
    'https://slash.test/': '<h1>Slash Salon</h1><a href="/services/balayage">Balayage</a>',
    'https://slash.test/robots.txt': '',
    'https://slash.test/services/balayage/': '<h1>Balayage</h1><h2>Balayage Pricing</h2><p>Assistant stylists $ 180</p><p>Level 1 stylists $ 220</p>',
  };
  const result = await importWebsiteForOnboarding({ url: 'https://slash.test' }, {
    lookup,
    fetcher: async (url) => {
      if (url === 'https://slash.test/services/balayage') {
        return new Response('', { status: 301, headers: { location: 'https://slash.test/services/balayage/' } });
      }
      return response(html[url] ?? '<h1>Other</h1>', url);
    },
  });
  const balayage = result.suggestions.serviceCatalog.services.find((service) => service.name === 'Balayage');
  assert.equal(balayage?.priceAmount, 180);
});

test('platform domains skip deep crawl and preserve platform URL as booking URL fallback', async () => {
  const result = await importWebsiteForOnboarding({ url: 'https://booksy.com/shop/example' }, {
    lookup,
    fetcher: async (url) => response('<h1>Booksy Profile</h1>', url),
  });
  assert.equal(result.diagnostics.skippedPagesSummary[0], 'Platform/social URLs are not recursively crawled.');
  assert.equal(result.suggestions.bookingUrl.value, 'https://booksy.com/shop/example');
});


test('redirect to private IP is rejected safely', async () => {
  const result = await importWebsiteForOnboarding({ url: 'https://safe.test' }, {
    lookup,
    fetcher: async (url) => {
      if (url === 'https://safe.test/') return new Response('', { status: 302, headers: { location: 'http://127.0.0.1/private' } });
      return response('<h1>Should not fetch</h1>', url);
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.selectedPages.length, 0);
});

test('oversized response is rejected before extraction', async () => {
  const result = await importWebsiteForOnboarding({ url: 'https://large.test' }, {
    lookup,
    maxBytes: 32,
    fetcher: async (url) => response('<h1>Large Salon</h1>'.padEnd(128, 'x'), url),
  });
  assert.equal(result.ok, false);
  assert.equal(result.suggestions.status, 'failed');
});

test('default response-size cap accepts large Wix-style pages under configured limit', async () => {
  const largeWixLikePage = '<html><head><title>Large Wix Salon</title></head><body><h1>Large Wix Salon</h1><p>Call (555) 444-5555</p></body></html>'.padEnd(900_000, ' ');
  const result = await importWebsiteForOnboarding({ url: 'https://large-wix.test' }, {
    lookup,
    fetcher: async (url) => response(url.endsWith('/robots.txt') || url.endsWith('.xml') ? '' : largeWixLikePage, url, url.endsWith('.xml') ? 'application/xml' : 'text/html'),
  });
  assert.equal(result.ok, true);
  assert.equal(result.suggestions.businessProfile.name.value, 'Large Wix Salon');
  assert.equal(result.suggestions.businessProfile.phone.value, '+15554445555');
});

test('Google Places unavailable does not fail static import', async () => {
  const result = await importWebsiteForOnboarding({ url: 'https://demo.test' }, {
    lookup,
    fetcher: async (url) => response(url.endsWith('/robots.txt') ? '' : '<h1>Static Salon</h1><p>Call (555) 333-4444</p>', url),
  });
  assert.equal(result.ok, true);
  assert.equal(result.suggestions.businessProfile.name.value, 'Static Salon');
  assert.equal(result.suggestions.businessProfile.name.confidence > 0, true);
  assert.equal(result.suggestions.businessProfile.name.source, 'Website');
});

test('Google Maps URL can use Google Places without readable profile page', async () => {
  const result = await importWebsiteForOnboarding({ url: 'https://maps.google.com/?q=glow' }, {
    lookup,
    googlePlacesApiKey: 'test-key',
    fetcher: async (url) => {
      if (url.includes('places.googleapis.com')) {
        return new Response(JSON.stringify({ places: [{ displayName: { text: 'Glow Nail Spa' }, nationalPhoneNumber: '(555) 123-4567', formattedAddress: '123 Main St, Los Angeles, CA', regularOpeningHours: { periods: [{ open: { day: 1, hour: 9, minute: 0 }, close: { day: 1, hour: 19, minute: 0 } }] } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('', { status: 404, headers: { 'content-type': 'text/html' } });
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.suggestions.businessProfile.name.value, 'Glow Nail Spa');
  assert.equal(result.suggestions.businessProfile.name.source, 'Google Places');
  assert.equal(result.suggestions.hours.source, 'Google Places');
});

test('normal website with matching domain uses Google Places for contact and keeps website services', async () => {
  const result = await importWebsiteForOnboarding({ url: 'https://glow.test' }, {
    lookup,
    googlePlacesApiKey: 'test-key',
    fetcher: async (url) => {
      if (url.includes('places.googleapis.com')) {
        return new Response(JSON.stringify({ places: [{ displayName: { text: 'Glow Nail Spa' }, nationalPhoneNumber: '+15559990000', formattedAddress: '123 Main St, Los Angeles, CA', websiteUri: 'https://glow.test', primaryTypeDisplayName: { text: 'Nail salon' }, types: ['nail_salon'], regularOpeningHours: { periods: [{ open: { day: 1, hour: 9, minute: 0 }, close: { day: 1, hour: 19, minute: 0 } }] } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return response(url.endsWith('/robots.txt') ? '' : '<h1>Glow Nail Spa</h1><p>Call (555) 111-2222</p><p>Gel Manicure $45 45 minutes</p>', url);
    },
  });
  assert.equal(result.suggestions.businessProfile.phone.value, '+15559990000');
  assert.equal(result.suggestions.businessProfile.phone.source, 'Google Places');
  assert.equal(result.suggestions.hours.source, 'Google Places');
  assert.ok(result.suggestions.warnings.some((warning) => /phone differs/i.test(warning)));
  assert.ok(result.suggestions.serviceCatalog.services.some((service) => service.name.includes('Gel Manicure')));
  assert.equal(JSON.stringify(result.suggestions).includes('test-key'), false);
});

test('ambiguous normal website Places matches do not blindly overwrite static details', async () => {
  const result = await importWebsiteForOnboarding({ url: 'https://ambiguous.test' }, {
    lookup,
    googlePlacesApiKey: 'test-key',
    fetcher: async (url) => {
      if (url.includes('places.googleapis.com')) {
        return new Response(JSON.stringify({ places: [
          { displayName: { text: 'Other Spa' }, nationalPhoneNumber: '(555) 222-2222', formattedAddress: '1 Main St, Dallas, TX', websiteUri: 'https://other.test' },
          { displayName: { text: 'Another Spa' }, nationalPhoneNumber: '(555) 333-3333', formattedAddress: '2 Main St, Dallas, TX', websiteUri: 'https://another.test' },
        ] }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return response(url.endsWith('/robots.txt') ? '' : '<h1>Ambiguous Salon</h1><p>Call (555) 111-1111</p><p>Facial $90</p>', url);
    },
  });
  assert.equal(result.suggestions.businessProfile.phone.value, '+15551111111');
  assert.equal(result.suggestions.businessProfile.phone.source, 'Website');
  assert.ok(result.suggestions.warnings.some((warning) => /Multiple possible Google Places/i.test(warning)));
});

test('LLM disabled keeps static import path', async () => {
  let openAiCalled = false;
  const result = await importWebsiteForOnboarding({ url: 'https://static-only.test' }, {
    lookup,
    llmEnabled: false,
    openAiApiKey: 'openai-test',
    fetcher: async (url) => {
      if (url.includes('api.openai.com')) openAiCalled = true;
      return response(url.endsWith('/robots.txt') ? '' : '<h1>Static Only Salon</h1><p>Haircut $55</p>', url);
    },
  });
  assert.equal(openAiCalled, false);
  assert.equal(result.suggestions.businessProfile.name.value, 'Static Only Salon');
});

test('LLM success merges grouped services and starts-at prices', async () => {
  const llmPayload = {
    businessProfile: { name: { value: 'AI Salon', confidence: 0.8, sourceEvidence: ['h1'] }, primaryType: { value: 'hair_salon', confidence: 0.8, sourceEvidence: ['copy'] } },
    serviceCatalog: {
      confidence: 0.9,
      categories: [{ name: 'Hair Color', confidence: 0.9, groupKind: 'primary' }],
      services: [{ groupName: 'Hair Color', name: 'Balayage', priceAmount: 180, priceCurrency: 'USD', priceType: 'from', durationText: '1 hour+', durationMinutes: 60, aliases: [], bookable: true, confidence: 0.92, sourceEvidence: ['service page'] }],
    },
    staffSuggestions: [{ name: 'Mia Chen', role: 'Stylist', specialties: ['Color'], confidence: 0.84, evidenceSnippet: 'Mia Chen - Stylist' }],
    policySuggestions: [{ type: 'cancellation', title: 'Cancellation policy', content: 'Please cancel 24 hours ahead.', confidence: 0.8, evidenceSnippet: 'cancel 24 hours' }],
    faqSuggestions: [{ question: 'Do you take walk-ins?', answer: 'Walk-ins are welcome when available.', confidence: 0.82, evidenceSnippet: 'Walk-ins are welcome' }],
    bookingSetupSuggestions: [{ type: 'booking_platform', label: 'Book on Vagaro', value: 'https://vagaro.com/demo', platform: 'vagaro', confidence: 0.86 }],
    warnings: [],
  };
  const result = await importWebsiteForOnboarding({ url: 'https://llm.test' }, {
    lookup,
    llmEnabled: true,
    openAiApiKey: 'openai-test',
    fetcher: async (url) => {
      if (url.includes('api.openai.com')) return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(llmPayload) } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
      return response(url.endsWith('/robots.txt') ? '' : '<h1>AI Salon</h1><p>Color services available.</p>', url);
    },
  });
  const service = result.suggestions.serviceCatalog.services.find((item) => item.name === 'Balayage');
  assert.equal(service?.source, 'AI');
  assert.equal(service?.categoryName, 'Hair Color');
  assert.equal(service?.priceType, 'from');
  assert.equal(service?.durationText, '1 hour+');
  assert.equal(service?.durationMinutes, 60);
  assert.equal(result.suggestions.staffSuggestions[0]?.name, 'Mia Chen');
  assert.equal(result.suggestions.policySuggestions[0]?.type, 'cancellation');
  assert.equal(result.suggestions.faqSuggestions[0]?.question, 'Do you take walk-ins?');
  assert.equal(result.suggestions.bookingSetupSuggestions[0]?.platform, 'vagaro');
  assert.equal(result.diagnostics.fallbackUsed.includes('llm'), true);
  assert.equal(JSON.stringify(result.suggestions).includes('openai-test'), false);
});

test('merge cleans LLM service names that include bullet descriptions and duration', async () => {
  const llmPayload = {
    serviceCatalog: {
      confidence: 0.9,
      categories: [{ name: 'Blowouts', confidence: 0.9, groupKind: 'primary' }],
      services: [{
        categoryName: 'General Services',
        name: 'Blowout Essential Blowout Shampoo & Condition • Smooth Blow Dry • 30 min+',
        priceAmount: null,
        priceCurrency: 'USD',
        priceType: 'varies',
        aliases: [],
        bookable: true,
        confidence: 0.92,
        sourceEvidence: ['service page'],
      }],
    },
    warnings: [],
  };
  const result = await importWebsiteForOnboarding({ url: 'https://llm-bullets.test' }, {
    lookup,
    llmEnabled: true,
    openAiApiKey: 'openai-test',
    fetcher: async (url) => {
      if (url.includes('api.openai.com')) return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(llmPayload) } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
      return response(url.endsWith('/robots.txt') ? '' : '<h1>Blowout Salon</h1><p>Blowout services.</p>', url);
    },
  });
  const service = result.suggestions.serviceCatalog.services.find((item) => item.name === 'Essential Blowout');
  assert.equal(service?.categoryName, 'Blowout');
  assert.equal(service?.description, 'Shampoo & Condition • Smooth Blow Dry');
  assert.equal(service?.durationText, '30 min+');
  assert.equal(result.suggestions.serviceCatalog.services.some((item) => /Smooth Blow Dry|30 min/i.test(item.name)), false);
});

test('invalid LLM secondary suggestion fields are dropped safely', async () => {
  const result = await importWebsiteForOnboarding({ url: 'https://secondary-invalid.test' }, {
    lookup,
    llmEnabled: true,
    openAiApiKey: 'openai-test',
    fetcher: async (url) => {
      if (url.includes('api.openai.com')) return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
        businessProfile: { name: { value: 'Secondary Invalid Salon', confidence: 0.8, sourceEvidence: [] } },
        staffSuggestions: [{ name: 'Valid Stylist', confidence: 0.8 }, { name: '', confidence: 2 }],
        policySuggestions: [{ type: 'made_up', title: 'Bad', content: 'Bad', confidence: 0.9 }],
      }) } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
      return response(url.endsWith('/robots.txt') ? '' : '<h1>Secondary Invalid Salon</h1><p>Haircut $55</p>', url);
    },
  });
  assert.equal(result.suggestions.staffSuggestions[0]?.name, undefined);
  assert.equal(result.suggestions.policySuggestions.length, 0);
  assert.equal(result.suggestions.businessProfile.name.value, 'Secondary Invalid Salon');
});

test('invalid LLM JSON falls back safely to static import', async () => {
  const result = await importWebsiteForOnboarding({ url: 'https://bad-llm.test' }, {
    lookup,
    llmEnabled: true,
    openAiApiKey: 'openai-test',
    fetcher: async (url) => {
      if (url.includes('api.openai.com')) return new Response(JSON.stringify({ choices: [{ message: { content: 'not-json' } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
      return response(url.endsWith('/robots.txt') ? '' : '<h1>Bad LLM Salon</h1><p>Massage $100</p>', url);
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.suggestions.businessProfile.name.value, 'Bad LLM Salon');
  assert.equal(result.diagnostics.fallbackUsed.includes('llm'), false);
});

test('invalid LLM schema falls back safely to static import', async () => {
  const result = await importWebsiteForOnboarding({ url: 'https://invalid-schema.test' }, {
    lookup,
    llmEnabled: true,
    openAiApiKey: 'openai-test',
    fetcher: async (url) => {
      if (url.includes('api.openai.com')) return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ serviceCatalog: { confidence: 1.2, services: [{ name: 'Bad Price', priceType: 'free', confidence: 2 }] } }) } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
      return response(url.endsWith('/robots.txt') ? '' : '<h1>Schema Fallback Salon</h1><p>Facial $90</p>', url);
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.suggestions.businessProfile.name.value, 'Schema Fallback Salon');
  assert.equal(result.diagnostics.fallbackUsed.includes('llm'), false);
  assert.equal(result.suggestions.serviceCatalog.services.some((service) => service.name === 'Bad Price'), false);
});

test('LLM missing fields do not invent values', async () => {
  const result = await importWebsiteForOnboarding({ url: 'https://missing-llm.test' }, {
    lookup,
    llmEnabled: true,
    openAiApiKey: 'openai-test',
    fetcher: async (url) => {
      if (url.includes('api.openai.com')) return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ businessProfile: { phone: { value: null, confidence: 0, sourceEvidence: [] } }, warnings: [] }) } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
      return response(url.endsWith('/robots.txt') ? '' : '<h1>Missing Fields Salon</h1><p>Services available</p>', url);
    },
  });
  assert.equal(result.suggestions.businessProfile.phone.value, null);
});

test('LLM payload includes structured page context and deterministic facts without raw scripts', () => {
  const preview = previewHtml('<html><head><script>alert("x")</script><script type="application/ld+json">{"@type":"NailSalon","name":"Payload Salon","telephone":"555-111-2222"}</script></head><body><h1>Payload Salon</h1><a href="/book">Book now</a><p>Call (555) 111-2222. Monday-Friday 9am-7pm. 123 Main Street Los Angeles CA.</p></body></html>', 'https://payload.test');
  const payload = buildLlmImportPayload({
    sourceUrl: 'https://payload.test',
    previews: [preview],
    selectedPages: [{ url: 'https://payload.test', bucket: 'homepage', score: 100, source: 'homepage', reason: 'test' }],
  });
  assert.equal(payload.pages[0]?.bucket, 'homepage');
  assert.ok(payload.deterministicFacts.phoneCandidates.includes('(555) 111-2222'));
  assert.ok(payload.deterministicFacts.bookingUrlCandidates.some((url) => url.includes('/book')));
  assert.equal(JSON.stringify(payload).includes('alert("x")'), false);
});

test('LLM payload includes staff page hints for artist analysis', () => {
  const preview = previewHtml(
    '<html><head><title>Artists - enV salon</title></head><body class="artists"><div class="flexible-column-wrapper"><h3>Danielle</h3><p>Color artist and stylist.</p></div></body></html>',
    'https://artist-payload.test/artists',
  );
  const payload = buildLlmImportPayload({
    sourceUrl: 'https://artist-payload.test',
    previews: [preview],
    selectedPages: [{ url: 'https://artist-payload.test/artists', bucket: 'staff_team', score: 80, source: 'nav', reason: 'Staff/team signals' }],
  });
  assert.equal(payload.secondaryKnowledgeHints.staffPages[0]?.bucket, 'staff_team');
  assert.match(payload.secondaryKnowledgeHints.staffPages[0]?.text ?? '', /STAFF_MEMBER:\s*Danielle/i);
  assert.match(payload.schemaHint, /staffSuggestions/i);
  assert.match(payload.schemaHint, /bio/i);
});

test('completeness scoring marks missing hours and weak services for review', async () => {
  const result = await importWebsiteForOnboarding({ url: 'https://partial.test' }, {
    lookup,
    fetcher: async (url) => response(url.endsWith('/robots.txt') ? '' : '<h1>Partial Salon</h1><p>Massage available</p>', url),
  });
  assert.ok(result.suggestions.completeness?.missingFields.includes('hours'));
  assert.equal(result.suggestions.completeness?.recommendedNextAction, 'needs_manual_review');
});

test('fetch follows no more than five redirects', async () => {
  let fetchCount = 0;
  const result = await importWebsiteForOnboarding({ url: 'https://redirect.test' }, {
    lookup,
    fetcher: async (url) => {
      fetchCount += 1;
      const current = new URL(url);
      const n = Number(current.searchParams.get('n') ?? '0');
      if (n < 6) return new Response('', { status: 302, headers: { location: `https://redirect.test/?n=${n + 1}` } });
      return response('<h1>Should Not Reach</h1>', url);
    },
  });
  assert.equal(result.ok, false);
  assert.equal(fetchCount, 6); // Initial request plus exactly five followed redirects.
});


test('missing response body fails safely without unbounded text fallback', async () => {
  const responseWithoutBody = new Response(null, { status: 200, headers: { 'content-type': 'text/html' } }) as Response & { url: string };
  const result = await importWebsiteForOnboarding({ url: 'https://nobody.test' }, {
    lookup,
    fetcher: async () => responseWithoutBody,
  });
  assert.equal(result.ok, false);
  assert.equal(result.suggestions.status, 'failed');
});
