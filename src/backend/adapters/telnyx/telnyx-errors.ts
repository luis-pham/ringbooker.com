/** Telnyx REST errors — never log API keys or full Authorization headers. */

export class TelnyxApiError extends Error {
  readonly provider = 'telnyx' as const;

  readonly operation: string;

  readonly status?: number;

  readonly responseBody?: unknown;

  readonly responseText?: string;

  readonly durationMs?: number;

  readonly isRetryable?: boolean;

  constructor(
    message: string,
    params: {
      operation: string;
      status?: number;
      responseBody?: unknown;
      responseText?: string;
      durationMs?: number;
      isRetryable?: boolean;
    },
  ) {
    super(message);
    this.name = 'TelnyxApiError';
    this.operation = params.operation;
    this.status = params.status;
    this.responseBody = params.responseBody;
    this.responseText = params.responseText;
    this.durationMs = params.durationMs;
    this.isRetryable = params.isRetryable;
  }
}

export class TelnyxTimeoutError extends TelnyxApiError {
  readonly isTimeout = true;

  constructor(
    message: string,
    params: {
      operation: string;
      durationMs?: number;
      isRetryable?: boolean;
    },
  ) {
    super(message, {
      operation: params.operation,
      durationMs: params.durationMs,
      isRetryable: params.isRetryable ?? true,
    });
    this.name = 'TelnyxTimeoutError';
  }
}

export class TelnyxNetworkError extends TelnyxApiError {
  readonly isNetworkError = true;

  constructor(
    message: string,
    params: {
      operation: string;
      durationMs?: number;
      cause?: unknown;
      isRetryable?: boolean;
    },
  ) {
    super(message, {
      operation: params.operation,
      durationMs: params.durationMs,
      isRetryable: params.isRetryable ?? true,
    });
    this.name = 'TelnyxNetworkError';
    if (params.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = params.cause;
    }
  }
}

export function isTelnyxTimeoutError(e: unknown): e is TelnyxTimeoutError {
  return e instanceof TelnyxTimeoutError;
}

export function isTelnyxNetworkError(e: unknown): e is TelnyxNetworkError {
  return e instanceof TelnyxNetworkError;
}

export function isTelnyxApiError(e: unknown): e is TelnyxApiError {
  return e instanceof TelnyxApiError;
}

/** SMS / outbound Calls API / provisioning retry — never used for Call Control realtime actions. */
export function telnyxHttpFailureIsRetryable(e: unknown): boolean {
  if (e instanceof TelnyxTimeoutError || e instanceof TelnyxNetworkError) return true;
  if (e instanceof TelnyxApiError && e.isRetryable) return true;
  return false;
}
