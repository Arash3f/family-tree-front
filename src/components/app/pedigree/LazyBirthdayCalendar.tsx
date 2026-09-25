"use client";

import dynamic from "next/dynamic";

/** Loads calendar chrome (jalali month grid) only when the pedigree toolbar mounts it. */
export const BirthdayCalendarButton = dynamic(
  () =>
    import("./BirthdayCalendar").then((mod) => ({
      default: mod.BirthdayCalendarButton,
    })),
  { ssr: false },
);
