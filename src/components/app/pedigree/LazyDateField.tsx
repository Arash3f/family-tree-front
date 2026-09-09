"use client";

import dynamic from "next/dynamic";

/**
 * The date picker carries `react-multi-date-picker` plus its calendar and locale
 * data, none of which is needed until a form opens. Both editors import it from
 * here so there is a single lazy boundary to keep out of the initial bundle.
 */
export const DateField = dynamic(
  () =>
    import("@/components/ui/DateField").then((mod) => ({
      default: mod.DateField,
    })),
  { ssr: false },
);
