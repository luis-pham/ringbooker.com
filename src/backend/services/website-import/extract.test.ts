import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSuggestions, extractHoursFromJsonLd, extractHoursFromText, inferTimezoneFromAddress } from './extract';
import { previewHtml } from './html';

test('extracts JSON-LD openingHours', () => {
  const preview = previewHtml('<script type="application/ld+json">{"@type":"NailSalon","name":"Glow","openingHours":["Mon-Fri 9am-7pm","Closed Sunday"]}</script><h1>Glow</h1>', 'https://demo.test');
  const hours = extractHoursFromJsonLd([preview])?.value;
  assert.deepEqual(hours?.mon, { open: '09:00', close: '19:00' });
  assert.deepEqual(hours?.fri, { open: '09:00', close: '19:00' });
  assert.deepEqual(hours?.sun, { closed: true });
});

test('extracts JSON-LD openingHoursSpecification', () => {
  const preview = previewHtml('<script type="application/ld+json">{"@type":"BeautySalon","openingHoursSpecification":[{"dayOfWeek":["Monday","Saturday"],"opens":"10:00","closes":"17:00"}]}</script>', 'https://demo.test');
  const hours = extractHoursFromJsonLd([preview])?.value;
  assert.deepEqual(hours?.mon, { open: '10:00', close: '17:00' });
  assert.deepEqual(hours?.sat, { open: '10:00', close: '17:00' });
});

test('extracts common text hours and closed days', () => {
  const hours = extractHoursFromText('Hours: Monday-Saturday 9-7. Closed Sunday. Saturday 10am-5pm')?.value;
  assert.deepEqual(hours?.mon, { open: '09:00', close: '19:00' });
  assert.deepEqual(hours?.fri, { open: '09:00', close: '19:00' });
  assert.deepEqual(hours?.sat, { open: '10:00', close: '17:00' });
  assert.deepEqual(hours?.sun, { closed: true });
});

test('infers conservative US timezone from address', () => {
  assert.equal(inferTimezoneFromAddress('123 Main St, Los Angeles, CA')?.value, 'America/Los_Angeles');
  assert.equal(inferTimezoneFromAddress('10 Broadway, New York, NY')?.value, 'America/New_York');
  assert.equal(inferTimezoneFromAddress('Unknown address')?.value, undefined);
});

test('Google Places hours override website hours and phone conflicts warn', () => {
  const preview = previewHtml('<script type="application/ld+json">{"@type":"NailSalon","name":"Website Salon","telephone":"555-111-2222","address":{"streetAddress":"1 Main","addressLocality":"Los Angeles","addressRegion":"CA"},"openingHours":"Mon-Fri 10am-5pm"}</script><p>Gel Manicure $45 45 minutes</p>', 'https://demo.test');
  const suggestions = buildSuggestions({
    sourceUrl: 'https://demo.test',
    sourceType: 'normal_website',
    previews: [preview],
    googlePlaces: {
      name: 'Google Salon',
      phone: '555-999-0000',
      address: '10 Broadway, New York, NY',
      website: 'https://demo.test',
      hours: { mon: { open: '09:00', close: '19:00' } },
    },
  });
  assert.equal(suggestions.businessProfile.phone.source, 'Google Places');
  assert.deepEqual(suggestions.hours.value?.mon, { open: '09:00', close: '19:00' });
  assert.equal(suggestions.hours.source, 'Google Places');
  assert.equal(suggestions.businessProfile.timezone.value, 'America/New_York');
  assert.ok(suggestions.warnings.some((warning) => /phone differs/i.test(warning)));
  assert.ok(suggestions.serviceCatalog.services.some((service) => service.name.includes('Gel Manicure')));
});
