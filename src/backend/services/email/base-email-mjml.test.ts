import test from 'node:test';
import assert from 'node:assert/strict';

import { renderBaseEmailHtml } from '@/src/backend/services/email/base-email-mjml';

test('renderBaseEmailHtml strips CTA blocks when no cta pair', async () => {
  const html = await renderBaseEmailHtml({
    title: 'T',
    previewText: 'P',
    heroTitle: 'H',
    bodyHtml: '<p style="margin:0">Body</p>',
  });
  assert.ok(html);
  assert.ok(!html.includes('{{rb_'));
  assert.ok(!html.includes('If the button does not work'));
});

test('renderBaseEmailHtml includes CTA and fallback when cta pair valid', async () => {
  const html = await renderBaseEmailHtml({
    title: 'T',
    previewText: 'P',
    heroTitle: 'H',
    bodyHtml: '<p style="margin:0">B</p>',
    ctaLabel: 'Go',
    ctaUrl: 'https://ringbooker.com/demo',
  });
  assert.ok(html);
  assert.ok(html.includes('https://ringbooker.com/demo'));
  assert.ok(html.includes('If the button does not work'));
});

test('renderBaseEmailHtml throws on non-absolute ctaUrl', async () => {
  await assert.rejects(
    () =>
      renderBaseEmailHtml({
        title: 'T',
        previewText: 'P',
        heroTitle: 'H',
        bodyHtml: '<p>x</p>',
        ctaLabel: 'Go',
        ctaUrl: '/relative',
      }),
  );
});
