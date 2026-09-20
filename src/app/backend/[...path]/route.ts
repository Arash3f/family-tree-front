import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_PROXY_TARGET = "http://127.0.0.1:8001";
const DEFAULT_TIMEOUT_MS = 15_000;

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

/** Read per request so Docker `-e API_PROXY_TARGET=…` wins at runtime. */
function resolveProxyTarget(): string {
  const raw = process.env["API_PROXY_TARGET"]?.trim();
  return raw?.replace(/\/$/, "") || DEFAULT_PROXY_TARGET;
}

function resolveTimeoutMs(): number {
  const raw = process.env["API_PROXY_TIMEOUT_MS"]?.trim();
  const parsed = raw ? Number(raw) : DEFAULT_TIMEOUT_MS;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

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

async function proxy(
  request: NextRequest,
  pathSegments: string[],
): Promise<NextResponse> {
  const segments = pathSegments.filter((segment) => segment.length > 0);
  const upstreamPath = segments.map(encodeURIComponent).join("/");
  const target = `${resolveProxyTarget()}/${upstreamPath}${request.nextUrl.search}`;

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
    signal: AbortSignal.timeout(resolveTimeoutMs()),
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (error) {
    const timedOut =
      (error instanceof DOMException && error.name === "TimeoutError") ||
      (error instanceof Error && error.name === "TimeoutError") ||
      (error instanceof Error && /aborted|timeout/i.test(error.message));

    if (timedOut) {
      return upstreamError(
        504,
        "API proxy timed out reaching the upstream server",
      );
    }

    return upstreamError(
      502,
      "API proxy could not reach the upstream server",
    );
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

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function handle(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
export const HEAD = handle;
