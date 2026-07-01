import test from 'node:test';
import assert from 'node:assert/strict';

import { renderServicePrice, renderRuntimeOptional } from './runtime-config';
import type { RuntimeBusinessConfig } from './types';

test('renderServicePrice treats a defined $0 price as free, not "varies"', () => {
  assert.equal(renderServicePrice({ name: 'Color Consultation', price: 0, priceType: undefined }), 'free');
});

test('renderServicePrice still honors an explicit "varies" priceType even when price is 0', () => {
  assert.equal(renderServicePrice({ name: 'Color Consultation', price: 0, priceType: 'varies' }), 'price varies');
});

test('renderServicePrice regression: a normal paid service still renders as a fixed dollar amount', () => {
  assert.equal(renderServicePrice({ name: "Women's Haircut", price: 65, priceType: undefined }), '$65');
});

test('renderServicePrice regression: an undefined price still renders null', () => {
  assert.equal(renderServicePrice({ name: 'Mystery Service', price: undefined, priceType: undefined }), null);
});

test('renderServicePrice regression: explicit "consultation" priceType is unaffected by this fix', () => {
  assert.equal(renderServicePrice({ name: 'Injectables Consultation', price: 0, priceType: 'consultation' }), 'consultation required');
});

test('renderServicePrice regression: "from" priceType still renders "starts at $X" for a positive price', () => {
  assert.equal(renderServicePrice({ name: 'Partial Highlights', price: 145, priceType: 'from' }), 'starts at $145');
});

test('renderRuntimeOptional renders "free" for a $0 service inside the actual composed prompt text', () => {
  const config: RuntimeBusinessConfig = {
    businessName: 'Luna Hair Studio',
    services: [
      { name: 'Color Consultation', category: 'Color', price: 0, duration: '20 min' },
      { name: "Women's Haircut", category: 'Cut & Style', price: 65, duration: '60 min' },
      { name: 'Partial Highlights', category: 'Color', price: 145, duration: '2 hr', priceType: 'varies' },
    ],
  };
  const rendered = renderRuntimeOptional(config);
  assert.match(rendered, /Color Consultation \| free \| 20 min/);
  assert.match(rendered, /Women's Haircut \| \$65 \| 60 min/);
  // Regression: a genuinely variable-price service must still say "price varies", unaffected by this fix.
  assert.match(rendered, /Partial Highlights \| price varies \| 2 hr/);
});
