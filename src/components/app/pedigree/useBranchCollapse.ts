"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { Marriage, Person } from "@/lib/auth/types";
import {
  emptyBranchCollapseState,
  resolveBranchCollapse,
  type BranchCollapseState,
} from "@/lib/pedigree/collapse";

export type BranchCollapse = {
  /** Roots kept on the canvas with their line folded away. */
  collapsedIds: Set<string>;
  /** Roots folded away together with their line. */
  hiddenIds: Set<string>;
  /** Everyone the folds keep off the canvas. */
  hiddenPersonIds: Set<string>;
  /** People each root takes with it, for the count on its card. */
  countByRoot: Map<string, number>;
  toggleCollapse: (personId: string) => void;
  hideBranch: (personId: string) => void;
  expandAll: () => void;
};

/**
 * Folds live in `localStorage`, not in the tree: they are how one reader wants
 * to look at the tree today, usually to read a crowded generation or to keep an
 * exported image to the branch that matters. Keeping them out of React state
 * and behind `useSyncExternalStore` means the server renders the unfolded tree,
 * hydration matches, and every view of the same tree sees the same folds.
 */
const EMPTY = emptyBranchCollapseState();
const snapshots = new Map<string, BranchCollapseState>();
const listeners = new Map<string, Set<() => void>>();

function storageKey(treeId: string): string {
  return `pedigree:folds:${treeId}`;
}

function readStored(treeId: string): BranchCollapseState {
  try {
    const raw = window.localStorage.getItem(storageKey(treeId));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as { collapsed?: unknown; hidden?: unknown };
    const ids = (value: unknown) =>
      new Set(
        Array.isArray(value)
          ? value.filter((id): id is string => typeof id === "string")
          : [],
      );
    return { collapsed: ids(parsed.collapsed), hidden: ids(parsed.hidden) };
  } catch {
    // A corrupt or blocked store is not worth failing the canvas over.
    return EMPTY;
  }
}

function writeStored(treeId: string, state: BranchCollapseState) {
  try {
    if (state.collapsed.size === 0 && state.hidden.size === 0) {
      window.localStorage.removeItem(storageKey(treeId));
      return;
    }
    window.localStorage.setItem(
      storageKey(treeId),
      JSON.stringify({
        collapsed: [...state.collapsed],
        hidden: [...state.hidden],
      }),
    );
  } catch {
    // Storage full or denied: the fold still applies for this visit.
  }
}

/** Snapshots are cached because `useSyncExternalStore` compares them by identity. */
function foldsOf(treeId: string): BranchCollapseState {
  const cached = snapshots.get(treeId);
  if (cached) return cached;
  const stored = readStored(treeId);
  snapshots.set(treeId, stored);
  return stored;
}

function setFolds(treeId: string, next: BranchCollapseState) {
  snapshots.set(treeId, next);
  writeStored(treeId, next);
  for (const listener of listeners.get(treeId) ?? []) listener();
}

function subscribeToFolds(treeId: string, listener: () => void): () => void {
  const forTree = listeners.get(treeId) ?? new Set<() => void>();
  forTree.add(listener);
  listeners.set(treeId, forTree);
  return () => {
    forTree.delete(listener);
    if (forTree.size === 0) listeners.delete(treeId);
  };
}

export function useBranchCollapse(
  treeId: string,
  persons: Person[],
  marriages: Marriage[],
): BranchCollapse {
  const state = useSyncExternalStore(
    useCallback(
      (listener: () => void) => subscribeToFolds(treeId, listener),
      [treeId],
    ),
    useCallback(() => foldsOf(treeId), [treeId]),
    () => EMPTY,
  );

  const toggleCollapse = useCallback(
    (personId: string) => {
      const current = foldsOf(treeId);
      const collapsed = new Set(current.collapsed);
      if (!collapsed.delete(personId)) collapsed.add(personId);
      setFolds(treeId, { collapsed, hidden: current.hidden });
    },
    [treeId],
  );

  const hideBranch = useCallback(
    (personId: string) => {
      const current = foldsOf(treeId);
      const collapsed = new Set(current.collapsed);
      collapsed.delete(personId);
      const hidden = new Set(current.hidden);
      hidden.add(personId);
      setFolds(treeId, { collapsed, hidden });
    },
    [treeId],
  );

  const expandAll = useCallback(() => {
    setFolds(treeId, emptyBranchCollapseState());
  }, [treeId]);

  const resolved = useMemo(
    () => resolveBranchCollapse(persons, marriages, state),
    [persons, marriages, state],
  );

  return {
    collapsedIds: state.collapsed,
    hiddenIds: state.hidden,
    hiddenPersonIds: resolved.hiddenPersonIds,
    countByRoot: resolved.countByRoot,
    toggleCollapse,
    hideBranch,
    expandAll,
  };
}
