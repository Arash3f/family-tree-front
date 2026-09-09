"use client";

import { useMemo } from "react";
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
 */
export function usePedigreeLayout({ job, foldIndex, countByRoot }: Args) {
  return useMemo(() => {
    const built = computePedigreeLayout(job);
    return withFoldMarks(built, foldIndex, countByRoot);
  }, [job, foldIndex, countByRoot]);
}
