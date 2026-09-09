"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

// Avoid React 19 "script in component" warning on client re-renders (locale switch).
const clientScriptProps =
  typeof window === "undefined"
    ? undefined
    : ({ type: "application/json" } as const);

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      scriptProps={clientScriptProps}
    >
      {children}
    </NextThemesProvider>
  );
}
