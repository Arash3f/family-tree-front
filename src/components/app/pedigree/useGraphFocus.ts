"use client";

import { useCallback, useState } from "react";

/** Where the camera should land once a fresh layout has been measured. */
export type LayoutAnchor = {
  ids: string[];
  /**
   * `frame` fits the ids on screen — an empty id list means fit the whole
   * graph (used after branch preview / path clips rebuild the canvas).
   * `keep` holds the current viewport and only pans when the ids fall outside
   * it — an empty id list means "hold still".
   */
  mode: "frame" | "keep";
};

export type RelationPathView = {
  ids: string[];
  distance: number;
};

/** How the relationship highlight is framed on the canvas. */
export type PathViewMode = "full" | "all" | "active";

/** Max distinct alt-path colors (lane 1..N). Lane 0 is the selected gold path. */
export const PATH_ALT_LANE_COUNT = 1;

export type GraphFocus = {
  /** Bumps to ask the canvas for a fresh layout and camera fit. */
  layoutToken: number;
  /** Null replays the opening shot on the oldest generation. */
  layoutAnchor: LayoutAnchor | null;
  cameraToken: number;
  cameraNodeIds: string[];
  highlightIds: Set<string>;
  /** Ordered person ids of the selected relation path (origin → destination). */
  highlightPathOrder: string[];
  altPathIds: Set<string>;
  /** Person id → color lane (0 = selected gold, 1 = alternative blue). */
  pathLaneById: Map<string, number>;
  coverPathIds: Set<string>;
  relationPaths: RelationPathView[];
  activePathIndex: number;
  pathViewMode: PathViewMode;
  /** True when the canvas is clipped to path people (all or active). */
  pathMinimal: boolean;
  branchRootId: string | null;
  relationLabel: string | null;
  bumpLayout: () => void;
  relayoutKeeping: (nodeIds: string[]) => void;
  relayoutFraming: (nodeIds: string[]) => void;
  focusCameraOn: (nodeIds: string[]) => void;
  /** Empty target list means "fit the whole graph". */
  frameWholeGraph: () => void;
  clearRelationHighlight: (resetMinimalFit?: boolean) => void;
  applyPathView: (mode: PathViewMode) => void;
  openBranchPreview: (personId: string) => void;
  clearBranchPreview: () => void;
  showRelationPath: (pathIds: string[], label: string) => void;
  showRelationPaths: (paths: RelationPathView[], label: string) => void;
  selectRelationPath: (index: number) => void;
  showRelationMiss: (label: string) => void;
};

function setsFromPaths(
  paths: RelationPathView[],
  activeIndex: number,
): {
  highlightIds: Set<string>;
  highlightPathOrder: string[];
  altPathIds: Set<string>;
  coverPathIds: Set<string>;
  pathLaneById: Map<string, number>;
} {
  const coverPathIds = new Set<string>();
  const highlightIds = new Set<string>();
  const altPathIds = new Set<string>();
  const pathLaneById = new Map<string, number>();
  const highlightPathOrder = [...(paths[activeIndex]?.ids ?? [])];

  for (const [index, path] of paths.entries()) {
    if (index === activeIndex) continue;
    for (const id of path.ids) {
      coverPathIds.add(id);
      altPathIds.add(id);
      if (!pathLaneById.has(id)) pathLaneById.set(id, 1);
    }
  }

  for (const id of highlightPathOrder) {
    coverPathIds.add(id);
    highlightIds.add(id);
    pathLaneById.set(id, 0);
  }
  for (const id of highlightIds) altPathIds.delete(id);

  return {
    highlightIds,
    highlightPathOrder,
    altPathIds,
    coverPathIds,
    pathLaneById,
  };
}

function frameIdsForMode(
  mode: PathViewMode,
  next: { highlightIds: Set<string>; coverPathIds: Set<string> },
): string[] {
  if (mode === "active") return [...next.highlightIds];
  if (mode === "all") return [...next.coverPathIds];
  return [];
}

/**
 * What the canvas is looking at: the relationship path highlight, the branch
 * subset, and the camera tokens. Kept apart from the tree data because none of
 * it survives a reload and none of it is ever sent to the API.
 */
export function useGraphFocus(): GraphFocus {
  const [layoutToken, setLayoutToken] = useState(0);
  const [layoutAnchor, setLayoutAnchor] = useState<LayoutAnchor | null>(null);
  const [cameraToken, setCameraToken] = useState(0);
  const [cameraNodeIds, setCameraNodeIds] = useState<string[]>([]);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
  const [highlightPathOrder, setHighlightPathOrder] = useState<string[]>([]);
  const [altPathIds, setAltPathIds] = useState<Set<string>>(new Set());
  const [pathLaneById, setPathLaneById] = useState<Map<string, number>>(
    () => new Map(),
  );
  const [coverPathIds, setCoverPathIds] = useState<Set<string>>(new Set());
  const [relationPaths, setRelationPaths] = useState<RelationPathView[]>([]);
  const [activePathIndex, setActivePathIndex] = useState(0);
  const [pathViewMode, setPathViewMode] = useState<PathViewMode>("full");
  const [branchRootId, setBranchRootId] = useState<string | null>(null);
  const [relationLabel, setRelationLabel] = useState<string | null>(null);

  const pathMinimal = pathViewMode !== "full";

  const relayout = useCallback((anchor: LayoutAnchor | null) => {
    setLayoutAnchor(anchor);
    setLayoutToken((value) => value + 1);
  }, []);

  const bumpLayout = useCallback(() => {
    relayout(null);
  }, [relayout]);

  const relayoutKeeping = useCallback(
    (nodeIds: string[]) => {
      relayout({ ids: nodeIds, mode: "keep" });
    },
    [relayout],
  );

  const relayoutFraming = useCallback(
    (nodeIds: string[]) => {
      relayout({ ids: nodeIds, mode: "frame" });
    },
    [relayout],
  );

  const focusCameraOn = useCallback((nodeIds: string[]) => {
    if (nodeIds.length === 0) return;
    setCameraNodeIds(nodeIds);
    setCameraToken((value) => value + 1);
  }, []);

  const frameWholeGraph = useCallback(() => {
    setCameraNodeIds([]);
    setCameraToken((value) => value + 1);
  }, []);

  const applyPathSets = useCallback(
    (paths: RelationPathView[], index: number) => {
      const next = setsFromPaths(paths, index);
      setHighlightIds(next.highlightIds);
      setHighlightPathOrder(next.highlightPathOrder);
      setAltPathIds(next.altPathIds);
      setCoverPathIds(next.coverPathIds);
      setPathLaneById(next.pathLaneById);
      return next;
    },
    [],
  );

  const clearRelationHighlight = useCallback(
    (resetMinimalFit = true) => {
      setHighlightIds(new Set());
      setHighlightPathOrder([]);
      setAltPathIds(new Set());
      setCoverPathIds(new Set());
      setPathLaneById(new Map());
      setRelationPaths([]);
      setActivePathIndex(0);
      setRelationLabel(null);
      if (resetMinimalFit) {
        setPathViewMode((was) => {
          if (was !== "full") relayout(null);
          return "full";
        });
      }
    },
    [relayout],
  );

  const applyPathView = useCallback(
    (mode: PathViewMode) => {
      setPathViewMode(mode);
      if (mode !== "full") setBranchRootId(null);
      if (coverPathIds.size === 0 && highlightIds.size === 0) return;
      if (mode === "full") {
        relayout(null);
        focusCameraOn([...highlightIds]);
        return;
      }
      // Clipping to all/active paths rebuilds the graph. Frame the finished
      // clipped canvas (empty = fit-all after layout), not the pre-clip
      // coordinates — those land the camera on empty space once nodes move.
      relayoutFraming([]);
    },
    [coverPathIds, highlightIds, relayout, relayoutFraming, focusCameraOn],
  );

  const openBranchPreview = useCallback(
    (personId: string) => {
      setBranchRootId(personId);
      clearRelationHighlight(false);
      setPathViewMode("full");
      // After the canvas rebuilds around this branch, zoom out to show all of it
      // — framing only the root would leave the rest of the branch off-screen.
      relayoutFraming([]);
    },
    [clearRelationHighlight, relayoutFraming],
  );

  const clearBranchPreview = useCallback(() => {
    setBranchRootId(null);
    relayout(null);
  }, [relayout]);

  const showRelationPath = useCallback(
    (pathIds: string[], label: string) => {
      const paths = [{ ids: pathIds, distance: Math.max(0, pathIds.length - 1) }];
      setBranchRootId(null);
      setRelationPaths(paths);
      setActivePathIndex(0);
      setRelationLabel(label);
      const next = applyPathSets(paths, 0);
      const frame = frameIdsForMode(pathViewMode, next);
      if (frame.length > 0) relayoutFraming(frame);
      else focusCameraOn(pathIds);
    },
    [pathViewMode, relayoutFraming, focusCameraOn, applyPathSets],
  );

  const showRelationPaths = useCallback(
    (paths: RelationPathView[], label: string) => {
      setBranchRootId(null);
      setRelationPaths(paths);
      setActivePathIndex(0);
      setRelationLabel(label);
      const next = applyPathSets(paths, 0);
      const frame = frameIdsForMode(pathViewMode, next);
      if (frame.length > 0) relayoutFraming(frame);
      else focusCameraOn(paths[0]?.ids ?? []);
    },
    [pathViewMode, relayoutFraming, focusCameraOn, applyPathSets],
  );

  const selectRelationPath = useCallback(
    (index: number) => {
      if (index < 0 || index >= relationPaths.length) return;
      setActivePathIndex(index);
      const next = applyPathSets(relationPaths, index);
      if (pathViewMode === "active") {
        // Active-only clip rebuilds around the newly selected path.
        relayoutFraming([]);
        return;
      }
      focusCameraOn([...next.highlightIds]);
    },
    [relationPaths, applyPathSets, focusCameraOn, pathViewMode, relayoutFraming],
  );

  const showRelationMiss = useCallback(
    (label: string) => {
      clearRelationHighlight();
      setRelationLabel(label);
    },
    [clearRelationHighlight],
  );

  return {
    layoutToken,
    layoutAnchor,
    cameraToken,
    cameraNodeIds,
    highlightIds,
    highlightPathOrder,
    altPathIds,
    pathLaneById,
    coverPathIds,
    relationPaths,
    activePathIndex,
    pathViewMode,
    pathMinimal,
    branchRootId,
    relationLabel,
    bumpLayout,
    relayoutKeeping,
    relayoutFraming,
    focusCameraOn,
    frameWholeGraph,
    clearRelationHighlight,
    applyPathView,
    openBranchPreview,
    clearBranchPreview,
    showRelationPath,
    showRelationPaths,
    selectRelationPath,
    showRelationMiss,
  };
}
