import type { Marriage, Person } from "@/lib/auth/types";
import {
  buildPedigreeGraph,
  subsetForBranch,
  subsetForPath,
  type PedigreeGraph,
} from "@/lib/pedigree/layout";
import { buildTreeIndex } from "@/lib/pedigree/index-tree";

export type PedigreePathLayout = {
  orders: string[][];
  compact?: boolean;
};

/**
 * Serializable layout request: which people to include and how to pack them.
 * Built on the main thread; `computePedigreeLayout` turns it into RF nodes.
 */
export type PedigreeLayoutJob = {
  persons: Person[];
  marriages: Marriage[];
  /** When set, clip the graph to this path corridor (plus needed spouses). */
  pathPersonIds: string[] | null;
  /** Branch preview root; ignored while a path clip is active. */
  branchRootId: string | null;
  pathLayout: PedigreePathLayout | null;
};

export function computePedigreeLayout(job: PedigreeLayoutJob): PedigreeGraph {
  if (job.persons.length === 0) return { nodes: [], edges: [] };

  if (job.pathPersonIds && job.pathPersonIds.length > 0) {
    const pathIds = new Set(job.pathPersonIds);
    const index = buildTreeIndex(job.persons, job.marriages);
    const subset = subsetForPath(job.persons, job.marriages, pathIds, index);
    return buildPedigreeGraph({
      ...subset,
      pathLayout: job.pathLayout ?? undefined,
    });
  }

  if (job.branchRootId) {
    return buildPedigreeGraph(
      subsetForBranch(job.persons, job.marriages, job.branchRootId),
    );
  }

  return buildPedigreeGraph({
    persons: job.persons,
    marriages: job.marriages,
    pathLayout: job.pathLayout ?? undefined,
  });
}
