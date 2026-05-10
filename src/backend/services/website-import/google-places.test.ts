import test from 'node:test';
import assert from 'node:assert/strict';

import { lookupGooglePlaces, sanitizedGoogleMapsPlacesQuery } from './google-places';

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

test('Google Places success maps to sanitized suggestion fields', async () => {
  const result = await lookupGooglePlaces({
    url: new URL('https://maps.google.com/?q=glow'),
    sourceType: 'google_maps',
    apiKey: 'test-key',
    fetcher: async () => jsonResponse({ places: [{ displayName: { text: 'Glow Nail Spa' }, nationalPhoneNumber: '(555) 123-4567', formattedAddress: '123 Main St, Los Angeles, CA', websiteUri: 'https://glow.test', primaryTypeDisplayName: { text: 'Nail salon' }, types: ['nail_salon'], regularOpeningHours: { periods: [{ open: { day: 1, hour: 9, minute: 0 }, close: { day: 1, hour: 19, minute: 0 } }] } }] }),
  });
  assert.equal(result?.name, 'Glow Nail Spa');
  assert.equal(result?.phone, '(555) 123-4567');
  assert.equal(result?.primaryType, 'nail_salon');
  assert.deepEqual(result?.hours?.mon, { open: '09:00', close: '19:00' });
  assert.equal(JSON.stringify(result).includes('test-key'), false);
});

test('Google Places unavailable does not call API and returns null', async () => {
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
      return jsonResponse({ places: [{ displayName: { text: 'Glow Nail Spa' }, formattedAddress: '123 Main St, Los Angeles, CA' }] });
    },
  });
  assert.equal(result?.name, 'Glow Nail Spa');
  assert.match(requestBody, /Glow Nail Spa/);
  assert.equal(requestBody.includes('utm_campaign'), false);
  assert.equal(requestBody.includes('raw-secret'), false);
  assert.equal(requestBody.includes('test-key'), false);
});
