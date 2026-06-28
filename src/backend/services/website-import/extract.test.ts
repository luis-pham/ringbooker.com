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
      matchConfidence: 0.9,
    },
  });
  assert.equal(suggestions.businessProfile.phone.source, 'Google Places');
  assert.equal(suggestions.businessProfile.name.value, 'Website Salon');
  assert.deepEqual(suggestions.hours.value?.mon, { open: '10:00', close: '17:00' });
  assert.equal(suggestions.hours.source, 'JSON-LD');
  assert.equal(suggestions.businessProfile.timezone.value, 'America/New_York');
  assert.ok(suggestions.warnings.some((warning) => /phone differs/i.test(warning)));
  assert.ok(suggestions.serviceCatalog.services.some((service) => service.name.includes('Gel Manicure')));
});

test('uses visible homepage brand before SEO service title when H1 is missing', () => {
  const preview = previewHtml(
    '<html><head><title>Massage Therapy | Salon | Grand Prairie Massage | Facial | Spa | Hair Syndicate 5 Salon and Spa</title></head><body><main><p>Hair Syndicate 5</p><p>At Hair Syndicate, we specialize in cutting-edge hair styling and spa treatments.</p></main></body></html>',
    'https://hairsyndicate.test',
  );
  const suggestions = buildSuggestions({ sourceUrl: 'https://hairsyndicate.test', sourceType: 'normal_website', previews: [preview] });
  assert.equal(suggestions.businessProfile.name.value, 'Hair Syndicate 5');
  assert.equal(suggestions.businessProfile.name.source, 'Website');
  assert.equal(suggestions.businessProfile.name.confidence, 0.74);
});

test('normal website import keeps website address formatting when Places only adds country suffix', () => {
  const preview = previewHtml('<script type="application/ld+json">{"@type":"Organization","name":"RAW Hair & Co."}</script><p>Address:223 N Bishop Ave, Dallas, TX 75208 Telephone:(469) 965-8500 Hours Of Operation MondayCLOSED Tuesday10 AM - 5 PM Wednesday10 AM - 8 PM Thursday9 AM - 8 PM Friday & Saturday9 AM - 6 PM Sunday11 AM - 6 PM</p>', 'https://rawhairandco.com');
  const suggestions = buildSuggestions({
    sourceUrl: 'https://rawhairandco.com',
    sourceType: 'normal_website',
    previews: [preview],
    googlePlaces: {
      name: 'Sunny Shop',
      phone: '(469) 965-8500',
      address: '223 N Bishop Ave, Dallas, TX 75208, USA',
      website: 'https://rawhairandco.com',
      hours: { sun: { closed: true } },
      matchConfidence: 0.9,
    },
  });
  assert.equal(suggestions.businessProfile.name.value, 'RAW Hair & Co.');
  assert.equal(suggestions.businessProfile.address.value, '223 N Bishop Ave, Dallas, TX 75208');
  assert.equal(suggestions.businessProfile.address.source, 'JSON-LD');
  assert.deepEqual(suggestions.hours.value?.sun, { open: '11:00', close: '18:00' });
  assert.equal(suggestions.hours.source, 'Website');
  assert.equal(suggestions.warnings.some((warning) => /address differs/i.test(warning)), false);
  assert.equal(suggestions.warnings.some((warning) => /hours differ/i.test(warning)), true);
});

test('normal website import treats equivalent 12-hour and 24-hour hours as matching', () => {
  const preview = previewHtml('<script type="application/ld+json">{"@type":"HairSalon","name":"Hours Salon","openingHours":"Mon 10 AM - 8 PM"}</script>', 'https://hours-format.test');
  const suggestions = buildSuggestions({
    sourceUrl: 'https://hours-format.test',
    sourceType: 'normal_website',
    previews: [preview],
    googlePlaces: {
      name: 'Hours Salon',
      website: 'https://hours-format.test',
      hours: { mon: { open: '10:00', close: '20:00' } },
      matchConfidence: 0.9,
    },
  });
  assert.deepEqual(suggestions.hours.value?.mon, { open: '10:00', close: '20:00' });
  assert.equal(suggestions.warnings.some((warning) => /hours differ/i.test(warning)), false);
});

test('normal website import treats missing Google Places closed days as closed', () => {
  const preview = previewHtml('<p>Hours Of Operation Monday CLOSED Tuesday 10 AM - 5 PM Wednesday 10 AM - 8 PM Thursday 9 AM - 8 PM Friday 9 AM - 6 PM Saturday 9 AM - 6 PM Sunday 11 AM - 6 PM</p>', 'https://rawhairandco.test');
  const suggestions = buildSuggestions({
    sourceUrl: 'https://rawhairandco.test',
    sourceType: 'normal_website',
    previews: [preview],
    googlePlaces: {
      name: 'RAW Hair & Co.',
      website: 'https://rawhairandco.test',
      hours: {
        tue: { open: '10:00', close: '17:00' },
        wed: { open: '10:00', close: '20:00' },
        thu: { open: '09:00', close: '20:00' },
        fri: { open: '09:00', close: '18:00' },
        sat: { open: '09:00', close: '18:00' },
        sun: { open: '11:00', close: '18:00' },
      },
      matchConfidence: 0.9,
    },
  });
  assert.equal(suggestions.warnings.some((warning) => /hours differ/i.test(warning)), false);
});

test('normal website import treats common address suffix variants as the same address', () => {
  const preview = previewHtml('<p>Address: 37917 Vine Street, Willoughby, OH 44094 Phone: (440) 555-0100</p>', 'https://env-salon.test');
  const suggestions = buildSuggestions({
    sourceUrl: 'https://env-salon.test',
    sourceType: 'normal_website',
    previews: [preview],
    googlePlaces: {
      name: 'enV Salon',
      phone: '(440) 555-0100',
      address: '37917 Vine St, Willoughby, OH 44094, USA',
      website: 'https://env-salon.test',
      matchConfidence: 0.9,
    },
  });
  assert.equal(suggestions.businessProfile.address.value, '37917 Vine Street, Willoughby, OH 44094');
  assert.equal(suggestions.warnings.some((warning) => /address differs/i.test(warning)), false);
});

test('normal website import treats suite number and state-name variants as the same address', () => {
  const preview = previewHtml('<script type="application/ld+json">{"@type":"LocalBusiness","name":"Suite Salon","telephone":"(214) 555-0100","address":{"streetAddress":"3699 McKinney Ave, Ste 412","addressLocality":"Dallas","addressRegion":"Texas","postalCode":"75204"}}</script><p>Phone: (214) 555-0100</p>', 'https://suite-salon.test');
  const suggestions = buildSuggestions({
    sourceUrl: 'https://suite-salon.test',
    sourceType: 'normal_website',
    previews: [preview],
    googlePlaces: {
      name: 'Suite Salon',
      phone: '(214) 555-0100',
      address: '3699 McKinney Ave #412, Dallas, TX 75204, USA',
      website: 'https://suite-salon.test',
      matchConfidence: 0.9,
    },
  });
  assert.equal(suggestions.businessProfile.address.value, '3699 McKinney Ave, Ste 412, Dallas, Texas, 75204');
  assert.equal(suggestions.warnings.some((warning) => /address differs/i.test(warning)), false);
});

test('keeps website data when normal website Google Places match is low confidence', () => {
  const preview = previewHtml('<script type="application/ld+json">{"@type":"Organization","name":"RAW Hair & Co."}</script><p>Address:223 N Bishop Ave, Dallas, TX 75208 Telephone:(469) 965-8500</p>', 'https://rawhairandco.com');
  const suggestions = buildSuggestions({
    sourceUrl: 'https://rawhairandco.com',
    sourceType: 'normal_website',
    previews: [preview],
    googlePlaces: {
      name: 'Huy Google Account',
      phone: '555-999-0000',
      address: '1 Wrong Way, Dallas, TX',
      matchConfidence: 0.25,
    },
  });
  assert.equal(suggestions.businessProfile.name.value, 'RAW Hair & Co.');
  assert.equal(suggestions.businessProfile.phone.value, '+14699658500');
  assert.equal(suggestions.businessProfile.address.value, '223 N Bishop Ave, Dallas, TX 75208');
  assert.ok(suggestions.warnings.some((warning) => /low confidence/i.test(warning)));
});

test('normal website does not use Google Places identity when website identity is missing', () => {
  const preview = previewHtml('<p>Hair color, haircuts, extensions, and nail services available.</p><p>Call (440) 510-8230</p>', 'http://env-salon.test');
  const suggestions = buildSuggestions({
    sourceUrl: 'http://env-salon.test',
    sourceType: 'normal_website',
    previews: [preview],
    googlePlaces: {
      name: 'Sunny Shop',
      phone: '(999) 999-9999',
      address: '37917 Vine Street, Willoughby, OH 44094',
      website: 'http://wrong-place.test',
      primaryType: 'nail_salon',
      matchConfidence: 0.9,
    },
  });
  assert.equal(suggestions.businessProfile.name.value, null);
  assert.equal(suggestions.businessProfile.primaryType.value, 'hair_salon');
  assert.equal(suggestions.businessProfile.phone.source, 'Google Places');
});

test('normal website can use Google Places name only when match is corroborated', () => {
  const preview = previewHtml('<p>Call (440) 510-8230</p>', 'http://env-salon.test');
  const suggestions = buildSuggestions({
    sourceUrl: 'http://env-salon.test',
    sourceType: 'normal_website',
    previews: [preview],
    googlePlaces: {
      name: 'enV salon',
      phone: '(440) 510-8230',
      address: '37917 Vine Street, Willoughby, OH 44094',
      website: 'http://env-salon.test',
      primaryType: 'hair_salon',
      matchConfidence: 0.9,
    },
  });
  assert.equal(suggestions.businessProfile.name.value, 'enV salon');
  assert.equal(suggestions.businessProfile.name.source, 'Google Places');
  assert.equal(suggestions.businessProfile.primaryType.value, 'hair_salon');
  assert.equal(suggestions.businessProfile.primaryType.source, 'Google Places');
  assert.equal(suggestions.businessProfile.timezone.value, 'America/New_York');
});

test('extracts RAW Hair style footer hours, address, and JSON-LD organization name', () => {
  const preview = previewHtml(`
    <html><head>
      <title>RAW Hair & Co. | Modern Hair Salon in Dallas</title>
      <script type="application/ld+json">{"@graph":[{"@type":"WebPage","name":"RAW Hair & Co. | Modern Hair Salon in Dallas"},{"@type":"Organization","name":"RAW Hair & Co."}]}</script>
    </head><body>
      <footer>
        Address:223 N Bishop Ave, Dallas, TX 75208 Telephone:(469) 965-8500
        Hours Of Operation MondayCLOSED Tuesday10 AM - 5 PM Wednesday10 AM - 8 PM Thursday9 AM - 8 PM Friday & Saturday9 AM - 6 PM Sunday11 AM - 6 PM
      </footer>
    </body></html>
  `, 'https://rawhairandco.com');
  const suggestions = buildSuggestions({ sourceUrl: 'https://rawhairandco.com', sourceType: 'normal_website', previews: [preview] });
  assert.equal(suggestions.businessProfile.name.value, 'RAW Hair & Co.');
  assert.equal(suggestions.businessProfile.address.value, '223 N Bishop Ave, Dallas, TX 75208');
  assert.equal(suggestions.businessProfile.phone.value, '+14699658500');
  assert.deepEqual(suggestions.hours.value?.tue, { open: '10:00', close: '17:00' });
  assert.deepEqual(suggestions.hours.value?.sun, { open: '11:00', close: '18:00' });
});

test('infers hair salon when a mixed salon page is hair-service heavy', () => {
  const preview = previewHtml(
    `
      <html><head><title>enV salon &#8211; An Aveda Concept Salon</title></head><body>
        <h2>Color</h2>
        <p>Face Frame Retouch Color Retouch Corrective Color Partial Highlight Full Highlight Deposit-Only Color</p>
        <h2>Hair Cuts</h2>
        <p>Women Men Children Bang Trim Beard Trim Consultation</p>
        <h2>Extensions</h2>
        <p>Hotheads Donna Bella</p>
        <h2>Treatments</h2>
        <p>Brazilian Blowout Keratin Treatment Botanical Hair Conditioning</p>
        <h2>Nails</h2>
        <p>Manicure Pedicure</p>
      </body></html>
    `,
    'http://env-salon.test/services',
  );
  const suggestions = buildSuggestions({ sourceUrl: 'http://env-salon.test', sourceType: 'normal_website', previews: [preview] });
  assert.equal(suggestions.businessProfile.name.value, 'enV salon');
  assert.equal(suggestions.businessProfile.primaryType.value, 'hair_salon');
  assert.ok(suggestions.serviceCatalog.services.some((service) => service.categoryName === 'Hair Color' && service.name === 'Color Retouch'));
  assert.ok(suggestions.serviceCatalog.services.some((service) => service.categoryName === 'Haircuts' && service.name === 'Women'));
  assert.ok(suggestions.serviceCatalog.services.some((service) => service.categoryName === 'Nails' && service.name === 'Pedicure'));
  assert.ok(suggestions.serviceCatalog.services.some((service) => service.categoryName === 'Treatments' && service.name === 'Keratin Treatment'));
});

test('normalizes imported US phone numbers to E.164 for backend storage', () => {
  const preview = previewHtml('<script type="application/ld+json">{"@type":"HairSalon","name":"Salon 5014","telephone":"4694264308","address":{"streetAddress":"5014 Ross Ave","addressLocality":"Dallas","addressRegion":"TX"}}</script>', 'https://salon5014.test');
  const suggestions = buildSuggestions({ sourceUrl: 'https://salon5014.test', sourceType: 'normal_website', previews: [preview] });
  assert.equal(suggestions.businessProfile.phone.value, '+14694264308');
});

test('visible contact phone overrides stale JSON-LD phone and warns for review', () => {
  const preview = previewHtml(`
    <html><head>
      <script type="application/ld+json">{"@type":"HairSalon","name":"Unicorn Hair Queen","telephone":"+1 817-505-5236","address":{"streetAddress":"2811 McKinney Avenue","addressLocality":"Dallas","addressRegion":"TX"}}</script>
    </head><body>
      <h1>Contact</h1>
      <p>Get In Touch 214-919-3055 service@example.test</p>
    </body></html>
  `, 'https://unicorn.test/contact-us');
  const suggestions = buildSuggestions({ sourceUrl: 'https://unicorn.test', sourceType: 'normal_website', previews: [preview] });
  assert.equal(suggestions.businessProfile.phone.value, '+12149193055');
  assert.equal(suggestions.businessProfile.phone.source, 'Contact page');
  assert.ok(suggestions.warnings.some((warning) => /visible website phone differs/i.test(warning)));
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

test('detects generic repeated service cards without semantic service classes', () => {
  const preview = previewHtml(`
    <html><body>
      <section>
        <h2>Hair Services</h2>
        <div class="grid">
          <div class="tile"><h3>Balayage</h3><p>Dimensional color service.</p><span>Starting at $180</span><span>120 min</span><a>Book Now</a></div>
          <div class="tile"><h3>Root Touch Up</h3><p>Single-process root color.</p><span>$95</span><span>75 min</span><a>Book Now</a></div>
          <div class="tile"><h3>Blowout</h3><p>Shampoo and smooth blow dry.</p><span>from $58</span><span>30 min+</span></div>
        </div>
      </section>
    </body></html>
  `, 'https://generic-cards.test/services');
  const suggestions = buildSuggestions({ sourceUrl: 'https://generic-cards.test/services', sourceType: 'normal_website', previews: [preview] });
  const services = suggestions.serviceCatalog.services;
  assert.ok(services.some((service) => service.categoryName === 'Hair Services' && service.name === 'Balayage' && service.priceAmount === 180 && service.durationText === '120 min'));
  assert.ok(services.some((service) => service.name === 'Root Touch Up' && service.priceAmount === 95 && service.durationText === '75 min'));
  assert.ok(services.some((service) => service.name === 'Blowout' && service.priceType === 'from' && service.durationText === '30 min+'));
});

test('detects Shopify-style service menu cards even when cart text appears on the page', () => {
  const preview = previewHtml(`
    <html><head><title>Service Menu - Indigo Child</title></head><body>
      <h2>Your cart is empty</h2>
      <h2>Service Menu</h2>
      <section>
        <h2>Lightening + Color</h2>
        <div class="multicolumn-card"><div class="multicolumn-card__info"><h3>Custom Lightening</h3><div class="rte"><p>Price: $304 - $354+</p><p><strong>Description:</strong> Highlighting service for a transformation.</p></div><a>Book A Custom Lightening</a></div></div>
        <div class="multicolumn-card"><div class="multicolumn-card__info"><h3>Tint Retouch</h3><div class="rte"><p>Price $92 - $131+</p><p>Description: Maintenance root color service.</p></div><a>Book A Tint Retouch</a></div></div>
      </section>
      <section>
        <h2>Cutting + Styling</h2>
        <div class="multicolumn-card"><div class="multicolumn-card__info"><h3>Below Chin Haircut</h3><div class="rte"><p>Price $79 - $104+</p><p>Description: Customized haircut with styling included.</p></div><a>Book A Below Chin Haircut</a></div></div>
        <div class="multicolumn-card"><div class="multicolumn-card__info"><h3>Signature Blowout</h3><div class="rte"><p>Price $64 - $89+</p><p>Description: Shampoo and bouncy blowout.</p></div><a>Book A Signature Blowout</a></div></div>
      </section>
    </body></html>
  `, 'https://indigo.test/pages/service-menu');
  const suggestions = buildSuggestions({ sourceUrl: 'https://indigo.test/pages/service-menu', sourceType: 'normal_website', previews: [preview] });
  assert.ok(suggestions.serviceCatalog.services.some((service) => service.name === 'Custom Lightening' && service.priceAmount === 304 && service.priceType === 'from'));
  assert.ok(suggestions.serviceCatalog.services.some((service) => service.name === 'Tint Retouch' && service.priceAmount === 92));
  assert.ok(suggestions.serviceCatalog.services.some((service) => service.name === 'Below Chin Haircut' && service.categoryName === 'Cutting + Styling'));
  assert.equal(suggestions.serviceCatalog.services.some((service) => /cart is empty/i.test(service.name)), false);
});

test('generic repeated cards avoid policies, FAQs, contact blocks, and mark weak services for review', () => {
  const preview = previewHtml(`
    <html><body>
      <section>
        <h2>Services</h2>
        <div class="cards">
          <div class="box"><h3>Hair Extensions</h3><p>Consultation required before install.</p></div>
          <div class="box"><h3>Keratin Treatment</h3><p>Smoothing treatment for frizz.</p></div>
        </div>
      </section>
      <section>
        <h2>Policies</h2>
        <div class="box"><h3>Cancellation policy</h3><p>$50 fee for late cancellations.</p></div>
        <div class="box"><h3>Refund policy</h3><p>No refunds after service.</p></div>
      </section>
      <section>
        <h2>FAQ</h2>
        <div class="box"><h3>Do you accept walk-ins?</h3><p>Call us first.</p></div>
        <div class="box"><h3>Where are you located?</h3><p>123 Main St Dallas TX 75208</p></div>
      </section>
    </body></html>
  `, 'https://generic-cards.test/services');
  const suggestions = buildSuggestions({ sourceUrl: 'https://generic-cards.test/services', sourceType: 'normal_website', previews: [preview] });
  assert.ok(suggestions.serviceCatalog.services.some((service) => service.name === 'Hair Extensions' && service.priceType === 'consultation'));
  assert.ok(suggestions.serviceCatalog.services.some((service) => service.name === 'Keratin Treatment' && service.needsReview === true));
  assert.equal(suggestions.serviceCatalog.services.some((service) => /policy|walk-ins|located/i.test(service.name)), false);
});

test('splits bullet service rows into name, description, and duration', () => {
  const services = extractServicesFromText(
    'Blowout Essential Blowout Shampoo & Condition • Smooth Blow Dry • 30 min+',
    'https://rawhairandco.test/services',
  );
  const service = services.find((item) => item.name === 'Essential Blowout');
  assert.equal(service?.categoryName, 'Blowout');
  assert.equal(service?.description, 'Shampoo & Condition • Smooth Blow Dry');
  assert.equal(service?.durationText, '30 min+');
  assert.equal(service?.durationMinutes, 30);
  assert.equal(services.some((item) => /Smooth Blow Dry|30 min/i.test(item.name)), false);
});

test('extracts structured DOM service blocks with group, child name, description, and duration', () => {
  const preview = previewHtml(`
    <html><body>
      <h2>Blowout</h2>
      <div class="wp-block-column">
        <h3>Essential Blowout</h3>
        <p>Shampoo & Condition • Smooth Blow Dry • 30 min+</p>
      </div>
      <div class="wp-block-column">
        <h3>Signature Blowout</h3>
        <p>Shampoo & Condition • Round Brush Finish • 45 min+</p>
      </div>
    </body></html>
  `, 'https://rawhairandco.test/services');
  const suggestions = buildSuggestions({ sourceUrl: 'https://rawhairandco.test/services', sourceType: 'normal_website', previews: [preview] });
  const essential = suggestions.serviceCatalog.services.find((service) => service.name === 'Essential Blowout');
  assert.equal(essential?.categoryName, 'Blowout');
  assert.equal(essential?.description, 'Shampoo & Condition • Smooth Blow Dry');
  assert.equal(essential?.durationText, '30 min+');
  assert.equal(suggestions.serviceCatalog.services.some((service) => service.name === '30 min+'), false);
});

test('extracts Avalon-style service matrix as one service with duration and price variants', () => {
  const preview = previewHtml(`
    <html><body>
      <h2>Body Treatments</h2>
      <table>
        <tr><th></th><th>30 min</th><th>60 min</th><th>90 min</th></tr>
        <tr><td>Relaxing</td><td>$65+</td><td>$95+</td><td>$140+</td></tr>
        <tr><td>Therapeutic</td><td>-</td><td>$105+</td><td>$150+</td></tr>
      </table>
      <footer>Book your appointment today</footer>
    </body></html>
  `, 'https://avalon.test/spa/body');
  const suggestions = buildSuggestions({ sourceUrl: 'https://avalon.test', sourceType: 'normal_website', previews: [preview] });
  const relaxing = suggestions.serviceCatalog.services.find((service) => service.name === 'Relaxing');
  assert.equal(relaxing?.categoryName, 'Body Treatments');
  assert.equal(relaxing?.variants?.length, 3);
  assert.equal(relaxing?.variants?.[0]?.durationText, '30 min');
  assert.equal(relaxing?.variants?.[0]?.priceAmount, 65);
  assert.equal(relaxing?.variants?.[0]?.priceType, 'from');
  assert.equal(relaxing?.variants?.[2]?.durationText, '90 min');
  assert.equal(relaxing?.variants?.[2]?.priceAmount, 140);
  assert.equal(relaxing?.needsReview, true);
  assert.equal(suggestions.serviceCatalog.services.some((service) => /30 min|65/i.test(service.name)), false);
  assert.equal(suggestions.serviceCatalog.services.some((service) => /Book your appointment/i.test(service.name)), false);
});

test('extracts Avalon-style rendered text matrix without creating intro or duration-header services', () => {
  const preview = {
    url: 'https://avalon.test/spa/body',
    title: 'Body Treatments',
    h1: 'Body Treatments',
    h2s: ['Massage Therapy', 'Body Treatments'],
    firstTextChars: [
      'Body Treatments',
      'Massage Therapy',
      'Relax, Rejuvenate, and Restore with Luxurious Body Treatments & Massages at Avalon Salon and Spa.',
      'Your well-being is our priority at Avalon Salon and Spa.',
      '30 min',
      '60 min',
      '90 min',
      'Relaxing',
      '30 min$65+',
      '60 min $95+',
      '90 min$140+',
      'A massage including custom-blended Aveda essences and various relaxing techniques customized to your needs.',
      'Therapeutic',
      '30 min-',
      '60 min$105+',
      '90 min$150+',
      'A massage designed to release patterns of tension, stress and fatigue using deeper pressure and more focused techniques.',
      '30 min 60 min 90 min',
      'Relaxing$65+ $95+$140+',
      'Therapeutic-$105+$150+',
      'Promotions',
      'Shop Aveda',
      'Careers',
    ].join('\n'),
    links: [],
    jsonLd: [],
    priceCount: 6,
    durationCount: 12,
    serviceKeywordCount: 8,
    internalServiceLikeLinkCount: 0,
    contentScore: 80,
    serviceBlocks: [],
  };
  const suggestions = buildSuggestions({ sourceUrl: 'https://avalon.test', sourceType: 'normal_website', previews: [preview] });
  const relaxing = suggestions.serviceCatalog.services.find((service) => service.name === 'Relaxing');
  const therapeutic = suggestions.serviceCatalog.services.find((service) => service.name === 'Therapeutic');
  assert.equal(relaxing?.categoryName, 'Body Treatments');
  assert.equal(relaxing?.variants?.length, 3);
  assert.equal(relaxing?.variants?.[0]?.durationText, '30 min');
  assert.equal(relaxing?.variants?.[0]?.priceAmount, 65);
  assert.equal(relaxing?.variants?.[2]?.durationText, '90 min');
  assert.equal(relaxing?.variants?.[2]?.priceAmount, 140);
  assert.equal(therapeutic?.variants?.length, 2);
  assert.equal(therapeutic?.variants?.[0]?.durationText, '60 min');
  assert.equal(therapeutic?.variants?.[0]?.priceAmount, 105);
  assert.equal(suggestions.serviceCatalog.services.some((service) => /^Your well-being/i.test(service.name)), false);
  assert.equal(suggestions.serviceCatalog.services.some((service) => /\b30 min\s*60 min\s*90 min/i.test(service.name)), false);
});

test('extracts markdown price tables as individual services and duration variants', () => {
  const preview = {
    url: 'https://matrix-menu.test/services/cut',
    title: 'Cut',
    h1: 'Cut',
    h2s: [],
    firstTextChars: 'Cut services',
    markdown: [
      '# Cut',
      '| Women | $55+ |',
      '| --- | --- |',
      '| Men | $50+ |',
      '| Shampoo / Blow Dry / Style | $50+ |',
      '# Color',
      '#### Coloring',
      '| New Growth Root Retouch Single Process | $60+ |',
      '| --- | --- |',
      '| Color Balance | $10+ |',
      '| Creative Color Blonde, Red, Brunette | |',
      '| Please call or book online to schedule a complimentary consultation prior to appointment | |',
      '# Add-on Treatments',
      '| Brazilian Blowout | $250+ |',
      '# Massage',
      '| | 30 min | 60 min | 90 min |',
      '| Relaxing | $65+ | $95+ | $140+ |',
    ].join('\n'),
    links: [],
    jsonLd: [],
    priceCount: 6,
    durationCount: 0,
    serviceKeywordCount: 12,
    internalServiceLikeLinkCount: 0,
    contentScore: 80,
    serviceBlocks: [],
  };
  const suggestions = buildSuggestions({ sourceUrl: 'https://avalon.test', sourceType: 'normal_website', previews: [preview] });
  const byName = new Map(suggestions.serviceCatalog.services.map((service) => [service.name, service]));
  assert.equal(byName.get('Women')?.categoryName, 'Haircuts');
  assert.equal(byName.get('Women')?.priceAmount, 55);
  assert.equal(byName.get('Men')?.categoryName, 'Haircuts');
  assert.equal(byName.get('Shampoo / Blow Dry / Style')?.priceAmount, 50);
  assert.equal(byName.get('New Growth Root Retouch Single Process')?.categoryName, 'Hair Color');
  assert.equal(byName.get('Color Balance')?.name, 'Color Balance');
  assert.equal(byName.get('Brazilian Blowout')?.categoryName, 'Treatments');
  assert.equal(byName.get('Relaxing Massage')?.variants?.[0]?.durationText, '30 min');
  assert.equal(byName.get('Relaxing Massage')?.variants?.[2]?.priceAmount, 140);
  assert.equal(suggestions.serviceCatalog.services.some((service) => /Please call/i.test(service.name)), false);
});

test('extracts Elementor service-item cards with group, clean names, and prices', () => {
  const preview = previewHtml(`
    <html><body>
      <div id="tab-color" class="elementor-tab-title">Color</div>
      <div class="elementor-tab-content" aria-labelledby="tab-color">
        <div class="service-item"><div class="name">All Over Color</div><div class="price">Starting at $138</div></div>
        <div class="service-item"><div class="name">COLOR TOUCH-UP</div><div class="price">Starting at $118</div></div>
        <div class="service-item"><div class="name">FULL HIGHLIGHTS OR<br />LOWLIGHTS<br /><small>Involves Foil Technique</small></div><div class="price">Starting at $238</div></div>
      </div>
    </body></html>
  `, 'https://rawhairandco.test/services');
  const suggestions = buildSuggestions({ sourceUrl: 'https://rawhairandco.test', sourceType: 'normal_website', previews: [preview] });
  const services = suggestions.serviceCatalog.services;
  assert.ok(services.some((service) => service.categoryName === 'Hair Color' && service.name === 'All Over Color' && service.priceAmount === 138));
  assert.ok(services.some((service) => service.categoryName === 'Hair Color' && service.name === 'Color TOUCH-UP' && service.priceAmount === 118));
  assert.ok(services.some((service) => service.categoryName === 'Hair Color' && service.name === 'FULL HIGHLIGHTS OR LOWLIGHTS' && service.priceAmount === 238));
  assert.equal(services.some((service) => /Book Now|Involves|Starting/i.test(service.name)), false);
});

test('cleans hourly consultation service names while keeping starts-at pricing', () => {
  const preview = previewHtml(`
    <html><body>
      <div id="tab-color" class="elementor-tab-title">Color</div>
      <div class="elementor-tab-content" aria-labelledby="tab-color">
        <div class="service-item"><div class="name">CREATIVE HAIR COLOR<br /><small>Pricing is based on an hourly rate</small></div><div class="price">starting at $153</div><p>Consultation Required</p></div>
        <div class="service-item"><div class="name">HAIR COLOR CORRECTION<br /><small>Pricing is based on an hourly rate</small></div><div class="price">starting at $153</div><p>Consultation Required</p></div>
      </div>
    </body></html>
  `, 'https://rawhairandco.test/services');
  const suggestions = buildSuggestions({ sourceUrl: 'https://rawhairandco.test', sourceType: 'normal_website', previews: [preview] });
  const creative = suggestions.serviceCatalog.services.find((service) => service.name === 'CREATIVE HAIR COLOR');
  const correction = suggestions.serviceCatalog.services.find((service) => service.name === 'HAIR COLOR CORRECTION');
  assert.equal(creative?.priceAmount, 153);
  assert.equal(creative?.priceType, 'from');
  assert.equal(creative?.durationMinutes, null);
  assert.equal(creative?.durationText, null);
  assert.equal(correction?.priceAmount, 153);
  assert.equal(correction?.priceType, 'from');
  assert.equal(correction?.durationMinutes, null);
  assert.equal(suggestions.serviceCatalog.services.some((service) => /Pricing is based|Consultation Required|Book Now/i.test(service.name)), false);
});

test('extracts WordPress service menu links when service pages have no visible prices', () => {
  const preview = previewHtml(`
    <html><body>
      <h1>Hair Extensions in Dallas</h1>
      <nav>
        <a href="/services/">Overview</a>
        <a href="/services/balayage/">Balayage in Dallas</a>
        <a href="/services/hair-color-services/">Hair Color in Dallas</a>
        <a href="/services/brazilian-blowout-in-dallas/">Brazilian Blowout</a>
        <a href="/services/highlights/">Highlights</a>
        <a href="/services/hairextensions/">Hair Extensions</a>
        <a href="/services/hair-cut-stylist/">Dallas Haircuts</a>
        <a href="/services/bridal-hair-2/">Bridal Hair</a>
        <a href="/services/make-up/">Make-up</a>
      </nav>
      <p>We offer balayage, Brazilian blow-outs, haircuts, make-up, bridal hair, and more.</p>
    </body></html>
  `, 'https://unicorn.test');
  const suggestions = buildSuggestions({ sourceUrl: 'https://unicorn.test', sourceType: 'normal_website', previews: [preview] });
  const names = suggestions.serviceCatalog.services.map((service) => service.name);
  assert.ok(names.includes('Balayage'));
  assert.ok(names.includes('Hair Color'));
  assert.ok(names.includes('Brazilian Blowout'));
  assert.ok(names.includes('Hair Extensions'));
  assert.ok(names.includes('Haircuts'));
  assert.equal(names.includes('Overview'), false);
  assert.equal(suggestions.serviceCatalog.services.find((service) => service.name === 'Balayage')?.priceType, 'varies');
  assert.equal(suggestions.serviceCatalog.services.find((service) => service.name === 'Hair Extensions')?.categoryName, 'Hair Extensions');
  assert.equal(suggestions.serviceCatalog.services.find((service) => service.name === 'Make-up')?.categoryName, 'Makeup');
});

test('collapses WordPress stylist-level pricing into the service instead of level rows', () => {
  const preview = previewHtml(`
    <html><body>
      <h1>Balayage in Dallas</h1>
      <a href="/services/balayage/">Balayage in Dallas</a>
      <h2>Balayage Pricing</h2>
      <p>Assistant stylists $ 167 50</p>
      <p>Level 1 stylists $ 335</p>
      <p>Level 2 stylists $ 345</p>
      <p>Level 3 stylists $ 355</p>
    </body></html>
  `, 'https://unicorn.test/services/balayage');
  const suggestions = buildSuggestions({ sourceUrl: 'https://unicorn.test', sourceType: 'normal_website', previews: [preview] });
  const services = suggestions.serviceCatalog.services;
  const balayage = services.find((service) => service.name === 'Balayage');
  assert.equal(balayage?.categoryName, 'Hair Color');
  assert.equal(balayage?.priceAmount, 167.5);
  assert.equal(balayage?.priceType, 'from');
  assert.match(balayage?.bookingNotes ?? '', /Level 1 stylists \$335/);
  assert.equal(services.some((service) => /Level 1|Assistant stylists/i.test(service.name)), false);
});

test('extracts service pricing that appears below long WordPress page copy', () => {
  const filler = '<p>Hair extensions salon copy.</p>'.repeat(180);
  const preview = previewHtml(`
    <html><body>
      <h1>Hair Extensions</h1>
      ${filler}
      <h2>Hair Extensions Pricing</h2>
      <p>Assistant Stylists $ 599</p>
      <p>Level 1 Stylists $ 799</p>
    </body></html>
  `, 'https://unicorn.test/services/hairextensions');
  const suggestions = buildSuggestions({ sourceUrl: 'https://unicorn.test', sourceType: 'normal_website', previews: [preview] });
  const extensions = suggestions.serviceCatalog.services.find((service) => service.name === 'Hair Extensions');
  assert.equal(extensions?.priceAmount, 599);
  assert.equal(extensions?.priceType, 'from');
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
  assert.equal(secondary.staffSuggestions.some((staff) => staff.name === 'Cancellation Policy'), false);
  assert.equal(secondary.policySuggestions[0]?.type, 'cancellation');
  assert.equal(secondary.faqSuggestions[0]?.question, 'Do you accept walk-ins?');
  assert.equal(secondary.promotionSuggestions.length > 0, true);
  assert.equal(secondary.bookingSetupSuggestions[0]?.platform, 'vagaro');

  const suggestions = buildSuggestions({ sourceUrl: 'https://knowledge.test', sourceType: 'normal_website', previews: [preview] });
  assert.equal(suggestions.staffSuggestions.length, 1);
  assert.equal(JSON.stringify(suggestions).includes('<script>'), false);
});

test('extracts artist page staff names and bio snippets from heading cards', () => {
  const preview = previewHtml(`
    <html>
      <head><title>Artists - enV salon</title></head>
      <body class="artists">
        <article>
          <div class="flexible-column-wrapper"><p><img src="/danielle.jpg" /></p><h3>Danielle</h3></div>
          <div class="flexible-column-wrapper"><h3>Maryann</h3><p>Senior color artist specializing in Aveda color.</p></div>
          <div class="flexible-column-wrapper"><h3>Ava</h3><p>Styling and blowouts.</p></div>
        </article>
      </body>
    </html>
  `, 'http://env-salon.test/artists');
  const secondary = extractSecondaryKnowledge([preview]);
  assert.ok(secondary.staffSuggestions.some((staff) => staff.name === 'Danielle' && staff.role === 'Artist'));
  const maryann = secondary.staffSuggestions.find((staff) => staff.name === 'Maryann');
  assert.equal(maryann?.bio, 'Senior color artist specializing in Aveda color.');
  assert.equal(secondary.staffSuggestions.some((staff) => /Artists?|Salon/i.test(staff.name)), false);
});

test('extracts staff lines with slash role separators', () => {
  const preview = previewHtml(`
    <html><body>
      <h1>Meet the Team</h1>
      <h2>Guest Care</h2>
      <p>Zoey S.</p>
      <h2>Stylists</h2>
      <p>Bailey // Hair Stylist</p>
      <p>Jess | Colorist</p>
    </body></html>
  `, 'https://slash-staff.test/team');
  const secondary = extractSecondaryKnowledge([preview]);

  assert.ok(secondary.staffSuggestions.some((staff) => staff.name === 'Bailey' && staff.role === 'Hair Stylist'));
  assert.ok(secondary.staffSuggestions.some((staff) => staff.name === 'Jess' && staff.role === 'Colorist'));
  assert.ok(secondary.staffSuggestions.some((staff) => staff.name === 'Zoey S.' && staff.role === 'Guest Care'));
});

test('extracts prices from markdown service headings without description bleed', () => {
  const preview = {
    ...previewHtml('<html><body><h1>Services</h1></body></html>', 'https://markdown-price.test/color'),
    markdown: [
      '## Hair Color',
      'Color application for up to 1 Inch of regrowth.',
      '#### Retouch $60+',
      'Recommended Maintenance: 6-8 Weeks',
      '#### Full Balayage $215+',
    ].join('\n'),
  };
  const suggestions = buildSuggestions({ sourceUrl: 'https://markdown-price.test', sourceType: 'normal_website', previews: [preview] });

  assert.equal(suggestions.serviceCatalog.services.find((service) => service.name === 'Retouch')?.priceAmount, 60);
  assert.equal(suggestions.serviceCatalog.services.find((service) => service.name === 'Retouch')?.priceType, 'from');
  assert.equal(suggestions.serviceCatalog.services.find((service) => service.name === 'Full Balayage')?.priceAmount, 215);
  assert.equal(suggestions.serviceCatalog.services.some((service) => /Color application/i.test(service.name)), false);
});

test('extracts unpriced markdown service headings inside service sections', () => {
  const preview = {
    ...previewHtml('<html><body><h1>Services</h1></body></html>', 'https://markdown-price.test/textureandextentions'),
    markdown: [
      '## Texture + Extensions',
      '### Texture Treatments',
      '#### Keratin Treatment $350+',
      '#### Beaded Sew-in Wefts',
      '### Hair Extensions',
      '#### Vomor Tape-ins',
      '## Contact',
      '#### Gilbert: 480.786.9778',
    ].join('\n'),
  };
  const suggestions = buildSuggestions({ sourceUrl: 'https://markdown-price.test', sourceType: 'normal_website', previews: [preview] });

  assert.ok(suggestions.serviceCatalog.services.some((service) => service.name === 'Beaded Sew-in Wefts' && service.categoryName === 'Texture Treatments' && service.priceType === 'consultation'));
  assert.ok(suggestions.serviceCatalog.services.some((service) => service.name === 'Vomor Tape-ins' && service.categoryName === 'Hair Extensions'));
  assert.equal(suggestions.serviceCatalog.services.some((service) => /Gilbert/i.test(service.name)), false);
});

test('extracts Love and Hair Peace style services, staff, and visible FAQs', () => {
  const servicesPreview = previewHtml(`
    <html><body>
      <h1>Our Services</h1>
      <h2>Basic Services</h2>
      <ul>
        <li>Hair Cuts</li>
        <li>Hair Color</li>
        <li>Blow out style</li>
      </ul>
      <h2>Hair Restoration / Extension Methods</h2>
      <ul>
        <li>Cyberhair Accents</li>
        <li>Micro Point Links & Solutions</li>
        <li>Seamless hair extensions</li>
      </ul>
      <a href="/areas-of-service/harrisburg-hair-extensions">Hair Extensions Harrisburg</a>
      <a href="/service_type/hair-extensions/">Hair Extensions</a>
    </body></html>
  `, 'https://love.test/our-services');
  const taxonomyPreview = previewHtml(`
    <html><body>
      <h1>Hair Extensions</h1>
      <ul><li>Uncategorized 0</li></ul>
    </body></html>
  `, 'https://love.test/service_type/hair-extensions');
  const seoContentPreview = previewHtml(`
    <html><body>
      <h1>Hair Loss Specialists Philadelphia</h1>
      <h2>Exceptional Treatments for All Hair Types</h2>
      <ul>
        <li>Straight hair</li>
        <li>Wavy hair</li>
        <li>Curly hair</li>
      </ul>
      <h2>Contact Us</h2>
    </body></html>
  `, 'https://love.test/hair-loss-specialists-philadelphia');
  const staffPreview = previewHtml(`
    <html><head><title>Staff - Love And Hair Peace</title></head><body>
      <h1>Staff</h1>
      <h2>Cassie</h2>
      <h3>Hair Restoration & Extension Expert/Salon Owner</h3>
      <p>Cassie is a seasoned hair stylist and cosmetic hair restoration expert.</p>
      <h2>Kate</h2>
      <h3>Master Colorist/Hairstylist</h3>
      <p>Kate has been a prominent figure in the beauty industry since 2005.</p>
    </body></html>
  `, 'https://love.test/staff');
  const faqPreview = previewHtml(`
    <html><head><title>FAQ - Love And Hair Peace</title></head><body>
      <h1>FAQ</h1>
      <h2>Do I have to come in for a consultation?</h2>
      <p>Yes, a consultation helps us choose the right hair solution.</p>
      <h2>How long do extensions last?</h2>
      <p>Longevity depends on the method, hair type, and home care.</p>
    </body></html>
  `, 'https://love.test/faq');

  const suggestions = buildSuggestions({ sourceUrl: 'https://love.test', sourceType: 'normal_website', previews: [servicesPreview, taxonomyPreview, seoContentPreview, staffPreview, faqPreview] });
  assert.ok(suggestions.serviceCatalog.services.some((service) => service.name === 'Hair Cuts' && service.categoryName === 'Haircuts'));
  assert.ok(suggestions.serviceCatalog.services.some((service) => service.name === 'Cyberhair Accents' && service.categoryName === 'Hair Restoration / Extension Methods'));
  assert.ok(suggestions.serviceCatalog.services.some((service) => service.name === 'Seamless hair extensions' && service.priceType === 'varies'));
  assert.equal(suggestions.serviceCatalog.services.some((service) => /Basic Services/i.test(service.name)), false);
  assert.equal(suggestions.serviceCatalog.services.some((service) => /Uncategorized|Harrisburg|Straight hair|Wavy hair|Curly hair/i.test(service.name)), false);
  assert.ok(suggestions.staffSuggestions.some((staff) => staff.name === 'Cassie' && staff.role === 'Hair Restoration & Extension Expert/Salon Owner'));
  assert.ok(suggestions.staffSuggestions.some((staff) => staff.name === 'Kate' && /prominent figure/i.test(staff.bio ?? '')));
  assert.ok(suggestions.faqSuggestions.some((faq) => faq.question === 'Do I have to come in for a consultation?'));
  assert.ok(suggestions.faqSuggestions.some((faq) => faq.question === 'How long do extensions last?'));
});
