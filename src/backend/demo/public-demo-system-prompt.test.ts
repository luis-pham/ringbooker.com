import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPublicDemoSystemPrompt } from '@/src/backend/demo/public-demo-system-prompt';

test('imported demo config can disable vertical sample fallbacks', () => {
  const prompt = buildPublicDemoSystemPrompt({
    shopName: 'Imported Salon',
    businessType: 'hair salon',
    demoVertical: 'hair-salon',
    demoConfig: {
      address: '2100 Virginia Drive, Suite C, Grand Prairie, TX 75051',
      city: 'Grand Prairie, TX',
      primaryHours: '',
      secondaryHours: '',
      staffNames: [],
      services: [],
      useDefaultFallbacks: false,
    },
  });

  assert.match(prompt, /LOCATION: 2100 Virginia Drive, Suite C, Grand Prairie, TX 75051/);
  assert.match(prompt, /SERVICES \/ PRICING: Not configured/);
  assert.doesNotMatch(prompt, /Austin, TX/);
  assert.doesNotMatch(prompt, /America\/Chicago/);
  assert.doesNotMatch(prompt, /Tue.?Sat 9am.?6pm/);
  assert.doesNotMatch(prompt, /\bMia\b/);
  assert.doesNotMatch(prompt, /\bJordan\b/);
  assert.doesNotMatch(prompt, /Women's Haircut/);
});

test('vertical sample fallbacks still populate plain sample demos', () => {
  const prompt = buildPublicDemoSystemPrompt({
    shopName: 'Sample Hair Studio',
    businessType: 'hair salon',
    demoVertical: 'hair-salon',
  });

  assert.match(prompt, /Austin, TX/);
  assert.match(prompt, /America\/Chicago/);
  assert.match(prompt, /\bMia\b/);
  assert.match(prompt, /Women's Haircut/);
});

test('demo config service variants are rendered into the demo prompt', () => {
  const prompt = buildPublicDemoSystemPrompt({
    shopName: 'Imported Salon',
    businessType: 'hair salon',
    demoVertical: 'hair-salon',
    demoConfig: {
      useDefaultFallbacks: false,
      services: [
        {
          category: 'Haircuts',
          name: 'Haircut & Style',
          price: 65,
          duration: '45 min',
          enabled: true,
          variants: [
            { label: "Women's cut", price: 75, duration: '60 min', priceType: 'fixed' },
            { label: "Men's cut", price: 55, duration: '45 min', priceType: 'fixed' },
          ],
        },
      ],
    },
  });

  assert.match(prompt, /Haircut & Style/);
  assert.match(prompt, /Options:/);
  assert.match(prompt, /Women's cut/);
  assert.match(prompt, /\$75/);
  assert.match(prompt, /Men's cut/);
  assert.match(prompt, /\$55/);
  assert.match(prompt, /SERVICE OPTION RULE/);
});

test('demo prompt renders the default hair-salon Balayage Consultation ($0) as free, not "price varies"', () => {
  // Reproduces the exact scenario from the live demo call bug report: shopName is arbitrary
  // ("Luna Hair Studio"), but with no custom demoConfig.services the hair-salon vertical
  // defaults (including the genuinely free Balayage Consultation) are used as-is.
  const prompt = buildPublicDemoSystemPrompt({
    shopName: 'Luna Hair Studio',
    businessType: 'hair salon',
    demoVertical: 'hair-salon',
  });

  assert.match(prompt, /Balayage Consultation \| free \| 20 min/);
  assert.doesNotMatch(prompt, /Balayage Consultation[^\n]*varies/);
});

test('demo prompt renders an imported $0 service as free, not "price varies"', () => {
  const prompt = buildPublicDemoSystemPrompt({
    shopName: 'Luna Hair Studio',
    businessType: 'hair salon',
    demoVertical: 'hair-salon',
    demoConfig: {
      useDefaultFallbacks: false,
      services: [
        { category: 'Color', name: 'Balayage Consultation', price: 0, duration: '20 min', enabled: true },
        { category: 'Cut & Style', name: "Women's Haircut", price: 65, duration: '60 min', enabled: true },
      ],
    },
  });

  assert.match(prompt, /Balayage Consultation \| free \| 20 min/);
  assert.match(prompt, /Women's Haircut \| \$65 \| 60 min/);
});

test('demo prompt instructs the model to treat any in-hours time as available and never invent a closing buffer or reverse a confirmed time', () => {
  const prompt = buildPublicDemoSystemPrompt({
    shopName: 'Luna Hair Studio',
    businessType: 'hair salon',
    demoVertical: 'hair-salon',
  });

  assert.match(prompt, /BOOKING TIME CHECK/);
  assert.match(prompt, /check it against this business's WEEKLY SCHEDULE and the requested service's duration -- nothing else/);
  assert.match(prompt, /Do not invent any other reason a time might be unavailable: no extra buffer before closing/);
  assert.match(prompt, /do not reverse that decision later in the same call/);

  // "Compute before deciding" instruction, added after a live re-test showed the model still
  // rejected 6 PM + 20 min against a 7 PM close after the first round of examples -- it stated
  // the correct facts (close time, duration) but reached the wrong conclusion from them.
  assert.match(prompt, /Do the math first, then decide -- never state a conclusion and work backward to justify it/);
  assert.match(prompt, /never reject a time because it starts "late in the day" without actually computing where it ends/);

  // Rejecting a time must come with a concrete alternative, and caller pushback after a
  // rejection must re-anchor on the still-unresolved time, not repeat the same rejection.
  assert.match(prompt, /always propose at least one specific alternative start time that is within business hours/);
  assert.match(prompt, /treat the time question as still unresolved: restate your proposed alternative time and ask them to confirm it/);

  // Worked examples (step-by-step arithmetic, with an explicit "End time = " computed value).
  assert.match(prompt, /service duration 20 min, requested start 6:00 PM\. End time = 6:00 PM \+ 20 min = 6:20 PM\. 6:20 PM is before 7:00 PM -- AVAILABLE/);
  assert.match(prompt, /service duration 2\.5 hr \(150 min\), requested start 6:00 PM\. End time = 6:00 PM \+ 2 hr 30 min = 8:30 PM\. 8:30 PM is after 7:00 PM -- NOT AVAILABLE/);
  assert.match(prompt, /service duration 60 min, requested start 6:00 PM\. End time = 6:00 PM \+ 60 min = 7:00 PM exactly\. Ending exactly at close time still counts as available -- AVAILABLE/);
});
