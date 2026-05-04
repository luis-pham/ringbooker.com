const appBaseUrl = process.env.APP_BASE_URL?.replace(/\/$/, '');
const backendKey = process.env.BACKEND_INTERNAL_API_KEY;

if (!appBaseUrl) {
  console.error('APP_BASE_URL is required');
  process.exit(1);
}

if (!backendKey && process.env.NODE_ENV === 'production') {
  console.error('BACKEND_INTERNAL_API_KEY is required in production');
  process.exit(1);
}

const response = await fetch(`${appBaseUrl}/api/backend/jobs/trial-lifecycle`, {
  method: 'POST',
  headers: backendKey ? { 'x-backend-key': backendKey } : {},
});
const body = await response.text();
console.log(body);

if (!response.ok) {
  process.exit(1);
}
