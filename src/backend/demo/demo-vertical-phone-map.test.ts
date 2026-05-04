import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMergedOpenAiSipDemoDidMap,
  buildOpenAiSipDemoDidMapFromVerticalEnvPhones,
  getDemoVerticalByPhoneNumber,
  mergeOpenAiSipJsonAndVerticalEnvDemoMaps,
} from '@/src/backend/demo/demo-vertical-phone-map';
import { parseOpenAiSipDidMapJson } from '@/src/backend/webhooks/openai-sip-did';

test('buildOpenAiSipDemoDidMapFromVerticalEnvPhones skips unset and normalizes E.164', () => {
  const map = buildOpenAiSipDemoDidMapFromVerticalEnvPhones({
    DEMO_PHONE_NAIL_SALON: '+1 (626) 501-3960',
    DEMO_PHONE_MED_SPA: undefined,
  });
  assert.equal(map.get('+16265013960')?.vertical, 'nail-salon');
  assert.equal(map.size, 1);
});

test('mergeOpenAiSipJsonAndVerticalEnvDemoMaps lets JSON override env on duplicate DID', () => {
  const envMap = buildOpenAiSipDemoDidMapFromVerticalEnvPhones({
    DEMO_PHONE_NAIL_SALON: '+15550001111',
  });
  const jsonMap = parseOpenAiSipDidMapJson(
    JSON.stringify([{ did: '+15550001111', vertical: 'med-spa', defaultShopName: 'JSON wins' }]),
  );
  const merged = mergeOpenAiSipJsonAndVerticalEnvDemoMaps(jsonMap, envMap);
  assert.equal(merged.get('+15550001111')?.vertical, 'med-spa');
  assert.equal(merged.get('+15550001111')?.defaultShopName, 'JSON wins');
});

test('getDemoVerticalByPhoneNumber falls back when no match', () => {
  const merged = buildMergedOpenAiSipDemoDidMap({
    DEMO_PHONE_NAIL_SALON: '+15550002222',
  });
  const hit = getDemoVerticalByPhoneNumber('+15550002222', merged);
  assert.equal(hit.vertical, 'nail-salon');
  assert.equal(hit.matchedConfiguredLine, true);

  const miss = getDemoVerticalByPhoneNumber('+19999999999', merged, { fallbackVertical: 'beauty-clinic' });
  assert.equal(miss.vertical, 'beauty-clinic');
  assert.equal(miss.matchedConfiguredLine, false);
});
