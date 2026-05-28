import test from 'node:test';
import assert from 'node:assert/strict';

import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';
import { resetEnvCacheForTests } from '@/src/backend/config/env';
import { logEmailRuntimeStartup } from '@/src/backend/services/email/startup';

applyRequiredTestEnv();

function setEnvValue(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

test('logEmailRuntimeStartup throws in production when EMAIL_PROVIDER is noop', () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevProvider = process.env.EMAIL_PROVIDER;
  setEnvValue('NODE_ENV', 'production');
  setEnvValue('EMAIL_PROVIDER', 'noop');
  resetEnvCacheForTests();

  try {
    assert.throws(
      () => logEmailRuntimeStartup('noop'),
      (error: unknown) => error instanceof Error && error.message === 'production_email_provider_is_noop',
    );
  } finally {
    setEnvValue('NODE_ENV', prevNodeEnv);
    setEnvValue('EMAIL_PROVIDER', prevProvider);
    resetEnvCacheForTests();
  }
});

test('logEmailRuntimeStartup does not throw in test when EMAIL_PROVIDER is noop', () => {
  setEnvValue('NODE_ENV', 'test');
  setEnvValue('EMAIL_PROVIDER', 'noop');
  resetEnvCacheForTests();
  assert.doesNotThrow(() => logEmailRuntimeStartup('noop'));
});
