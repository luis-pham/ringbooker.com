import { logger } from '@/src/backend/observability/logger';
import { isRetryableHttpStatus } from '@/src/backend/net/provider-retry-policy';

import { TelnyxApiError, TelnyxNetworkError, TelnyxTimeoutError } from '@/src/backend/adapters/telnyx/telnyx-errors';

export const TELNYX_API_BASE_V2 = 'https://api.telnyx.com/v2';

export const TELNYX_RESPONSE_LOG_MAX_CHARS = 500;

export type TelnyxCorrelationFields = {
  rbCallId?: string;
  handoffId?: string;
  shopId?: string;
  /** Generic job / provisioning correlation (distinct from rbCallId when needed). */
  requestId?: string;
  callControlId?: string;
  action?: string;
  category?: string;
  purpose?: string;
  /** booking_confirmation | reminder | … — not logging SMS body */
  messagePurpose?: string;
};

export type TelnyxHttpSuccess = {
  status: number;
  durationMs: number;
  rawText: string;
  parsedJson: unknown | null;
};

function truncateForLog(text: string, max = TELNYX_RESPONSE_LOG_MAX_CHARS): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function parseJsonSafe(text: string): unknown | null {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function isAbortError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const name = (e as { name?: string }).name;
  return name === 'AbortError' || name === 'TimeoutError';
}

/**
 * Authenticated Telnyx API v2 request with timeout and structured logging.
 * Does not log API keys, Authorization header, or request bodies (may contain PII/SIP URIs).
 */
export async function telnyxHttpJson(params: {
  method: 'GET' | 'POST';
  /** Relative to `/v2/` — no leading slash (e.g. `messages`, `calls`, `calls/cc/actions/answer`). */
  path: string;
  body?: Record<string, unknown>;
  extraHeaders?: Record<string, string>;
  timeoutMs: number;
  operation: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
  correlation?: TelnyxCorrelationFields;
}): Promise<TelnyxHttpSuccess> {
  const url = `${TELNYX_API_BASE_V2}/${params.path.replace(/^\//, '')}`;
  const fetchImpl = params.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${params.apiKey}`,
    ...params.extraHeaders,
  };
  if (params.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const started = Date.now();
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: params.method,
      headers,
      body: params.body !== undefined ? JSON.stringify(params.body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const durationMs = Date.now() - started;
    if (isAbortError(err)) {
      logger.warn(
        {
          telnyx_operation: params.operation,
          telnyx_duration_ms: durationMs,
          timeout_ms: params.timeoutMs,
          ...params.correlation,
        },
        'telnyx_http_timeout',
      );
      throw new TelnyxTimeoutError(`telnyx:${params.operation}:timeout`, {
        operation: params.operation,
        durationMs,
        isRetryable: true,
      });
    }
    logger.warn(
      {
        err,
        telnyx_operation: params.operation,
        telnyx_duration_ms: durationMs,
        ...params.correlation,
      },
      'telnyx_http_network_error',
    );
    throw new TelnyxNetworkError(`telnyx:${params.operation}:network`, {
      operation: params.operation,
      durationMs,
      cause: err,
      isRetryable: true,
    });
  }

  clearTimeout(timer);
  const durationMs = Date.now() - started;
  const rawText = await res.text().catch(() => '');
  const truncated = truncateForLog(rawText);
  const parsedJson = parseJsonSafe(rawText);

  const baseLog = {
    telnyx_operation: params.operation,
    telnyx_duration_ms: durationMs,
    http_status: res.status,
    ...params.correlation,
  };

  if (!res.ok) {
    logger.warn(
      {
        ...baseLog,
        response_text_truncated: truncated,
      },
      'telnyx_http_error_response',
    );
    throw new TelnyxApiError(`telnyx:${params.operation}:http_${res.status}`, {
      operation: params.operation,
      status: res.status,
      responseBody: parsedJson ?? undefined,
      responseText: truncated,
      durationMs,
      isRetryable: isRetryableHttpStatus(res.status),
    });
  }

  logger.info(baseLog, 'telnyx_http_ok');

  return {
    status: res.status,
    durationMs,
    rawText,
    parsedJson,
  };
}
