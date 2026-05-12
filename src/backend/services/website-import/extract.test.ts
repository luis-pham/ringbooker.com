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
  assert.ok(suggestions.serviceCatalog.services.some((service) => service.categoryName === 'Color' && service.name === 'Color Retouch'));
  assert.ok(suggestions.serviceCatalog.services.some((service) => service.categoryName === 'Hair Cuts' && service.name === 'Women'));
  assert.ok(suggestions.serviceCatalog.services.some((service) => service.categoryName === 'Nails' && service.name === 'Pedicure'));
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
  assert.ok(services.some((service) => service.categoryName === 'Color' && service.name === 'All Over Color' && service.priceAmount === 138));
  assert.ok(services.some((service) => service.categoryName === 'Color' && service.name === 'Color TOUCH-UP' && service.priceAmount === 118));
  assert.ok(services.some((service) => service.categoryName === 'Color' && service.name === 'FULL HIGHLIGHTS OR LOWLIGHTS' && service.priceAmount === 238));
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
