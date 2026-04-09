#!/usr/bin/env node

const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
const apiBase = `${baseUrl.replace(/\/$/, '')}/api/backend`;
const internalKey = process.env.BACKEND_INTERNAL_API_KEY || '';

function withHeaders(extra = {}) {
  return {
    ...(internalKey ? { 'x-backend-key': internalKey } : {}),
    ...extra,
  };
}

async function run() {
  const [healthRes, readinessRes, runtimeRes] = await Promise.all([
    fetch(`${apiBase}/health`, { headers: withHeaders() }),
    fetch(`${apiBase}/readiness`, { headers: withHeaders() }),
    fetch(`${apiBase}/runtime`, { headers: withHeaders() }),
  ]);

  const health = await healthRes.json().catch(() => null);
  const readiness = await readinessRes.json().catch(() => null);
  const runtime = await runtimeRes.json().catch(() => null);

  console.log(
    JSON.stringify(
      {
        endpoint: apiBase,
        healthStatus: healthRes.status,
        readinessStatus: readinessRes.status,
        runtimeStatus: runtimeRes.status,
        health,
        readiness,
        runtime,
      },
      null,
      2,
    ),
  );

  if (!healthRes.ok || !readinessRes.ok) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error('check-readiness failed', error);
  process.exit(1);
});
