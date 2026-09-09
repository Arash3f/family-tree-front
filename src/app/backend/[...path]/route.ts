import { type NextRequest, NextResponse } from "next/server";

const API_PROXY_TARGET =
  process.env.API_PROXY_TARGET?.replace(/\/$/, "") || "http://127.0.0.1:8001";

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
]);

async function proxy(
  request: NextRequest,
  pathSegments: string[],
): Promise<NextResponse> {
  const segments = pathSegments.filter((segment) => segment.length > 0);
  const upstreamPath = segments.map(encodeURIComponent).join("/");
  const target = `${API_PROXY_TARGET}/${upstreamPath}${request.nextUrl.search}`;

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
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(target, init);
  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    responseHeaders.set(key, value);
  });

  return new NextResponse(upstream.body, {
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
