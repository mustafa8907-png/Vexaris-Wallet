
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 12_000,
): Promise<T> {
  const retryable = !init.method || init.method.toUpperCase() === "GET";
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: { Accept: "application/json", ...(init.headers ?? {}) },
      });
      if (!res.ok) {
        const transient = res.status === 429 || res.status >= 500;
        if (retryable && transient && attempt === 0) {
          const after = Number(res.headers.get("Retry-After"));
          await sleep(Number.isFinite(after) && after > 0 ? Math.min(after, 3) * 1000 : 900);
          continue;
        }
        throw new ApiError(`HTTP ${res.status}`, res.status);
      }
      return (await res.json()) as T;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      if (retryable && attempt === 0 && (e as Error)?.name !== "AbortError") {
        await sleep(900);
        continue;
      }
      throw new ApiError(e instanceof Error ? e.message : String(e));
    } finally {
      clearTimeout(timer);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function postJson<T>(url: string, body: unknown, timeoutMs = 12_000): Promise<T> {
  return fetchJson<T>(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );
}
