export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  constructor(status: number, code: string, message: string, requestId?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

export function createApiClient(config: {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  fetch?: typeof fetch;
}) {
  const base = config.baseUrl.replace(/\/+$/, '');
  const transport = config.fetch ?? fetch;
  return async function request<T>(
    path: string,
    options: { method?: string; body?: unknown; idempotencyKey?: string } = {},
  ): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Invalid API path.');
    const token = await config.getToken();
    if (!token) throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    try {
      const response = await transport(`${base}/v1${path}`, {
        method: options.method ?? 'GET',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      if (response.status === 204) return undefined as T;
      let validJson = true;
      const body = await response.json().catch(() => {
        validJson = false;
        return null;
      });
      if (!response.ok)
        throw new HttpError(
          response.status,
          body?.error?.code ?? 'REQUEST_FAILED',
          body?.error?.message ?? 'Could not reach your workspace. Try again.',
          body?.error?.requestId,
        );
      if (
        !validJson ||
        response.headers.get('content-type')?.includes('application/json') !== true
      ) {
        throw new HttpError(502, 'INVALID_RESPONSE', 'The server returned an invalid response.');
      }
      return body as T;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new Error(
        controller.signal.aborted
          ? 'The request timed out. Your work may have been saved; retry to check.'
          : 'Could not connect. Check your connection and try again.',
      );
    } finally {
      clearTimeout(timer);
    }
  };
}
