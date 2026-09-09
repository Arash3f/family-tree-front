import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip Next internals, static files, and the same-origin API proxy.
  matcher: [
    "/",
    "/(en|fa)/:path*",
    "/((?!_next|_vercel|backend|.*\\..*).*)",
  ],
};
