"use client";

import { useDeferredValue, useMemo } from "react";
import type { TreeIndex } from "@/lib/pedigree/index-tree";
import {
  computePedigreeLayout,
  type PedigreeLayoutJob,
} from "@/lib/pedigree/layout-compute";
import { withFoldMarks } from "./fold-marks";

type Args = {
  job: PedigreeLayoutJob;
  /** Unfolded-tree index (before path/branch clip) for fold affordances. */
  foldIndex: TreeIndex;
  countByRoot: Map<string, number>;
};

/**
 * Builds the React Flow graph for the current layout job and stamps fold marks.
 *
 * Large trees are expensive to pack; deferring the job keeps pan/zoom and
 * form typing responsive while a newer layout catches up.
 */
export function usePedigreeLayout({ job, foldIndex, countByRoot }: Args) {
  const deferredJob = useDeferredValue(job);
  const deferredFoldIndex = useDeferredValue(foldIndex);
  const deferredCountByRoot = useDeferredValue(countByRoot);

  return useMemo(() => {
    const built = computePedigreeLayout(deferredJob);
    return withFoldMarks(built, deferredFoldIndex, deferredCountByRoot);
  }, [deferredJob, deferredFoldIndex, deferredCountByRoot]);
}
