import type { NextRequest } from "next/server";
import { proxyToUpstream } from "@/lib/upstream-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_PROXY_TARGET = "http://127.0.0.1:8001";
const DEFAULT_TIMEOUT_MS = 15_000;

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

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function handle(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyToUpstream(request, {
    target: resolveProxyTarget(),
    pathSegments: path,
    timeoutMs: resolveTimeoutMs(),
    label: "API proxy",
  });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
export const HEAD = handle;
