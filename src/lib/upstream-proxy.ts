import { type NextRequest, NextResponse } from "next/server";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  // Undici rejects Expect; browsers sometimes send 100-continue on POST.
  "expect",
  // Let undici negotiate encoding with upstream; forwarding the browser's
  // Accept-Encoding can leave Content-Encoding mismatched after decode.
  "accept-encoding",
]);

const RESPONSE_STRIP = new Set([
  ...HOP_BY_HOP,
  "content-encoding",
]);

type UpstreamProxyOptions = {
  /** Upstream origin (and optional base path), without a trailing slash. */
  target: string;
  /** Path segments after the route prefix, as captured by `[...path]`. */
  pathSegments: string[];
  timeoutMs: number;
  /** Label used in the 502/504 messages, e.g. "API proxy". */
  label: string;
};

function upstreamError(status: number, message: string): NextResponse {
  return NextResponse.json(
    {
      error_code: "proxy_upstream_error",
      message,
      status,
      detail: [],
    },
    { status },
  );
}

/**
 * Forward a request to `target/<pathSegments>` and relay the response, keeping
 * the browser on this origin. Used by the API proxy (`/backend`).
 */
export async function proxyToUpstream(
  request: NextRequest,
  { target, pathSegments, timeoutMs, label }: UpstreamProxyOptions,
): Promise<NextResponse> {
  const segments = pathSegments.filter((segment) => segment.length > 0);
  const upstreamPath = segments.map(encodeURIComponent).join("/");
  const url = `${target}/${upstreamPath}${request.nextUrl.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    headers.set(key, value);
  });

  const init: RequestInit = {
    method: request.method,
    headers,
    // Never follow upstream redirects — browsers drop Authorization on
    // cross-origin Location (e.g. FastAPI slash redirects to :8001).
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, init);
  } catch (error) {
    const timedOut =
      (error instanceof DOMException && error.name === "TimeoutError") ||
      (error instanceof Error && error.name === "TimeoutError") ||
      (error instanceof Error && /aborted|timeout/i.test(error.message));

    if (timedOut) {
      return upstreamError(504, `${label} timed out reaching the upstream server`);
    }

    return upstreamError(502, `${label} could not reach the upstream server`);
  }

  // Buffer so we never forward a Content-Encoding that no longer matches the body
  // (undici decompresses; streaming the raw headers would break some clients).
  const body = await upstream.arrayBuffer();
  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (RESPONSE_STRIP.has(key.toLowerCase())) return;
    responseHeaders.set(key, value);
  });

  return new NextResponse(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
