import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { assistantTranscriptEndsDemo } from './demo-end-call';

describe('assistantTranscriptEndsDemo', () => {
  it('detects final English goodbye turns', () => {
    assert.equal(assistantTranscriptEndsDemo('Thanks for calling. Have a great day!'), true);
    assert.equal(assistantTranscriptEndsDemo('Feel free to call back anytime. Goodbye!'), true);
  });

  it('detects final Vietnamese and Spanish goodbye turns', () => {
    assert.equal(assistantTranscriptEndsDemo('Cam on anh, tam biet.'), true);
    assert.equal(assistantTranscriptEndsDemo('Cảm ơn chị, chúc chị một ngày tốt lành.'), true);
    assert.equal(assistantTranscriptEndsDemo('Gracias por llamar. Adiós.'), true);
    assert.equal(assistantTranscriptEndsDemo('Gracias, hasta luego.'), true);
    assert.equal(assistantTranscriptEndsDemo('Que tenga un buen día.'), true);
  });

  it('detects final Chinese and Korean goodbye turns', () => {
    assert.equal(assistantTranscriptEndsDemo('谢谢来电，再见。'), true);
    assert.equal(assistantTranscriptEndsDemo('祝您一天愉快。'), true);
    assert.equal(assistantTranscriptEndsDemo('전화해 주셔서 감사합니다. 안녕히 계세요.'), true);
    assert.equal(assistantTranscriptEndsDemo('좋은 하루 되세요.'), true);
  });

  it('does not treat the opening greeting as a final goodbye', () => {
    assert.equal(
      assistantTranscriptEndsDemo('Thank you for calling Avalon Salon and Spa, how can I help you today?'),
      false,
    );
  });
});
