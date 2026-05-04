import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMergedOpenAiSipDemoDidMap,
  buildOpenAiSipDemoDidMapFromVerticalEnvPhones,
  getDemoVerticalByPhoneNumber,
  mergeOpenAiSipJsonAndVerticalEnvDemoMaps,
  resolveVerticalDemoInboundRoute,
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

test('resolveVerticalDemoInboundRoute returns vertical for each DEMO_PHONE_* line', () => {
  const env = {
    DEMO_PHONE_NAIL_SALON: '+15550001001',
    DEMO_PHONE_HAIR_SALON: '+15550001002',
    DEMO_PHONE_DAY_SPA: '+15550001003',
    DEMO_PHONE_MED_SPA: '+15550001004',
    DEMO_PHONE_BEAUTY_CLINIC: '+15550001005',
  };
  assert.equal(resolveVerticalDemoInboundRoute('+15550001001', env)?.vertical, 'nail-salon');
  assert.equal(resolveVerticalDemoInboundRoute('+15550001002', env)?.vertical, 'hair-salon');
  assert.equal(resolveVerticalDemoInboundRoute('+15550001003', env)?.vertical, 'day-spa');
  assert.equal(resolveVerticalDemoInboundRoute('+15550001004', env)?.vertical, 'med-spa');
  assert.equal(resolveVerticalDemoInboundRoute('+15550001005', env)?.vertical, 'beauty-clinic');
  assert.equal(resolveVerticalDemoInboundRoute('+19999999999', env), null);
});

test('resolveVerticalDemoInboundRoute honors OPENAI_SIP_DEMO_DID_MAP_JSON override', () => {
  const env = {
    DEMO_PHONE_NAIL_SALON: '+15550002001',
    OPENAI_SIP_DEMO_DID_MAP_JSON: JSON.stringify([
      { did: '+15550002001', vertical: 'med-spa', defaultShopName: 'Override Med' },
    ]),
  };
  assert.equal(resolveVerticalDemoInboundRoute('+15550002001', env)?.vertical, 'med-spa');
  assert.equal(resolveVerticalDemoInboundRoute('+15550002001', env)?.defaultShopName, 'Override Med');
});
