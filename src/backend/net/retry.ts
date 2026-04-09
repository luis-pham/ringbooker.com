export async function retryAsync<T>(
  fn: (attempt: number) => Promise<T>,
  options?: {
    retries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    shouldRetry?: (error: unknown) => boolean;
  },
): Promise<T> {
  const retries = options?.retries ?? 2;
  const initialDelayMs = options?.initialDelayMs ?? 200;
  const maxDelayMs = options?.maxDelayMs ?? 2000;
  const shouldRetry = options?.shouldRetry ?? (() => true);

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !shouldRetry(error)) {
        throw error;
      }
      const backoff = Math.min(maxDelayMs, initialDelayMs * 2 ** attempt);
      await sleep(backoff);
    }
  }
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
