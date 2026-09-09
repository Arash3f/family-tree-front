"use client";

import dynamic from "next/dynamic";

/** Calendar pulls `react-multi-date-picker` — load only when the chrome mounts it. */
export const BirthdayCalendarButton = dynamic(
  () =>
    import("./BirthdayCalendar").then((mod) => ({
      default: mod.BirthdayCalendarButton,
    })),
  { ssr: false },
);
