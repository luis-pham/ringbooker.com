import test from 'node:test';
import assert from 'node:assert/strict';

import { detectImportSource } from './source-routing';

const CASES: Array<[string, ReturnType<typeof detectImportSource>]> = [
  ['https://www.google.com/maps/place/Glow+Nail+Spa/@34.05,-118.25,17z', 'google_maps'],
  ['https://google.com/maps/search/?api=1&query=Glow+Nail+Spa', 'google_maps'],
  ['https://maps.google.com/?q=Glow+Nail+Spa', 'google_maps'],
  ['https://maps.google.co.uk/?q=Glow+Nail+Spa', 'google_maps'],
  ['https://g.co/kgs/abc123', 'google_maps'],
  ['https://g.page/glow-nail-spa', 'google_maps'],
  ['https://business.google.com/dashboard/l/12345', 'google_maps'],
  // Not resolved by this function (short links must be resolved by resolveGoogleMapsShortLink
  // before detectImportSource runs) — verifies detectImportSource does not itself try to guess.
  ['https://maps.app.goo.gl/xyz123', 'normal_website'],
  // Decoys that must NOT be misclassified now that substring matching on "google." is gone.
  ['https://www.google.com/', 'normal_website'],
  ['https://accounts.google.com/signin', 'normal_website'],
  ['https://mail.google.com/mail/u/0/', 'normal_website'],
  ['https://google-reviews-fake.com/maps/place/scam', 'normal_website'],
  ['https://www.yelp.com/biz/glow-nail-spa-los-angeles', 'yelp'],
  ['https://www.facebook.com/glownailspa', 'facebook'],
  ['https://www.instagram.com/glownailspa', 'instagram'],
  ['https://www.vagaro.com/glownailspa', 'vagaro'],
  ['https://glownailspa.com', 'normal_website'],
];

test('detectImportSource classifies real-world URL shapes correctly', () => {
  for (const [raw, expected] of CASES) {
    assert.equal(detectImportSource(new URL(raw)), expected, `expected ${raw} -> ${expected}`);
  }
});
