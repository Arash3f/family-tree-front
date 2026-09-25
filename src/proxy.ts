import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip Next internals, static files, same-origin API proxy, and App Router
  // API routes.
  matcher: [
    "/",
    "/(en|fa)/:path*",
    "/((?!_next|_vercel|backend|api|.*\\..*).*)",
  ],
};
