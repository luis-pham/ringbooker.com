import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { composeVoicePrompt, inferVerticalFromBusinessConfig } from './index';

describe('voice prompt composer', () => {
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

    assert.match(demoPrompt, /DEMO ISOLATION GUARDRAILS/);
    assert.match(demoPrompt, /CALL-TYPE PROMPT PACK: Web Voice Demo Call/);
    assert.doesNotMatch(productionPrompt, /DEMO ISOLATION GUARDRAILS/);
    assert.doesNotMatch(productionPrompt, /CALL-TYPE PROMPT PACK: Web Voice Demo Call/);
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

    assert.match(prompt, /VERTICAL PROMPT PACK: Med Spa/);
    assert.match(prompt, /consultation-first/);
    assert.doesNotMatch(prompt, /VERTICAL: NAIL SALON/);
    assert.doesNotMatch(prompt, /dip powder/i);
  });

  it('infers vertical from runtime services when production has no explicit field yet', () => {
    assert.equal(
      inferVerticalFromBusinessConfig({
        businessName: 'Willow Hair Lounge',
        services: [{ name: 'Balayage Consultation' }, { name: 'Keratin Treatment' }],
      }),
      'hair-salon',
    );
  });
});
