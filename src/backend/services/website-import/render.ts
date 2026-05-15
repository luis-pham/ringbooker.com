type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export type RenderConfig = {
  endpoint?: string | null;
  apiKey?: string | null;
};

/**
 * Fetches fully JS-rendered HTML for a URL via a configured headless-render service.
 *
 * Provider-agnostic by design: the service is given `{ url }` and is expected to
 * return raw HTML, or a JSON envelope keyed `html` / `content` / `result` / `data`.
 * This works with Browserless (`/content`), Cloudflare Browser Rendering
 * (`/browser-rendering/content`, which returns `{ success, result }`), ScrapingBee,
 * a self-hosted Playwright endpoint, etc. — so RingBooker is not locked to one vendor
 * and incurs no cost until an endpoint is configured.
 *
 * Returns `null` when no endpoint is configured or the render fails for any reason —
 * callers fall back to the static HTML they already have.
 */
export async function renderHtml(
  url: string,
  config: RenderConfig,
  opts: { fetcher?: Fetcher; timeoutMs?: number } = {},
): Promise<string | null> {
  const endpoint = config.endpoint?.trim();
  if (!endpoint) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12_000);
  try {
    const response = await (opts.fetcher ?? fetch)(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') ?? '';
    if (/json/i.test(contentType)) {
      const body = (await response.json().catch(() => null)) as
        | { html?: unknown; content?: unknown; result?: unknown; data?: unknown }
        | null;
      // Cloudflare returns { success, result: "<html>" }; Browserless and others
      // return raw HTML or { html } / { content }.
      const html = body?.html ?? body?.content ?? body?.result ?? body?.data;
      return typeof html === 'string' && html.length > 0 ? html : null;
    }
    const text = await response.text();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
