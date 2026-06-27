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
