import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  composeVoicePrompt,
  inferVerticalFromBusinessConfig,
  normalizeOpenAiRealtimeVoice,
  openAiRealtimeVoiceForDemoVerticalSlug,
} from './index';

describe('voice prompt composer', () => {
  it('preserves runtime welcome when prompt is compacted for length', () => {
    const services = Array.from({ length: 28 }).map((_, i) => ({
      category: 'Manicure',
      name: `${'S'.repeat(90)}${i}`,
      price: 99,
      duration: '30 min',
    }));
    const welcome = 'UNIQUE_WELCOME_TOKEN Hi, it is Mai at Luna Nail Bar.';
    const prompt = composeVoicePrompt({
      vertical: 'nail-salon',
      callType: 'demo_outbound',
      mode: 'demo',
      business: {
        businessName: 'Luna Nail Bar',
        businessType: 'nail salon',
        welcomeMessage: welcome,
        hours: 'H'.repeat(700),
        location: 'L'.repeat(120),
        demoContext: 'D'.repeat(900),
        callerContext: 'C'.repeat(900),
        customInstructions: 'I'.repeat(900),
        services,
      },
    });

    assert.ok(prompt.length <= 18_000 + 5, 'prompt should respect max length budget');
    assert.match(prompt, /UNIQUE_WELCOME_TOKEN/);
    assert.match(prompt, /WELCOME MESSAGE:/);
    assert.match(prompt, /Prompt compacted to fit latency\/context budget/);
  });

  it('production without shopPlan fails safe: strips bilingual vertical and overrides risky runtime language fields', () => {
    const prompt = composeVoicePrompt({
      vertical: 'nail-salon',
      callType: 'inbound_booking',
      mode: 'production',
      shopLanguages: ['en', 'vi'],
      business: {
        businessName: 'Leak Test Nails',
        businessType: 'nail salon',
        languageOptions: ['English', 'Vietnamese'],
        productionLanguageDirective: 'BILINGUAL WORKFLOW: You may respond in any language.',
      },
    });

    assert.doesNotMatch(prompt, /\nLANGUAGE OPTIONS:/);
    assert.doesNotMatch(prompt, /BILINGUAL WORKFLOW/);
    assert.doesNotMatch(prompt, /respond naturally in Vietnamese/i);
    assert.match(prompt, /LANGUAGE POLICY \(STARTER PLAN\)/);
    assert.doesNotMatch(prompt, /Detect and match the caller[\u2019']s language automatically/);
  });

  it('nail demo stays English-only and strips vertical Vietnamese wording', () => {
    const prompt = composeVoicePrompt({
      vertical: 'nail-salon',
      callType: 'demo_outbound',
      mode: 'demo',
      business: {
        businessName: 'Demo Nails',
        businessType: 'nail salon',
      },
    });

    assert.match(prompt, /NAIL DEMO LANGUAGE OVERRIDE/i);
    assert.match(prompt, /Keep spoken dialogue in English only/i);
    assert.doesNotMatch(prompt, /If the caller speaks Vietnamese/i);
    assert.doesNotMatch(prompt, /\bVietnamese\b/i);
    assert.doesNotMatch(prompt, /Dạ được/i);
    assert.doesNotMatch(prompt, /Cái đó mình/i);
  });

  it('keeps demo behavior isolated from production prompts', () => {
    const demoPrompt = composeVoicePrompt({
      vertical: 'nail-salon',
      callType: 'demo_outbound',
      mode: 'demo',
      business: {
        businessName: 'ABC Nails Studio',
        businessType: 'nail salon',
        welcomeMessage: 'Hi, thank you for calling ABC Nails Studio.',
      },
    });

    const productionPrompt = composeVoicePrompt({
      vertical: 'nail-salon',
      callType: 'inbound_booking',
      mode: 'production',
      business: {
        businessName: 'ABC Nails Studio',
        businessType: 'nail salon',
        welcomeMessage: 'Hi, thank you for calling ABC Nails Studio.',
      },
    });

    assert.match(demoPrompt, /Isolated web demo only/);
    assert.match(demoPrompt, /Demo-only vertical color/);
    assert.doesNotMatch(productionPrompt, /Isolated web demo only/);
    assert.doesNotMatch(productionPrompt, /Demo-only vertical color/);
  });

  it('keeps vertical behavior specific to the selected vertical', () => {
    const prompt = composeVoicePrompt({
      vertical: 'med-spa',
      callType: 'inbound_booking',
      mode: 'production',
      business: {
        businessName: 'Astra Med Spa',
        businessType: 'med spa',
        services: [{ name: 'Botox / Dysport', duration: 'Consult required' }],
      },
    });

    assert.match(prompt, /consultation-first/);
    assert.doesNotMatch(prompt, /dip powder/i);
  });

  it('infers vertical from runtime services when production has no explicit field yet', () => {
    assert.equal(
      inferVerticalFromBusinessConfig({
        businessName: 'Willow Hair Lounge',
        services: [{ name: 'Color Consultation' }, { name: 'Keratin Treatment' }],
      }),
      'hair-salon',
    );
  });

  it('infers nail salon instead of falling back to hair salon', () => {
    assert.equal(
      inferVerticalFromBusinessConfig({
        businessName: 'Polished Studio',
        businessType: 'nail salon',
        services: [{ name: 'Gel Manicure' }, { name: 'Dip Powder' }],
      }),
      'nail-salon',
    );
  });

  it('maps OpenAI Realtime demo voices by vertical with marin fallback', () => {
    assert.equal(openAiRealtimeVoiceForDemoVerticalSlug('nail-salon'), 'coral');
    assert.equal(openAiRealtimeVoiceForDemoVerticalSlug('hair-salon'), 'marin');
    assert.equal(openAiRealtimeVoiceForDemoVerticalSlug('day-spa'), 'sage');
    assert.equal(openAiRealtimeVoiceForDemoVerticalSlug('med-spa'), 'cedar');
    assert.equal(openAiRealtimeVoiceForDemoVerticalSlug('beauty-clinic'), 'cedar');
    assert.equal(openAiRealtimeVoiceForDemoVerticalSlug('unknown-vertical'), 'marin');
    assert.equal(normalizeOpenAiRealtimeVoice('not-a-voice'), 'marin');
  });
});
