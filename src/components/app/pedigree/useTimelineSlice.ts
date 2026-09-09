"use client";

import { useMemo, useState } from "react";
import { computeTimelineBounds, type TimelineBounds } from "@/lib/pedigree/dates";
import { sliceTreeAtYear } from "@/lib/pedigree/layout";
import type { Marriage, Person } from "@/lib/auth/types";

export type TimelineSlice = {
  bounds: TimelineBounds | null;
  /** Null only while the tree has no dated birth at all. */
  year: number | null;
  setYear: (year: number) => void;
  /** People already born in `year`; the graph keeps every node but dims these. */
  visiblePersons: Person[];
  visiblePersonIds: Set<string>;
};

function clampToBounds(
  year: number | null,
  bounds: TimelineBounds | null,
): number | null {
  if (!bounds) return null;
  if (year === null) return bounds.maxYear;
  return Math.min(bounds.maxYear, Math.max(bounds.minYear, year));
}

/**
 * The tree as it stood in the scrubbed year. Editing the tree can move the
 * timeline's own range, so the year is re-clamped whenever the bounds change.
 */
export function useTimelineSlice(
  persons: Person[],
  marriages: Marriage[],
  locale: string,
): TimelineSlice {
  const bounds = useMemo(
    () => computeTimelineBounds(persons.map((person) => person.birth_date), locale),
    [persons, locale],
  );

  const [scrubbedYear, setScrubbedYear] = useState<number | null>(null);
  const [boundsInUse, setBoundsInUse] = useState(bounds);

  let year = scrubbedYear;
  if (bounds !== boundsInUse) {
    year = clampToBounds(scrubbedYear, bounds);
    setBoundsInUse(bounds);
    setScrubbedYear(year);
  }
  const effectiveYear = year ?? bounds?.maxYear ?? null;

  const slice = useMemo(() => {
    if (effectiveYear === null) return { persons, marriages };
    return sliceTreeAtYear(persons, marriages, effectiveYear, locale);
  }, [persons, marriages, effectiveYear, locale]);

  const visiblePersons = slice.persons;
  const visiblePersonIds = useMemo(
    () => new Set(visiblePersons.map((person) => person.id)),
    [visiblePersons],
  );

  return {
    bounds,
    year: effectiveYear,
    setYear: setScrubbedYear,
    visiblePersons,
    visiblePersonIds,
  };
}
