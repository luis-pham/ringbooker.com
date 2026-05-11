import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSuggestions, extractHoursFromJsonLd, extractHoursFromText, extractSecondaryKnowledge, extractServicesFromText, inferTimezoneFromAddress } from './extract';
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

test('extracts Wix-style two-column hours and footer hours', () => {
  const wixHours = extractHoursFromText('top of pageBOOKING Follow us Hours10 AM - 4 PM 10 AM - 8 PM 10 AM - 8 PM 9 AM - 6 PM 9 AM - 6 PM 9 AM - 5 PM Monday Tuesday Wednesday Thursday Friday Saturday bottom of page')?.value;
  assert.deepEqual(wixHours?.mon, { open: '10:00', close: '16:00' });
  assert.deepEqual(wixHours?.tue, { open: '10:00', close: '20:00' });
  assert.deepEqual(wixHours?.wed, { open: '10:00', close: '20:00' });
  assert.deepEqual(wixHours?.thu, { open: '09:00', close: '18:00' });
  assert.deepEqual(wixHours?.fri, { open: '09:00', close: '18:00' });
  assert.deepEqual(wixHours?.sat, { open: '09:00', close: '17:00' });

  const footerPreview = previewHtml('<main><h1>Footer Salon</h1></main><footer><h2>Hours</h2><p>Monday 9am-5pm</p><p>Closed Sunday</p></footer>', 'https://footer-hours.test');
  const suggestions = buildSuggestions({ sourceUrl: 'https://footer-hours.test', sourceType: 'normal_website', previews: [footerPreview] });
  assert.deepEqual(suggestions.hours.value?.mon, { open: '09:00', close: '17:00' });
  assert.deepEqual(suggestions.hours.value?.sun, { closed: true });
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

test('normalizes imported US phone numbers to E.164 for backend storage', () => {
  const preview = previewHtml('<script type="application/ld+json">{"@type":"HairSalon","name":"Salon 5014","telephone":"4694264308","address":{"streetAddress":"5014 Ross Ave","addressLocality":"Dallas","addressRegion":"TX"}}</script>', 'https://salon5014.test');
  const suggestions = buildSuggestions({ sourceUrl: 'https://salon5014.test', sourceType: 'normal_website', previews: [preview] });
  assert.equal(suggestions.businessProfile.phone.value, '+14694264308');
});

test('extracts compressed Wix service menu without navigation noise', () => {
  const services = extractServicesFromText(
    'top of pageBOOKINGStyling ServicesHaircut $78+ ​​ Blowout & Style $60+ Color ServicesFace Frame $150+ Partial Highlight $170+ Tint $70+ Foilayage $200+ Full Highlight $200+ Toner/Gloss $50+ Balayage $180+ Hair SpecialtiesKeratin Complex $350+ Deep Conditioning $50+ Perm $250+ Extensions $599+ Brazilian Blowout $380+ Magic Sleek $380+ bottom of page',
    'https://www.salon5014.com/services',
  );
  assert.ok(services.some((service) => service.name === 'Haircut' && service.categoryName === 'Styling Services' && service.priceAmount === 78 && service.priceType === 'from'));
  assert.ok(services.some((service) => service.name === 'Balayage' && service.categoryName === 'Color Services' && service.priceAmount === 180));
  assert.ok(services.some((service) => service.name === 'Keratin Complex' && service.categoryName === 'Hair Specialties' && service.priceAmount === 350));
  assert.equal(services.some((service) => /top of page|BOOKING|bottom of page/i.test(service.name)), false);
  assert.equal(services.length, 15);
});

test('extracts common WordPress-style service blocks without compressed Wix cleanup regressions', () => {
  const preview = previewHtml(`
    <html><body>
      <h2>Services</h2>
      <div class="wp-block-column"><h3>Gel Manicure</h3><p>Starting at $45 · 45 minutes</p></div>
      <div class="wp-block-column"><h3>Signature Pedicure</h3><p>$55 · 50 minutes</p></div>
      <div class="wp-block-column"><h3>Eyebrow Wax</h3><p>$25</p></div>
    </body></html>
  `, 'https://wordpress-salon.test/services');
  const suggestions = buildSuggestions({ sourceUrl: 'https://wordpress-salon.test', sourceType: 'normal_website', previews: [preview] });
  const names = suggestions.serviceCatalog.services.map((service) => service.name);
  assert.ok(names.includes('Gel Manicure'));
  assert.ok(names.includes('Signature Pedicure'));
  assert.ok(names.includes('Eyebrow Wax'));
  assert.equal(suggestions.serviceCatalog.services.find((service) => service.name === 'Gel Manicure')?.priceType, 'from');
});

test('extracts secondary Business Knowledge suggestions from deterministic website evidence', () => {
  const preview = previewHtml(`
    <html><head>
      <script type="application/ld+json">{"@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Do you accept walk-ins?","acceptedAnswer":{"@type":"Answer","text":"Walk-ins are welcome when available."}}]}</script>
    </head><body>
      <h1>Team</h1>
      <p>Mia Chen - Stylist</p>
      <h2>Cancellation Policy</h2>
      <p>Cancellation requires 24 hours notice to avoid a fee.</p>
      <h2>Specials</h2>
      <p>Special offer: $20 off first facial this month.</p>
      <a href="https://vagaro.com/demo">Book now</a>
    </body></html>
  `, 'https://knowledge.test/team');
  const secondary = extractSecondaryKnowledge([preview]);
  assert.equal(secondary.staffSuggestions[0]?.name, 'Mia Chen');
  assert.equal(secondary.policySuggestions[0]?.type, 'cancellation');
  assert.equal(secondary.faqSuggestions[0]?.question, 'Do you accept walk-ins?');
  assert.equal(secondary.promotionSuggestions.length > 0, true);
  assert.equal(secondary.bookingSetupSuggestions[0]?.platform, 'vagaro');

  const suggestions = buildSuggestions({ sourceUrl: 'https://knowledge.test', sourceType: 'normal_website', previews: [preview] });
  assert.equal(suggestions.staffSuggestions.length, 1);
  assert.equal(JSON.stringify(suggestions).includes('<script>'), false);
});
