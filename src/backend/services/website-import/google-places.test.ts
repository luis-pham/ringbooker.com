import test from 'node:test';
import assert from 'node:assert/strict';

import { extractGoogleMapsIdentifier, lookupGooglePlaces, normalizeAddress, sanitizedGoogleMapsPlacesQuery } from './google-places';

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

test('Serper /maps success maps to the existing suggestion shape', async () => {
  const result = await lookupGooglePlaces({
    url: new URL('https://maps.google.com/?q=glow'),
    sourceType: 'google_maps',
    apiKey: 'test-key',
    fetcher: async () =>
      jsonResponse({
        places: [
          {
            title: 'Glow Nail Spa',
            phoneNumber: '(555) 123-4567',
            address: '123 Main St, Los Angeles, CA',
            website: 'https://glow.test',
            types: ['nail_salon'],
            openingHours: { Monday: '9 AM–7 PM', Sunday: 'Closed' },
            cid: '111',
            placeId: 'ChIJabc',
          },
        ],
      }),
  });
  assert.equal(result?.name, 'Glow Nail Spa');
  assert.equal(result?.phone, '(555) 123-4567');
  assert.equal(result?.primaryType, 'nail_salon');
  assert.deepEqual(result?.hours?.mon, { open: '09:00', close: '19:00' });
  assert.deepEqual(result?.hours?.sun, { closed: true });
  assert.equal(JSON.stringify(result).includes('test-key'), false);
});

test('Serper unavailable (no key) does not call the API and returns null', async () => {
  let called = false;
  const result = await lookupGooglePlaces({ url: new URL('https://maps.google.com/?q=glow'), sourceType: 'google_maps', fetcher: async () => { called = true; return jsonResponse({}); } });
  assert.equal(result, null);
  assert.equal(called, false);
});

test('Google Maps Places query strips tracking params and raw token-like URL data', async () => {
  const query = sanitizedGoogleMapsPlacesQuery(new URL('https://maps.google.com/maps?cid=12345&utm_source=ad&token=secret-token&debug=true'));
  assert.equal(query, '12345');
  assert.equal(query.includes('utm_source'), false);
  assert.equal(query.includes('secret-token'), false);

  let requestBody = '';
  const result = await lookupGooglePlaces({
    url: new URL('https://maps.google.com/maps?q=Glow%20Nail%20Spa&utm_campaign=x&auth_token=raw-secret'),
    sourceType: 'google_maps',
    apiKey: 'test-key',
    fetcher: async (_url, init) => {
      requestBody = String(init?.body ?? '');
      return jsonResponse({ places: [{ title: 'Glow Nail Spa', address: '123 Main St, Los Angeles, CA' }] });
    },
  });
  assert.equal(result?.name, 'Glow Nail Spa');
  assert.match(requestBody, /Glow Nail Spa/);
  assert.equal(requestBody.includes('utm_campaign'), false);
  assert.equal(requestBody.includes('raw-secret'), false);
  assert.equal(requestBody.includes('test-key'), false);
});

test('extractGoogleMapsIdentifier prioritizes place_id over cid over free text', () => {
  assert.deepEqual(extractGoogleMapsIdentifier(new URL('https://www.google.com/maps?place_id=ChIJabc123&cid=999&q=fallback')), { type: 'place_id', value: 'ChIJabc123' });
  assert.deepEqual(extractGoogleMapsIdentifier(new URL('https://www.google.com/maps?query_place_id=ChIJxyz789')), { type: 'place_id', value: 'ChIJxyz789' });
  assert.deepEqual(extractGoogleMapsIdentifier(new URL('https://www.google.com/maps?cid=6698561713485928518&q=fallback')), { type: 'cid', value: '6698561713485928518' });
  assert.deepEqual(extractGoogleMapsIdentifier(new URL('https://www.google.com/maps?q=Glow%20Nail%20Spa')), { type: 'text', value: 'Glow Nail Spa' });
  assert.equal(extractGoogleMapsIdentifier(new URL('https://www.google.com/maps/@34.05,-118.25,17z')), null);
});

test('a URL with place_id sends { placeId } to Serper /maps (not a free-text search) and returns exact-match confidence', async () => {
  let calledUrl = '';
  let calledMethod = '';
  let requestBody = '';
  const result = await lookupGooglePlaces({
    url: new URL('https://www.google.com/maps?place_id=ChIJexact123'),
    sourceType: 'google_maps',
    apiKey: 'test-key',
    fetcher: async (url, init) => {
      calledUrl = url;
      calledMethod = init?.method ?? 'GET';
      requestBody = String(init?.body ?? '');
      return jsonResponse({ places: [{ title: 'Exact Match Salon', address: '1 Main St' }] });
    },
  });
  assert.equal(calledUrl, 'https://google.serper.dev/maps');
  assert.equal(calledMethod, 'POST');
  assert.deepEqual(JSON.parse(requestBody), { placeId: 'ChIJexact123' });
  assert.equal(result?.name, 'Exact Match Salon');
  assert.equal(result?.matchConfidence, 0.98);
});

test('Place Details (placeId) lookup failure is distinguishable from a not-found result', async () => {
  const result = await lookupGooglePlaces({
    url: new URL('https://www.google.com/maps?place_id=ChIJbroken'),
    sourceType: 'google_maps',
    apiKey: 'test-key',
    fetcher: async () => new Response('', { status: 500 }),
  });
  assert.equal(result?.name, undefined);
  assert.equal(result?.matchConfidence, 0);
  assert.match((result?.warnings ?? []).join(' '), /Place Details lookup failed/);
});

test('a cid URL resolves directly via Serper\'s native cid lookup (no name-guessing needed)', async () => {
  const calls: string[] = [];
  const result = await lookupGooglePlaces({
    url: new URL('https://www.google.com/maps?cid=6698561713485928518'),
    sourceType: 'google_maps',
    apiKey: 'test-key',
    fetcher: async (_url, init) => {
      calls.push(String(init?.body ?? ''));
      return jsonResponse({ places: [{ title: 'Glow Nail Spa', address: '1 Main St', cid: '6698561713485928518' }] });
    },
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(calls[0]), { cid: '6698561713485928518' });
  assert.equal(result?.name, 'Glow Nail Spa');
  assert.equal(result?.matchConfidence, 0.95);
});

test('a CID URL with a business name in the path falls back to name search when direct cid lookup finds nothing', async () => {
  const bodies: string[] = [];
  const result = await lookupGooglePlaces({
    url: new URL('https://www.google.com/maps/place/Glow+Nail+Spa/@34.05,-118.25,17z/data=!3m1!4b1?cid=6698561713485928518'),
    sourceType: 'google_maps',
    apiKey: 'test-key',
    fetcher: async (_url, init) => {
      const body = String(init?.body ?? '');
      bodies.push(body);
      if (body.includes('"cid"')) return jsonResponse({ places: [] }); // direct cid lookup finds nothing
      return jsonResponse({ places: [{ title: 'Glow Nail Spa', address: '1 Main St' }] }); // name-based fallback finds it
    },
  });
  assert.equal(bodies.length, 2);
  assert.match(bodies[1], /Glow Nail Spa/);
  assert.equal(result?.name, 'Glow Nail Spa');
  assert.equal(result?.matchConfidence, 0.85);
});

test('a CID-only URL with no extractable name returns an unresolved state after the direct cid lookup finds nothing', async () => {
  let callCount = 0;
  const result = await lookupGooglePlaces({
    url: new URL('https://www.google.com/maps?cid=6698561713485928518'),
    sourceType: 'google_maps',
    apiKey: 'test-key',
    fetcher: async () => {
      callCount += 1;
      return jsonResponse({ places: [] });
    },
  });
  assert.equal(callCount, 1); // only the direct cid attempt — no name to fall back to, so no second call
  assert.equal(result?.name, undefined);
  assert.equal(result?.matchConfidence, 0);
  assert.match((result?.warnings ?? []).join(' '), /Could not resolve this Google Maps link/);
});

test('a Maps free-text search with zero results returns an unresolved state instead of null', async () => {
  const result = await lookupGooglePlaces({
    url: new URL('https://maps.google.com/?q=Nonexistent+Salon+Zzz'),
    sourceType: 'google_maps',
    apiKey: 'test-key',
    fetcher: async () => jsonResponse({ places: [] }),
  });
  assert.notEqual(result, null);
  assert.equal(result?.matchConfidence, 0);
});

test('Serper openingHours (day names + AM/PM ranges) maps to the internal weekly-hours shape, all 7 days present', async () => {
  const result = await lookupGooglePlaces({
    url: new URL('https://maps.google.com/?q=glow'),
    sourceType: 'google_maps',
    apiKey: 'test-key',
    fetcher: async () =>
      jsonResponse({
        places: [
          {
            title: 'Glow Nail Spa',
            address: '1 Main St',
            openingHours: {
              Monday: '11 AM–8 PM',
              Tuesday: '11 AM–8 PM',
              Wednesday: '11 AM–8 PM',
              Thursday: '11 AM–8 PM',
              Friday: '11 AM–8 PM',
              Saturday: '9 AM–5 PM',
              Sunday: 'Closed',
            },
          },
        ],
      }),
  });
  assert.deepEqual(result?.hours?.mon, { open: '11:00', close: '20:00' });
  assert.deepEqual(result?.hours?.sat, { open: '09:00', close: '17:00' });
  assert.deepEqual(result?.hours?.sun, { closed: true });
  assert.equal(Object.keys(result?.hours ?? {}).length, 7);
});

test('a normal-website hint search that Serper 403s (bad auth) returns null, not a thrown error', async () => {
  const result = await lookupGooglePlaces({
    url: new URL('https://example-salon.test'),
    sourceType: 'normal_website',
    hints: { name: 'Example Salon' },
    apiKey: 'bad-key',
    fetcher: async () => new Response(JSON.stringify({ message: 'Unauthorized.', statusCode: 403 }), { status: 403 }),
  });
  assert.equal(result, null);
});

test('normalizeAddress strips a trailing US country suffix regardless of which real Serper response produced it', () => {
  // Real strings captured live: the identical business ("Maison de MI Salon") returned both
  // shapes across different Serper code paths (text search vs. direct cid lookup) for the same
  // business in the same test run.
  assert.equal(normalizeAddress('333 5th Ave 2nd floor, New York, NY 10016, United States'), '333 5th Ave 2nd floor, New York, NY 10016');
  assert.equal(normalizeAddress('333 5th Ave 2nd floor, New York, NY 10016'), '333 5th Ave 2nd floor, New York, NY 10016');
  // Tolerated variations per the fix spec, not captured live but defensively handled.
  assert.equal(normalizeAddress('123 Main St, Austin, TX 78701, USA'), '123 Main St, Austin, TX 78701');
  assert.equal(normalizeAddress('123 Main St, Austin, TX 78701, US'), '123 Main St, Austin, TX 78701');
  assert.equal(normalizeAddress('123 Main St, Austin, TX 78701, U.S.A.'), '123 Main St, Austin, TX 78701');
  assert.equal(normalizeAddress('123 Main St, Austin, TX 78701, United States of America'), '123 Main St, Austin, TX 78701');
  // Case-insensitivity and trailing whitespace.
  assert.equal(normalizeAddress('123 Main St, Austin, TX 78701, united states  '), '123 Main St, Austin, TX 78701');
  // No suffix at all — untouched, no other reformatting.
  assert.equal(normalizeAddress('123 Main St, Austin, TX 78701'), '123 Main St, Austin, TX 78701');
  // null passes through.
  assert.equal(normalizeAddress(null), null);
});

test('address normalization is scoped to the address field only — name/phone/hours pass through unaltered', async () => {
  const result = await lookupGooglePlaces({
    url: new URL('https://www.google.com/maps?cid=17871730722434324628'),
    sourceType: 'google_maps',
    apiKey: 'test-key',
    fetcher: async () =>
      jsonResponse({
        places: [
          {
            title: 'Maison de MI Salon | Korean Hair Salon',
            phoneNumber: '(212) 725-1460',
            address: '333 5th Ave 2nd floor, New York, NY 10016, United States',
            website: 'https://www.maisondemisalon.com/',
            openingHours: { Saturday: '9 AM–5 PM' },
            cid: '17871730722434324628',
          },
        ],
      }),
  });
  assert.equal(result?.address, '333 5th Ave 2nd floor, New York, NY 10016');
  assert.equal(result?.name, 'Maison de MI Salon | Korean Hair Salon');
  assert.equal(result?.phone, '(212) 725-1460');
  assert.equal(result?.website, 'https://www.maisondemisalon.com/');
  assert.deepEqual(result?.hours?.sat, { open: '09:00', close: '17:00' });
});
