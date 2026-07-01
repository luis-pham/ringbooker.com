import test from 'node:test';
import assert from 'node:assert/strict';

import { isGoogleMapsShortLinkHostname, isGoogleMapsUrl, isProbablyGoogleMapsUrl } from './google-maps-url';

const MAPS_URLS = [
  'https://www.google.com/maps/place/Glow+Nail+Spa/@34.05,-118.25,17z',
  'https://google.com/maps/search/?api=1&query=Glow+Nail+Spa',
  'https://maps.google.com/?q=Glow+Nail+Spa',
  'https://maps.google.co.uk/?q=Glow+Nail+Spa',
  'https://maps.google.com.au/?q=Glow+Nail+Spa',
  'https://g.co/kgs/abc123',
  'https://g.page/glow-nail-spa',
  'https://business.google.com/dashboard/l/12345',
];

const NON_MAPS_URLS = [
  'https://www.google.com/',
  'https://accounts.google.com/signin',
  'https://mail.google.com/mail/u/0/',
  'https://drive.google.com/drive/folders/abc',
  'https://google-reviews-fake.com/maps/place/scam',
  'https://example.com/',
];

test('isGoogleMapsUrl accepts real-world Google Maps URL shapes', () => {
  for (const raw of MAPS_URLS) {
    assert.equal(isGoogleMapsUrl(new URL(raw)), true, `expected ${raw} to be recognized as Maps`);
  }
});

test('isGoogleMapsUrl rejects unrelated *.google.com pages and decoy domains', () => {
  for (const raw of NON_MAPS_URLS) {
    assert.equal(isGoogleMapsUrl(new URL(raw)), false, `expected ${raw} to NOT be recognized as Maps`);
  }
});

test('isGoogleMapsShortLinkHostname flags only opaque redirector hosts', () => {
  assert.equal(isGoogleMapsShortLinkHostname('maps.app.goo.gl'), true);
  assert.equal(isGoogleMapsShortLinkHostname('goo.gl'), true);
  assert.equal(isGoogleMapsShortLinkHostname('g.page'), true);
  assert.equal(isGoogleMapsShortLinkHostname('www.maps.app.goo.gl'), true);
  assert.equal(isGoogleMapsShortLinkHostname('bit.ly'), false);
  assert.equal(isGoogleMapsShortLinkHostname('google.com'), false);
});

test('isProbablyGoogleMapsUrl works on raw pasted strings without a scheme', () => {
  assert.equal(isProbablyGoogleMapsUrl('maps.app.goo.gl/xyz123'), true);
  assert.equal(isProbablyGoogleMapsUrl('g.page/glow-nail-spa'), true);
  assert.equal(isProbablyGoogleMapsUrl('google.com/maps/place/Glow+Nail+Spa'), true);
  assert.equal(isProbablyGoogleMapsUrl('glownailspa.com'), false);
  assert.equal(isProbablyGoogleMapsUrl(''), false);
  assert.equal(isProbablyGoogleMapsUrl('not a url at all'), false);
});
