export type HealthStatus = {
  status: "ok" | "degraded" | "unreachable";
  postgres?: string;
  neo4j?: string;
};

/** Same-origin rewrite → API (see next.config.ts). Avoids LAN/localhost mismatches. */
const DEFAULT_API_BASE = "/backend";

export function getApiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || DEFAULT_API_BASE
  );
}

export function getApiDocsUrl(): string {
  return `${getApiBaseUrl()}/redoc`;
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

/**
 * `Promise.all` for a group of requests that share an `AbortSignal`.
 *
 * Two things `Promise.all` gets wrong for cancellable work: it settles on the
 * first rejection, leaving the siblings a cancel took down to reject with
 * nobody watching, and it turns a cancel into an exception every caller then
 * has to recognise and swallow. Here every request is settled, and a caller
 * that has been cancelled gets `null` — walking away is not a failure.
 *
 * A real failure still throws. When the group was cancelled the failure is
 * dropped, since nobody is left to show it to.
 */
type Answers<T extends readonly unknown[] | []> = {
  -readonly [K in keyof T]: Awaited<T[K]>;
};

export async function allOrCancelled<T extends readonly unknown[] | []>(
  requests: T,
  signal?: AbortSignal,
): Promise<Answers<T> | null> {
  const results = await Promise.allSettled(requests);
  if (signal?.aborted) return null;

  for (const result of results) {
    if (result.status === "rejected") throw result.reason;
  }

  return results.map(
    (result) => (result as PromiseFulfilledResult<unknown>).value,
  ) as Answers<T>;
}

export async function fetchHealth(
  signal?: AbortSignal,
): Promise<HealthStatus | null> {
  const url = `${getApiBaseUrl()}/health`;

  try {
    const response = await fetch(url, {
      signal,
      cache: "no-store",
    });

    const data = (await response.json().catch(() => ({}))) as {
      status?: string;
      postgres?: string;
      neo4j?: string;
    };

    if (response.ok && data.status === "ok") {
      return {
        status: "ok",
        postgres: data.postgres,
        neo4j: data.neo4j,
      };
    }

    // Rewrite/proxy failures (upstream down) often surface as 5xx HTML.
    if (response.status >= 500) {
      return { status: "unreachable" };
    }

    return {
      status: "degraded",
      postgres: data.postgres,
      neo4j: data.neo4j,
    };
  } catch (error) {
    if (signal?.aborted || isAbortError(error)) {
      return null;
    }

    return { status: "unreachable" };
  }
}
