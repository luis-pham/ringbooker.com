import test from 'node:test';
import assert from 'node:assert/strict';

import { importWebsiteForOnboarding } from './importer';
import { buildLlmImportPayload, parseLlmImportJson } from './llm';
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

test('renders a thin JS site for extraction even when its builder is not recognized', async () => {
  const renderEndpoint = 'https://render.test/content';
  const thinHomepage = '<html><head><title>SPA Salon</title></head><body><div id="page"></div></body></html>';
  // Rendered output must exceed the thin-content threshold (>1000 chars of text) to be kept.
  const filler = '<p>Our experienced stylists provide premium salon services in a relaxing environment. Walk-ins welcome and appointments recommended for the best experience.</p>'.repeat(8);
  const renderedHomepage = `<html><body><h1>SPA Salon</h1><h2>Services</h2><p>Gel Manicure $45 45 minutes</p><p>Deluxe Pedicure $65 60 minutes</p><p>Signature Facial $85 60 minutes</p>${filler}</body></html>`;
  const html: Record<string, string> = {
    'https://spa-thin.test': thinHomepage,
    'https://spa-thin.test/robots.txt': '',
  };
  const result = await importWebsiteForOnboarding({ url: 'https://spa-thin.test' }, {
    lookup,
    renderEndpoint,
    fetcher: async (url) => (url === renderEndpoint ? response(renderedHomepage, url) : response(html[url] ?? '<h1>Not found</h1>', url)),
  });
  // The fix: render fires on any thin homepage, not only recognized builders (id="page"
  // is not detected as a known SPA builder, yet the JS-rendered content is recovered).
  assert.ok(result.diagnostics.fallbackUsed.includes('headless_render'), 'render should have been used for the thin unrecognized-builder site');
});

test('renders weak Square/SPA child menu and staff pages selected from sitemap', async () => {
  const renderEndpoint = 'https://render-square.test/content';
  const squareShell = (title: string) => `<html><head><title>${title}</title><script>window.__BOOTSTRAP_STATE__ = {"siteData":{"site":{"properties":{"framework":{"name":"square"}}}}}</script></head><body><div id="app"></div></body></html>`;
  const html: Record<string, string> = {
    'https://square-spa.test/': squareShell('Home | Hair Syndicate 5 Salon and Spa'),
    'https://square-spa.test/robots.txt': 'Sitemap: https://square-spa.test/sitemap.xml',
    'https://square-spa.test/sitemap.xml': [
      '<urlset>',
      '<url><loc>https://square-spa.test/hairmenu</loc></url>',
      '<url><loc>https://square-spa.test/advanced-facials-menu</loc></url>',
      '<url><loc>https://square-spa.test/wax-lash-brow-menu</loc></url>',
      '<url><loc>https://square-spa.test/our-team</loc></url>',
      '</urlset>',
    ].join(''),
    'https://square-spa.test/hairmenu': squareShell('Hair Salon | Hair Syndicate 5 Salon and Spa'),
    'https://square-spa.test/advanced-facials-menu': squareShell('Advanced Facial Treatment Menu | Hair Syndicate 5 Salon and Spa'),
    'https://square-spa.test/wax-lash-brow-menu': squareShell('Lash, Brow, and Wax Menu | Hair Syndicate 5 Salon and Spa'),
    'https://square-spa.test/our-team': squareShell('Our Staff | Hair Syndicate 5 Salon and Spa'),
  };
  const rendered: Record<string, string> = {
    'https://square-spa.test/': '<html><body><h1>Hair Syndicate 5</h1><a href="/hairmenu">Hair Menu</a><a href="/our-team">Our Team</a></body></html>',
    'https://square-spa.test/hairmenu': '<html><head><title>Hair Salon</title></head><body><h1>Hair Menu</h1><h2>Hair Services</h2><table><tr><td>Adult Hair Cut</td><td>$25</td></tr><tr><td>Balayage</td><td>$160</td></tr></table></body></html>',
    'https://square-spa.test/advanced-facials-menu': '<html><head><title>Advanced Facial Treatment Menu</title></head><body><h1>Advanced Facials Menu</h1><h2>Facials</h2><table><tr><td>Deluxe Anti-Aging Facial</td><td>$120</td></tr></table></body></html>',
    'https://square-spa.test/wax-lash-brow-menu': '<html><head><title>Lash, Brow, and Wax Menu</title></head><body><h1>Wax Menu</h1><h2>Waxing</h2><table><tr><td>Brow Wax</td><td>$20</td></tr></table></body></html>',
    'https://square-spa.test/our-team': '<html><head><title>Our Staff</title></head><body><h1>Our Staff</h1><section><h2>Meet Our Team</h2><div class="team-member"><h3>Cassandra</h3><small>Massage Therapist</small><p>Licensed massage therapist.</p></div></section></body></html>',
  };
  const renderCalls: string[] = [];
  const result = await importWebsiteForOnboarding({ url: 'https://square-spa.test' }, {
    lookup,
    renderEndpoint,
    fetcher: async (url, init) => {
      if (url === renderEndpoint) {
        const body = JSON.parse(String(init?.body ?? '{}')) as { url?: string };
        const target = body.url ?? '';
        renderCalls.push(target);
        return response(rendered[target] ?? '<html><body><h1>Not found</h1></body></html>', url);
      }
      return response(html[url] ?? '<h1>Not found</h1>', url, url.endsWith('.xml') ? 'application/xml' : 'text/html');
    },
  });

  const serviceNames = result.suggestions.serviceCatalog.services.map((service) => service.name);
  assert.ok(renderCalls.some((url) => url.endsWith('/hairmenu')));
  assert.ok(renderCalls.some((url) => url.endsWith('/our-team')));
  assert.ok(result.diagnostics.selectedPages.some((page) => page.url.endsWith('/hairmenu')));
  assert.ok(result.diagnostics.selectedPages.some((page) => page.url.endsWith('/our-team')));
  assert.ok(serviceNames.includes('Adult Hair Cut'));
  assert.ok(serviceNames.includes('Balayage'));
  assert.ok(result.suggestions.staffSuggestions.some((staff) => staff.name === 'Cassandra'));
  assert.ok(result.diagnostics.fallbackUsed.includes('headless_render'));
});

test('extracts Square/Weebly quill state when rendered DOM remains empty', async () => {
  const renderEndpoint = 'https://render-square-state.test/content';
  const squareShell = (title: string) => `<html><head><title>${title}</title><script>window.__BOOTSTRAP_STATE__ = {"siteData":{"site":{"properties":{"framework":{"name":"square"}}}}}</script></head><body><div id="app"></div></body></html>`;
  const statePage = (title: string, inserts: string[]) => `<html><head><title>${title}</title></head><body><script>window.__BOOTSTRAP_STATE__ = ${JSON.stringify({
    page: {
      cells: inserts.map((insert) => ({
        content: { properties: { textConfig: { content: { quill: { ops: [{ insert }] } } } } },
      })),
    },
  })}</script></body></html>`;
  const html: Record<string, string> = {
    'https://square-state.test/': squareShell('Home | Hair Syndicate 5 Salon and Spa'),
    'https://square-state.test/robots.txt': 'Sitemap: https://square-state.test/sitemap.xml',
    'https://square-state.test/sitemap.xml': [
      '<urlset>',
      '<url><loc>https://square-state.test/hairmenu</loc></url>',
      '<url><loc>https://square-state.test/our-team</loc></url>',
      '</urlset>',
    ].join(''),
    'https://square-state.test/hairmenu': squareShell('Hair Salon | Hair Syndicate 5 Salon and Spa'),
    'https://square-state.test/our-team': squareShell('Our Staff | Hair Syndicate 5 Salon and Spa'),
  };
  const rendered: Record<string, string> = {
    'https://square-state.test/hairmenu': statePage('Hair Salon | Hair Syndicate 5 Salon and Spa', [
      "Adult Hair Cut - 25 and up\nLong Hair Cuts - 30 and up\nChildren's Cuts - 22\nBalayage - 160 and up\n",
    ]),
    'https://square-state.test/our-team': statePage('Our Staff | Hair Syndicate 5 Salon and Spa', [
      'Cassandra is a licensed massage therapist who has been involved in massage for over five years.',
    ]),
  };
  const result = await importWebsiteForOnboarding({ url: 'https://square-state.test' }, {
    lookup,
    renderEndpoint,
    fetcher: async (url, init) => {
      if (url === renderEndpoint) {
        const body = JSON.parse(String(init?.body ?? '{}')) as { url?: string };
        return response(rendered[body.url ?? ''] ?? squareShell('Rendered Home'), url);
      }
      return response(html[url] ?? '<h1>Not found</h1>', url, url.endsWith('.xml') ? 'application/xml' : 'text/html');
    },
  });

  assert.ok(result.diagnostics.fallbackUsed.includes('headless_render'));
  assert.ok(result.suggestions.serviceCatalog.services.some((service) => service.name === 'Adult Hair Cut' && service.priceAmount === 25));
  assert.ok(result.suggestions.serviceCatalog.services.some((service) => service.name === 'Balayage' && service.priceAmount === 160));
  assert.equal(result.suggestions.staffSuggestions.find((staff) => staff.name === 'Cassandra')?.role, 'Massage Therapist');
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
  assert.ok(result.suggestions.serviceCatalog.services.some((service) => service.categoryName === 'Hair Color' && service.name === 'Color Retouch'));
  assert.ok(result.suggestions.serviceCatalog.services.some((service) => service.categoryName === 'Haircuts' && service.name === 'Women'));
  assert.ok(result.diagnostics.serviceHubPagesFound.some((url) => url.includes('/services')));
});

test('normal website import prefers appointment services page over ecommerce shop products', async () => {
  const html: Record<string, string> = {
    'https://ritual.test/': '<html><head><title>Ritual Hair Co.</title></head><body><h1>Ritual Hair Co.</h1><a href="/services">Services</a><a href="/shop">Shop</a><a href="/contact-1">Contact</a></body></html>',
    'https://ritual.test/robots.txt': '',
    'https://ritual.test/services': `<html><head><title>Services — Ritual Hair Co.</title></head><body><h2>Services</h2><h2>Haircuts</h2><p>► Short to Medium Length Haircut ► Medium to Long Haircut ► Curly Haircut ► Men's Haircut</p><h2>Color</h2><p>► Fair Color Consultation ► Root Color ► Full Highlight ► Full Balayage</p><h2>Styling</h2><p>► Blow Out Short To Medium Length ► Up-do</p><h2>Smoothing/Straightening Treatments</h2><p>► Organic Keratin Smoothing Treatment</p><h2>Hair Extensions</h2><p>► Hair Extension Consultation ► Tape Extensions Installation</p><h2>Signature Ritual Deep Conditioning Treatments</h2><p>► Signature Ritual Deep Conditioning Treatment</p></body></html>`,
    'https://ritual.test/shop': '<html><head><title>Shop — Ritual Hair Co.</title></head><body><h2>Shop</h2><div><h3>Instant Bonding Glow</h3><p>$48.00</p><button>Add to cart</button></div><div><h3>Silkening Shampoo</h3><p>$18.00</p><button>Add to cart</button></div><div><h3>Rich Conditioner</h3><p>$15.00</p><button>Add to cart</button></div><div><h3>Intense Treatment</h3><p>$18.00</p><button>Add to cart</button></div></body></html>',
    'https://ritual.test/contact-1': '<h1>Contact</h1><p>Call 214.814.1938</p>',
  };
  const result = await importWebsiteForOnboarding({ url: 'https://ritual.test' }, {
    lookup,
    fetcher: async (url) => response(html[url] ?? '<h1>Not found</h1>', url),
  });
  const serviceNames = result.suggestions.serviceCatalog.services.map((service) => service.name);
  assert.ok(result.diagnostics.serviceHubPagesFound.some((url) => url.endsWith('/services')));
  assert.equal(result.diagnostics.serviceHubPagesFound.some((url) => url.endsWith('/shop')), false);
  assert.ok(result.suggestions.serviceCatalog.categories.some((category) => category.name === 'Haircuts'));
  assert.ok(result.suggestions.serviceCatalog.categories.some((category) => category.name === 'Hair Color'));
  assert.ok(result.suggestions.serviceCatalog.categories.some((category) => category.name === 'Hair Extensions'));
  assert.ok(serviceNames.includes('Short to Medium Length Haircut'));
  assert.ok(serviceNames.includes('Root Color'));
  assert.ok(serviceNames.includes('Signature Ritual Deep Conditioning Treatment'));
  assert.equal(serviceNames.some((name) => /Instant Bonding Glow|Silkening Shampoo|Rich Conditioner|Intense Treatment/i.test(name)), false);
  const haircut = result.suggestions.serviceCatalog.services.find((service) => service.name === 'Short to Medium Length Haircut');
  assert.equal(haircut?.priceAmount, null);
  assert.equal(haircut?.durationMinutes, null);
  assert.equal(haircut?.needsReview, true);
});

test('service menu page outranks blog posts that only mention service in the URL', async () => {
  const html: Record<string, string> = {
    'https://indigo.test/': '<html><head><title>Indigo Child</title></head><body><h1>Indigo Child</h1><h2>Your cart is empty</h2><a href="/pages/service-menu">Service Menu</a><a href="/blogs/news/5-tips-on-how-to-prep-for-your-lightening-service">Prep for your lightening service</a></body></html>',
    'https://indigo.test/robots.txt': 'Sitemap: https://indigo.test/sitemap.xml',
    'https://indigo.test/sitemap.xml': '<urlset><url><loc>https://indigo.test/blogs/news/5-tips-on-how-to-prep-for-your-lightening-service</loc></url><url><loc>https://indigo.test/pages/service-menu</loc></url></urlset>',
    'https://indigo.test/pages/service-menu': '<html><head><title>Service Menu - Indigo Child</title></head><body><h2>Your cart is empty</h2><h2>Service Menu</h2><section><h2>Lightening + Color</h2><div class="multicolumn-card"><div><h3>Custom Lightening</h3><p>Price: $304 - $354+</p><p>Description: Highlighting service.</p><a>Book A Custom Lightening</a></div></div><div class="multicolumn-card"><div><h3>Tint Retouch</h3><p>Price $92 - $131+</p><p>Description: Root color maintenance.</p><a>Book A Tint Retouch</a></div></div></section></body></html>',
    'https://indigo.test/blogs/news/5-tips-on-how-to-prep-for-your-lightening-service': '<h1>5 tips on how to prep for your lightening service</h1><p>This article explains how to prepare for your appointment.</p>',
  };
  const result = await importWebsiteForOnboarding({ url: 'https://indigo.test' }, {
    lookup,
    fetcher: async (url) => response(html[url] ?? '<h1>Not found</h1>', url, url.endsWith('.xml') ? 'application/xml' : 'text/html'),
  });
  assert.ok(result.diagnostics.serviceHubPagesFound.some((url) => url.endsWith('/pages/service-menu')));
  assert.equal(result.diagnostics.serviceHubPagesFound.some((url) => url.includes('/blogs/news/')), false);
  assert.ok(result.suggestions.serviceCatalog.services.some((service) => service.name === 'Custom Lightening' && service.priceAmount === 304));
  assert.ok(result.suggestions.serviceCatalog.services.some((service) => service.name === 'Tint Retouch' && service.priceType === 'from'));
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

test('normal website import prioritizes policy pages from sitemap', async () => {
  const html: Record<string, string> = {
    'https://policy.test/': '<html><head><title>Policy Salon</title></head><body><h1>Policy Salon</h1><p>Hair salon.</p></body></html>',
    'https://policy.test/robots.txt': 'Sitemap: https://policy.test/sitemap.xml',
    'https://policy.test/sitemap.xml': '<urlset><url><loc>https://policy.test/privacy-policy</loc></url><url><loc>https://policy.test/about</loc></url></urlset>',
    'https://policy.test/privacy-policy': '<html><head><title>Salon Policies</title></head><body><h1>Salon Policies</h1><h2>Cancellation Policy</h2><p>Please cancel at least 24 hours before your appointment to avoid a cancellation fee.</p></body></html>',
  };
  const result = await importWebsiteForOnboarding({ url: 'https://policy.test' }, {
    lookup,
    fetcher: async (url) => response(html[url] ?? '<h1>Not found</h1>', url, url.endsWith('.xml') ? 'application/xml' : 'text/html'),
  });
  assert.ok(result.diagnostics.selectedPages.some((page) => page.bucket === 'policies' && page.url.endsWith('/privacy-policy')));
  assert.ok(result.suggestions.policySuggestions.some((policy) => policy.type === 'cancellation' && /24 hours/i.test(policy.content)));
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

test('merge canonicalizes equivalent hair service groups without dropping treatments', async () => {
  const llmPayload = {
    serviceCatalog: {
      confidence: 0.9,
      categories: [
        { name: 'Color', confidence: 0.86, groupKind: 'primary' },
        { name: 'Hair Color', confidence: 0.84, groupKind: 'primary' },
        { name: 'Cut', confidence: 0.84, groupKind: 'primary' },
      ],
      services: [
        { categoryName: 'Color', name: 'All Over Color', priceAmount: 138, priceCurrency: 'USD', priceType: 'from', durationText: null, durationMinutes: null, aliases: [], bookable: true, confidence: 0.9, sourceEvidence: ['service page'] },
        { categoryName: 'Hair Color', name: 'Creative Hair Color', priceAmount: 153, priceCurrency: 'USD', priceType: 'from', durationText: null, durationMinutes: null, aliases: [], bookable: true, confidence: 0.88, sourceEvidence: ['service page'] },
        { categoryName: 'Cut', name: 'Signature Haircut', priceAmount: 75, priceCurrency: 'USD', priceType: 'fixed', durationText: null, durationMinutes: null, aliases: [], bookable: true, confidence: 0.88, sourceEvidence: ['service page'] },
      ],
    },
    warnings: [],
  };
  const result = await importWebsiteForOnboarding({ url: 'https://group-alias.test' }, {
    lookup,
    llmEnabled: true,
    openAiApiKey: 'openai-test',
    fetcher: async (url) => {
      if (url.includes('api.openai.com')) return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(llmPayload) } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
      return response(url.endsWith('/robots.txt') ? '' : '<h1>RAW Hair</h1><h2>Treatments</h2><p>Keratin Treatment Botanical Hair Conditioning</p>', url);
    },
  });
  const groups = new Set(result.suggestions.serviceCatalog.services.map((service) => service.categoryName));
  assert.equal(groups.has('Color'), false);
  assert.equal(groups.has('Cut'), false);
  assert.equal(groups.has('Hair Color'), true);
  assert.equal(groups.has('Haircuts'), true);
  assert.equal(groups.has('Treatments'), true);
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

test('unparseable LLM output falls back safely to static import', async () => {
  // Recoverable shape drift (out-of-range confidences, bad enums) is now coerced rather than
  // discarded; this guards the remaining hard-failure path — output that is not valid JSON at all
  // must still leave the import on its static result instead of throwing.
  const result = await importWebsiteForOnboarding({ url: 'https://invalid-schema.test' }, {
    lookup,
    llmEnabled: true,
    openAiApiKey: 'openai-test',
    fetcher: async (url) => {
      if (url.includes('api.openai.com')) return new Response(JSON.stringify({ choices: [{ message: { content: 'Sorry, I cannot help with that. {not: valid json' } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
      return response(url.endsWith('/robots.txt') ? '' : '<h1>Schema Fallback Salon</h1><p>Facial $90</p>', url);
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.suggestions.businessProfile.name.value, 'Schema Fallback Salon');
  assert.equal(result.diagnostics.fallbackUsed.includes('llm'), false);
});

test('out-of-range LLM confidences and bad enums are coerced, not discarded', async () => {
  const result = await importWebsiteForOnboarding({ url: 'https://coerce-schema.test' }, {
    lookup,
    llmEnabled: true,
    openAiApiKey: 'openai-test',
    fetcher: async (url) => {
      if (url.includes('api.openai.com')) return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ serviceCatalog: { confidence: 1.2, services: [{ name: 'Signature Facial', priceType: 'free', confidence: 2 }] } }) } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
      return response(url.endsWith('/robots.txt') ? '' : '<h1>Coerce Salon</h1><p>Facial $90</p>', url);
    },
  });
  const facial = result.suggestions.serviceCatalog.services.find((service) => service.name === 'Signature Facial');
  assert.ok(facial, 'recoverable LLM service is salvaged');
  assert.equal(facial?.priceType, 'fixed');
  assert.equal(result.diagnostics.fallbackUsed.includes('llm'), true);
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

test('LLM payload includes structured service blocks before flattened text', () => {
  const preview = previewHtml('<html><body><h2>Blowout</h2><div class="wp-block-column"><h3>Essential Blowout</h3><p>Shampoo & Condition • Smooth Blow Dry • 30 min+</p></div></body></html>', 'https://blocks.test/services');
  const payload = buildLlmImportPayload({
    sourceUrl: 'https://blocks.test/services',
    previews: [preview],
    selectedPages: [{ url: 'https://blocks.test/services', bucket: 'service_hub', score: 90, source: 'nav', reason: 'Service hub' }],
  });
  assert.equal(payload.pages[0]?.serviceBlocks?.[0]?.groupHeading, 'Blowout');
  assert.equal(payload.pages[0]?.serviceBlocks?.[0]?.serviceName, 'Essential Blowout');
  assert.match(payload.schemaHint, /extract EVERY service/i);
  assert.match(payload.schemaHint, /reject non-services/i);
  assert.match(payload.schemaHint, /Blow-Dry Style \$50\+/i);
});

test('LLM service normalizer drops rejected and invalid service blocks', () => {
  const parsed = parseLlmImportJson(JSON.stringify({
    serviceCatalog: {
      confidence: 0.8,
      categories: [{ name: 'Services', confidence: 0.8, groupKind: 'primary' }],
      services: [
        { categoryName: 'Services', name: 'Balayage', priceAmount: 180, priceCurrency: 'USD', priceType: 'from', durationMinutes: null, durationText: null, aliases: [], bookable: true, confidence: 0.82, sourceEvidence: ['Balayage Starting at $180'] },
        { categoryName: 'Services', name: 'Relaxing', priceAmount: null, priceCurrency: 'USD', priceType: 'from', durationMinutes: null, durationText: null, aliases: [], bookable: true, confidence: 0.86, sourceEvidence: ['Relaxing row'], variants: [{ label: '30 min', durationText: '30 min', durationMinutes: 30, priceAmount: 65, priceCurrency: 'USD', priceType: 'from', sortOrder: 0 }] },
        { categoryName: 'Services', name: '30 min+', priceAmount: null, priceCurrency: 'USD', priceType: 'varies', durationMinutes: 30, durationText: '30 min+', aliases: [], bookable: true, confidence: 0.8, sourceEvidence: ['30 min+'] },
        { categoryName: 'FAQ', name: 'Do you take walk-ins?', priceAmount: null, priceCurrency: 'USD', priceType: 'varies', aliases: [], bookable: true, confidence: 0.8, rejectReason: 'FAQ block', sourceEvidence: ['Do you take walk-ins?'] },
      ],
    },
  }));
  assert.equal(parsed?.serviceCatalog?.services?.length, 2);
  assert.equal(parsed?.serviceCatalog?.services?.[0]?.name, 'Balayage');
  assert.equal(parsed?.serviceCatalog?.services?.[1]?.variants?.[0]?.priceAmount, 65);
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
  assert.match(payload.secondaryKnowledgeHints.staffPages[0]?.text ?? '', /Danielle/i);
  assert.match(payload.secondaryKnowledgeHints.staffPages[0]?.text ?? '', /Color artist and stylist/i);
  assert.match(payload.schemaHint, /staffSuggestions/i);
  assert.match(payload.schemaHint, /bio/i);
});

test('LLM payload prioritizes real staff pages over nav-only team mentions', () => {
  const homepage = previewHtml('<html><body><a href="/team">Our Team</a><p>Welcome to the salon.</p></body></html>', 'https://staff-payload.test');
  const referral = previewHtml('<html><body><a href="/team">Our Team</a><h1>$20 Gift For You</h1><p>Refer a friend and get a reward.</p></body></html>', 'https://staff-payload.test/referral');
  const team = previewHtml('<html><body><h1>Meet the Team</h1><p>Bailey // Hair Stylist</p><p>Jess // Hair Stylist</p></body></html>', 'https://staff-payload.test/team');
  const payload = buildLlmImportPayload({
    sourceUrl: 'https://staff-payload.test',
    previews: [homepage, referral, team],
    selectedPages: [
      { url: 'https://staff-payload.test', bucket: 'homepage', score: 100, source: 'homepage', reason: 'test' },
      { url: 'https://staff-payload.test/referral', bucket: 'noise', score: 80, source: 'nav', reason: 'test' },
      { url: 'https://staff-payload.test/team', bucket: 'staff_team', score: 90, source: 'nav', reason: 'test' },
    ],
  });

  assert.equal(payload.secondaryKnowledgeHints.staffPages[0]?.url, 'https://staff-payload.test/team');
  assert.equal(payload.secondaryKnowledgeHints.staffPages.some((page) => page.url.endsWith('/referral')), false);
  assert.ok(payload.pages.some((page) => page.url.endsWith('/team') && page.bucket === 'staff_team' && /Bailey.*Hair Stylist/i.test(page.text)));
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

test('fetch rejects DNS rebinding before network fetch', async () => {
  let lookupCount = 0;
  let fetchCount = 0;
  const result = await importWebsiteForOnboarding({ url: 'https://rebind.test' }, {
    lookup: async () => {
      lookupCount += 1;
      return [{ address: lookupCount === 1 ? '93.184.216.34' : '127.0.0.1', family: 4 }];
    },
    fetcher: async (url) => {
      fetchCount += 1;
      return response('<h1>Should Not Fetch</h1>', url);
    },
  });
  assert.equal(result.ok, false);
  assert.equal(fetchCount, 0);
});

test('fetch blocks redirect targets that resolve private', async () => {
  const result = await importWebsiteForOnboarding({ url: 'https://redirect-private.test' }, {
    lookup: async (host) => [{ address: host === 'internal.test' ? '10.0.0.5' : '93.184.216.34', family: 4 }],
    fetcher: async (url) =>
      new Response('', {
        status: 302,
        headers: { location: 'http://internal.test/admin' },
      }) as Response & { url: string },
  });
  assert.equal(result.ok, false);
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

function llmHtml(): Record<string, string> {
  return {
    'https://capdemo.test': '<html><head><title>Cap Demo Salon</title></head><body><h1>Cap Demo Salon</h1><a href="/services">Services</a><p>Gel Manicure $32 45 minutes</p></body></html>',
    'https://capdemo.test/robots.txt': '',
    'https://capdemo.test/services': '<h1>Services</h1><p>Gel Manicure $32 45 minutes</p>',
  };
}

const LLM_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

function llmFetcher(html: Record<string, string>, onLlmCall: () => void) {
  return async (url: string) => {
    if (url === LLM_ENDPOINT) {
      onLlmCall();
      const content = JSON.stringify({
        serviceCatalog: { confidence: 0.9, categories: [{ name: 'Manicure', confidence: 0.9 }], services: [{ name: 'Gel Manicure', priceType: 'fixed', confidence: 0.9 }] },
      });
      return response(JSON.stringify({ choices: [{ message: { content } }] }), url, 'application/json');
    }
    return response(html[url] ?? '<h1>Not found</h1>', url, url.endsWith('.xml') ? 'application/xml' : 'text/html');
  };
}

test('website import skips the LLM and warns when the global budget gate denies', async () => {
  let llmCalls = 0;
  const result = await importWebsiteForOnboarding({ url: 'https://capdemo.test' }, {
    lookup,
    fetcher: llmFetcher(llmHtml(), () => { llmCalls += 1; }),
    llmEnabled: true,
    openAiApiKey: 'sk-test',
    acquireLlmBudget: async () => false,
  });
  assert.equal(llmCalls, 0);
  assert.ok(!result.diagnostics.fallbackUsed.includes('llm'));
  assert.ok(result.diagnostics.warnings.some((w) => /daily limit/i.test(w)));
});

test('website import calls the LLM when the global budget gate allows', async () => {
  let llmCalls = 0;
  let gateCalls = 0;
  const result = await importWebsiteForOnboarding({ url: 'https://capdemo.test' }, {
    lookup,
    fetcher: llmFetcher(llmHtml(), () => { llmCalls += 1; }),
    llmEnabled: true,
    openAiApiKey: 'sk-test',
    acquireLlmBudget: async () => { gateCalls += 1; return true; },
  });
  assert.equal(gateCalls, 1);
  assert.equal(llmCalls, 1);
  assert.ok(result.diagnostics.fallbackUsed.includes('llm'));
});

test('website import does not consume the budget gate when LLM is disabled', async () => {
  let gateCalls = 0;
  await importWebsiteForOnboarding({ url: 'https://capdemo.test' }, {
    lookup,
    fetcher: llmFetcher(llmHtml(), () => { /* no-op */ }),
    llmEnabled: false,
    openAiApiKey: 'sk-test',
    acquireLlmBudget: async () => { gateCalls += 1; return true; },
  });
  assert.equal(gateCalls, 0);
});
