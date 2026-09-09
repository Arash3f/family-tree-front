"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  type Edge,
  type InternalNode,
  type Node,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "next-themes";
import { useLocale, useTranslations } from "next-intl";
import {
  applyPedigreeVisibility,
  marriageClusterFollowerStarts,
  marriageClusterPersonIds,
  nodeAbsolutePosition,
  stylePedigreeGraph,
  syncUnionPositions,
  syncUnionPositionsForPeople,
  PERSON_NODE_WIDTH,
} from "@/lib/pedigree/layout";
import type { CoupleNodeData, PersonNodeData } from "@/lib/pedigree/layout";
import type { LayoutAnchor } from "./useGraphFocus";
import { CoupleNode } from "./CoupleNode";
import { PathTraveler } from "./PathTraveler";
import { PersonNode } from "./PersonNode";
import { UnionNode } from "./UnionNode";
import {
  PedigreeAsOfYearProvider,
  PedigreeBranchProvider,
  PedigreeDataAccessProvider,
  PedigreeSelectProvider,
  type PedigreeBranchActions,
  type PedigreeDataAccess,
} from "./PedigreeSelectContext";
import {
  buildPedigreeGraphic,
  type PedigreeGraphic,
} from "@/lib/pedigree/export-graphic";
import { type ExportTheme } from "@/lib/pedigree/export-theme";
import styles from "./PedigreeCanvas.module.css";

const nodeTypes = {
  person: PersonNode,
  union: UnionNode,
  couple: CoupleNode,
};

/** Past this many targets a camera move fits bounds instead of framing each node. */
const FIT_ALL_NODE_LIMIT = 18;
/** MiniMap cost scales with node count — hide past this. */
const MINIMAP_NODE_LIMIT = 120;

/** The "fit view" framing: the whole graph on screen, edge to edge. */
const FIT_ALL_VIEW = {
  padding: 0.16,
  minZoom: 0.08,
  maxZoom: 1.05,
} as const;

/**
 * Opening zoom. A tree outgrows the canvas long before it outgrows the zoom
 * range, so fitting the whole graph on open bottoms out at
 * `FIT_ALL_VIEW.minZoom` and still clips, leaving unreadable specks. Opening at
 * a fixed zoom keeps the 220px person cards legible instead.
 */
const OPEN_ZOOM = 0.6;

/** How far down the canvas the oldest generation sits on open. */
const OPEN_TOP_INSET = 0.18;

/** Vertical slack within which two nodes still count as the same generation. */
const ROW_BAND = 140;

/** Screen padding an anchored node needs before it counts as still on screen. */
const KEEP_IN_VIEW_MARGIN = 48;

/** Panning to an anchor below this zoom would land on an unreadable speck. */
const KEEP_MIN_ZOOM = 0.35;

/** How the camera frames an explicit set of targets. */
function framingFor(targetCount: number) {
  const many = targetCount > FIT_ALL_NODE_LIMIT;
  return {
    padding: targetCount === 1 ? 0.55 : many ? 0.16 : 0.32,
    duration: many ? 0 : 520,
    minZoom: many ? 0.12 : 0.35,
    maxZoom: targetCount === 1 ? 1.25 : many ? 0.95 : 1.05,
  };
}

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

/**
 * Graph-space box around the anchored nodes. Spouses render as children of a
 * couple box, so their own `position` is relative — only the absolute position
 * React Flow tracks internally can be compared against the viewport.
 */
function anchorBounds(
  ids: string[],
  lookup: (id: string) => InternalNode<Node> | undefined,
): Bounds | null {
  let box: Bounds | null = null;
  for (const id of ids) {
    const node = lookup(id);
    if (!node || node.hidden) continue;
    const { x, y } = node.internals.positionAbsolute;
    const width = node.measured.width ?? PERSON_NODE_WIDTH;
    const height = node.measured.height ?? 0;
    box = box
      ? {
          minX: Math.min(box.minX, x),
          minY: Math.min(box.minY, y),
          maxX: Math.max(box.maxX, x + width),
          maxY: Math.max(box.maxY, y + height),
        }
      : { minX: x, minY: y, maxX: x + width, maxY: y + height };
  }
  return box;
}

function boundsOnScreen(
  box: Bounds,
  viewport: { x: number; y: number; zoom: number },
  canvas: DOMRect | undefined,
): boolean {
  if (!canvas) return false;
  return (
    box.minX * viewport.zoom + viewport.x >= KEEP_IN_VIEW_MARGIN &&
    box.minY * viewport.zoom + viewport.y >= KEEP_IN_VIEW_MARGIN &&
    box.maxX * viewport.zoom + viewport.x <= canvas.width - KEEP_IN_VIEW_MARGIN &&
    box.maxY * viewport.zoom + viewport.y <= canvas.height - KEEP_IN_VIEW_MARGIN
  );
}

/** True when the live RF nodes already mirror the parent layout graph. */
function nodesMatchLayout(live: Node[], layout: Node[]): boolean {
  if (live.length !== layout.length) return false;
  const ids = new Set(live.map((node) => node.id));
  return layout.every((node) => ids.has(node.id));
}

/**
 * The graph point to open on. Wide trees scatter dozens of unrelated roots
 * across the oldest generation, so summarising that row by its centre lands the
 * camera on the empty gap between distant families. Anchor instead on the root
 * with the most of the tree around it: it keeps a member of the oldest
 * generation in frame while filling the rest of the canvas with relatives.
 *
 * Only top-level nodes count: spouses nested inside a couple box use relative
 * positions near the origin, which would otherwise pull the camera onto empty
 * space far from the real tree.
 */
function openingAnchor(
  all: Node[],
  canvasWidth: number,
): { x: number; y: number } | null {
  const framed = all.filter(
    (node) =>
      !node.hidden &&
      !node.parentId &&
      (node.type === "person" || node.type === "couple"),
  );
  if (framed.length === 0) return null;

  const top = Math.min(...framed.map((node) => node.position.y));
  const roots = framed.filter((node) => node.position.y - top <= ROW_BAND);
  if (roots.length === 0) return null;

  const reach = Math.max(canvasWidth / OPEN_ZOOM, PERSON_NODE_WIDTH * 4) / 2;
  let best = roots[0];
  let bestCount = -1;
  for (const root of roots) {
    const near = framed.reduce(
      (count, node) =>
        Math.abs(node.position.x - root.position.x) <= reach ? count + 1 : count,
      0,
    );
    if (near > bestCount) {
      bestCount = near;
      best = root;
    }
  }
  const halfWidth =
    (best.width ??
      (best.type === "couple" ? PERSON_NODE_WIDTH * 2 : PERSON_NODE_WIDTH)) / 2;
  return { x: best.position.x + halfWidth, y: top };
}

export type PedigreeCanvasHandle = {
  /**
   * Snapshot the current graph as a resolution-independent graphic. Turning it
   * into a PNG or a PDF is the caller's decision, so export policy lives in one
   * place instead of being split across the canvas.
   */
  buildGraphic: (theme: ExportTheme) => Promise<PedigreeGraphic>;
};

type CanvasProps = {
  layoutNodes: Node[];
  layoutEdges: Edge[];
  layoutToken: number;
  /** Where the camera goes once the new layout is measured. */
  layoutAnchor: LayoutAnchor | null;
  /** Bumps when the viewport should center on `cameraNodeIds`. */
  cameraToken: number;
  /** Empty array means fit the whole graph (used for large trees). */
  cameraNodeIds: string[];
  selectedId: string | null;
  focusIds: Set<string>;
  pathIds: Set<string>;
  /** Ordered selected path for origin→destination travel animation. */
  pathOrder: string[];
  altPathIds: Set<string>;
  /** Person id → color lane (0 selected, 1..N alternatives). */
  pathLaneById: Map<string, number>;
  visiblePersonIds: Set<string>;
  onSelect: (personId: string | null) => void;
  asOfYear: number | null;
  dataAccess: PedigreeDataAccess;
  branchActions: PedigreeBranchActions;
  exportApiRef?: MutableRefObject<PedigreeCanvasHandle | null>;
};

function CanvasInner({
  layoutNodes,
  layoutEdges,
  layoutToken,
  layoutAnchor,
  cameraToken,
  cameraNodeIds,
  selectedId,
  focusIds,
  pathIds,
  pathOrder,
  altPathIds,
  pathLaneById,
  visiblePersonIds,
  onSelect,
  asOfYear,
  dataAccess,
  branchActions,
  exportApiRef,
}: CanvasProps) {
  const { fitView, setCenter, setViewport, getNodes, getEdges, getInternalNode, getViewport } =
    useReactFlow();
  const locale = useLocale();
  const t = useTranslations("pedigree");
  const rootRef = useRef<HTMLDivElement>(null);
  const captureLock = useRef(Promise.resolve());
  const nodesInitialized = useNodesInitialized();
  const { resolvedTheme } = useTheme();
  const colorMode = resolvedTheme === "dark" ? "dark" : "light";
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [narrowViewport, setNarrowViewport] = useState(false);
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const dragMoved = useRef(false);
  /**
   * Set only when the viewport actually pans/zooms. A bare tap often still
   * fires moveStart/moveEnd on touch browsers — those must not block select.
   */
  const viewportDidMove = useRef(false);
  const viewportGestureClear = useRef<number | null>(null);
  /** True after the first real pan/zoom of the current gesture — cancel camera once. */
  const cancelledCameraForGesture = useRef(false);
  const dragRaf = useRef<number | null>(null);
  const visibilityRaf = useRef<number | null>(null);
  const dragPersonIds = useRef<string[]>([]);
  const dragCluster = useRef<{
    draggedId: string;
    originAbs: { x: number; y: number };
    followers: Map<string, { x: number; y: number }>;
  } | null>(null);
  const appliedLayoutToken = useRef<number | null>(null);
  /**
   * Start equal to the current token so a canvas remount (loading flash, tree
   * switch spinner) cannot replay the last search/focus fit and yank the view
   * back onto someone the user already left.
   */
  const appliedCameraToken = useRef(cameraToken);
  const pendingPreviewFit = useRef(false);
  const awaitCanvasSize = useRef(false);
  const cameraTokenRef = useRef(cameraToken);
  /**
   * Layout graph that was on screen when an empty-frame token fired. The camera
   * must wait until `layoutNodes` is a *different* graph (the clipped rebuild),
   * then until live nodes mirror it — otherwise we either fit the old full tree
   * or, worse, mark the new layout as "already seen" and never fit at all.
   */
  const staleLayoutForFitRef = useRef<Node[] | null>(null);
  const prevLayoutNodesRef = useRef(layoutNodes);
  const [fitPass, setFitPass] = useState(0);
  const edgeTopology = useRef<Edge[]>(layoutEdges);
  const selectedRef = useRef(selectedId);
  const focusRef = useRef(focusIds);
  const pathRef = useRef(pathIds);
  const pathOrderRef = useRef(pathOrder);
  const altPathRef = useRef(altPathIds);
  const pathLaneRef = useRef(pathLaneById);
  const visibleRef = useRef(visiblePersonIds);

  /**
   * Mirror the current props into refs so callbacks can read them without
   * being rebuilt on every change — React Flow re-registers handlers whenever
   * their identity moves, which is expensive on a large graph.
   *
   * This has to be an effect, not a render-time assignment: a render that React
   * throws away would otherwise leave the refs pointing at values that were
   * never committed. Declared first so it runs before the effects that read it.
   */
  useEffect(() => {
    selectedRef.current = selectedId;
    focusRef.current = focusIds;
    pathRef.current = pathIds;
    pathOrderRef.current = pathOrder;
    altPathRef.current = altPathIds;
    pathLaneRef.current = pathLaneById;
    visibleRef.current = visiblePersonIds;
    edgeTopology.current = layoutEdges;
    nodesRef.current = nodes;
    edgesRef.current = edges;
    cameraTokenRef.current = cameraToken;
  });

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 719.98px)");
    const sync = () => setNarrowViewport(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const paint = useCallback(
    (nextNodes: Node[], nextEdges: Edge[]) => {
      const styled = stylePedigreeGraph({
        nodes: nextNodes,
        edges: nextEdges,
        selectedId: selectedRef.current,
        focusIds: focusRef.current,
        pathIds: pathRef.current,
        pathOrder: pathOrderRef.current,
        altPathIds: altPathRef.current,
        pathLaneById: pathLaneRef.current,
        visiblePersonIds: visibleRef.current,
      });
      setNodes(styled.nodes);
      setEdges(styled.edges);
    },
    [setNodes, setEdges],
  );

  const paintVisibility = useCallback(() => {
    const next = applyPedigreeVisibility(
      nodesRef.current,
      edgesRef.current,
      visibleRef.current,
    );
    if (next.nodes === nodesRef.current && next.edges === edgesRef.current) return;
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [setNodes, setEdges]);

  // Apply graph whenever parent layout changes, or when tidy/fitToken resets positions.
  useEffect(() => {
    edgeTopology.current = layoutEdges;
    paint(syncUnionPositions(layoutNodes), layoutEdges);
  }, [layoutNodes, layoutEdges, layoutToken, paint]);

  // Camera fit only when layoutToken bumps (create/edit/import), not on scrub.
  useEffect(() => {
    if (appliedLayoutToken.current === layoutToken) return;
    appliedLayoutToken.current = layoutToken;
    pendingPreviewFit.current = true;
    // Snapshot the graph we must not fit: whatever was committed before this
    // token. `prevLayoutNodesRef` still holds the previous commit here because
    // its updater effect runs after this one.
    if (layoutAnchor?.mode === "frame" && layoutAnchor.ids.length === 0) {
      staleLayoutForFitRef.current = prevLayoutNodesRef.current;
    } else {
      staleLayoutForFitRef.current = null;
    }
  }, [layoutToken, layoutAnchor]);

  // Wait for measured nodes, then move the camera to wherever the layout bump
  // asked for: the edited person, a framed subset, or the opening shot.
  // Do not clear `pendingPreviewFit` until the anchor is measurable — create/
  // edit often bumps the layout token one paint before the new node exists.
  useEffect(() => {
    if (!pendingPreviewFit.current) return;
    if (!nodesInitialized || nodes.length === 0) return;
    if (appliedLayoutToken.current !== layoutToken) return;
    const canvas = rootRef.current?.getBoundingClientRect();
    const canvasReady =
      (canvas?.width ?? 0) >= 8 && (canvas?.height ?? 0) >= 8;

    if (layoutAnchor) {
      // Empty keep = hold still (e.g. after delete).
      // Empty frame = zoom out to the whole (possibly clipped) graph — used
      // after branch / path-clip rebuilds so the new shape fills the viewport.
      if (layoutAnchor.ids.length === 0) {
        if (layoutAnchor.mode === "keep") {
          pendingPreviewFit.current = false;
          awaitCanvasSize.current = false;
          staleLayoutForFitRef.current = null;
          return;
        }
        const stale = staleLayoutForFitRef.current;
        // Still the pre-clip graph (token landed before the worker/sync rebuild).
        if (stale != null && layoutNodes === stale) return;
        // Rebuild arrived; wait until React Flow has painted those nodes.
        if (!nodesMatchLayout(nodes, layoutNodes)) return;
        if (!canvasReady) {
          awaitCanvasSize.current = true;
          return;
        }
        pendingPreviewFit.current = false;
        awaitCanvasSize.current = false;
        staleLayoutForFitRef.current = null;
        void fitView({ ...FIT_ALL_VIEW, duration: 560 });
        return;
      }
      if (!canvasReady) {
        awaitCanvasSize.current = true;
        return;
      }
      const box = anchorBounds(layoutAnchor.ids, getInternalNode);
      if (!box) return;
      pendingPreviewFit.current = false;
      awaitCanvasSize.current = false;
      if (layoutAnchor.mode === "frame") {
        void fitView({
          nodes: layoutAnchor.ids.map((id) => ({ id })),
          ...framingFor(layoutAnchor.ids.length),
        });
        return;
      }
      const viewport = getViewport();
      if (boundsOnScreen(box, viewport, canvas)) return;
      void setCenter((box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2, {
        zoom: Math.max(viewport.zoom, KEEP_MIN_ZOOM),
        duration: 400,
      });
      return;
    }

    if (!canvasReady) {
      awaitCanvasSize.current = true;
      return;
    }

    pendingPreviewFit.current = false;
    awaitCanvasSize.current = false;
    const anchor = openingAnchor(nodes, canvas?.width ?? 0);
    if (!anchor) {
      void fitView({ ...FIT_ALL_VIEW, duration: 560 });
      return;
    }
    // Sit the oldest generation near the top edge rather than the middle, so
    // the canvas fills with the descendants below it.
    const centerY =
      anchor.y + ((canvas?.height ?? 0) * (0.5 - OPEN_TOP_INSET)) / OPEN_ZOOM;
    void setCenter(anchor.x, centerY, { zoom: OPEN_ZOOM, duration: 560 });
  }, [
    nodesInitialized,
    nodes,
    layoutNodes,
    layoutToken,
    layoutAnchor,
    fitPass,
    fitView,
    setCenter,
    getInternalNode,
    getViewport,
  ]);

  // Track the last committed layout graph for the next empty-frame snapshot.
  useEffect(() => {
    prevLayoutNodesRef.current = layoutNodes;
  }, [layoutNodes]);

  // Mobile flex fill can leave the host at 0×0 on the first camera pass; retry
  // once the canvas has a real size so the opening shot is not discarded.
  useEffect(() => {
    const host = rootRef.current;
    if (!host) return;
    const ro = new ResizeObserver(() => {
      if (!awaitCanvasSize.current) return;
      if (host.clientWidth < 8 || host.clientHeight < 8) return;
      setFitPass((value) => value + 1);
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  // Pan/zoom to specific people (search hit, relation path, or fit-all).
  useEffect(() => {
    if (!cameraToken || cameraToken === appliedCameraToken.current) return;
    if (appliedLayoutToken.current !== layoutToken) return;
    if (!nodesInitialized) return;
    appliedCameraToken.current = cameraToken;

    if (cameraNodeIds.length === 0) {
      void fitView({ ...FIT_ALL_VIEW, duration: 0 });
      return;
    }

    void fitView({
      nodes: cameraNodeIds.map((id) => ({ id })),
      ...framingFor(cameraNodeIds.length),
    });
  }, [cameraToken, cameraNodeIds, layoutToken, nodesInitialized, fitView]);

  // Selection / relation highlight — keep user-dragged positions.
  useEffect(() => {
    if (appliedLayoutToken.current !== layoutToken) return;
    setNodes((current) => {
      const styled = stylePedigreeGraph({
        nodes: current,
        edges: edgeTopology.current,
        selectedId,
        focusIds,
        pathIds,
        pathOrder,
        altPathIds,
        pathLaneById,
        visiblePersonIds: visibleRef.current,
      });
      setEdges(styled.edges);
      return styled.nodes;
    });
  }, [selectedId, focusIds, pathIds, pathOrder, altPathIds, pathLaneById, layoutToken, setNodes, setEdges]);

  // Timeline visibility — fast path, coalesced to one update per frame.
  useEffect(() => {
    if (appliedLayoutToken.current !== layoutToken) return;
    if (visibilityRaf.current != null) cancelAnimationFrame(visibilityRaf.current);
    visibilityRaf.current = requestAnimationFrame(() => {
      visibilityRaf.current = null;
      paintVisibility();
    });
    return () => {
      if (visibilityRaf.current != null) {
        cancelAnimationFrame(visibilityRaf.current);
        visibilityRaf.current = null;
      }
    };
  }, [visiblePersonIds, layoutToken, paintVisibility]);

  useEffect(() => {
    return () => {
      if (dragRaf.current != null) cancelAnimationFrame(dragRaf.current);
      if (visibilityRaf.current != null) cancelAnimationFrame(visibilityRaf.current);
      if (viewportGestureClear.current != null) {
        window.clearTimeout(viewportGestureClear.current);
      }
    };
  }, []);

  const markViewportGesture = useCallback(() => {
    viewportDidMove.current = false;
    cancelledCameraForGesture.current = false;
    if (viewportGestureClear.current != null) {
      window.clearTimeout(viewportGestureClear.current);
      viewportGestureClear.current = null;
    }
  }, []);

  const noteViewportMove = useCallback(() => {
    viewportDidMove.current = true;
    // A real pan/zoom means the user took the wheel. Drop any pending layout
    // fit and kill an in-flight fitView/setCenter tween so the camera cannot
    // snap back to a person (or the opening shot) a beat later.
    if (cancelledCameraForGesture.current) return;
    cancelledCameraForGesture.current = true;
    pendingPreviewFit.current = false;
    awaitCanvasSize.current = false;
    staleLayoutForFitRef.current = null;
    if (cameraTokenRef.current > appliedCameraToken.current) {
      appliedCameraToken.current = cameraTokenRef.current;
    }
    const vp = getViewport();
    void setViewport(vp, { duration: 0 });
  }, [getViewport, setViewport]);

  const endViewportGesture = useCallback(() => {
    // Touch browsers fire click after touchend; keep the flag until that
    // click has had a chance to arrive (or be ignored).
    if (!viewportDidMove.current) return;
    if (viewportGestureClear.current != null) {
      window.clearTimeout(viewportGestureClear.current);
    }
    viewportGestureClear.current = window.setTimeout(() => {
      viewportDidMove.current = false;
      viewportGestureClear.current = null;
    }, 320);
  }, []);

  const onNodeDragStart = useCallback<OnNodeDrag>((_, node) => {
    dragMoved.current = false;
    const current = getNodes();
    const byId = new Map(current.map((item) => [item.id, item]));

    let seed: string[] = [];
    if (node.type === "person") {
      seed = [node.id];
    } else if (node.type === "couple") {
      const data = node.data as CoupleNodeData;
      seed = [data.leftId, data.rightId];
    }

    const clusterPeople = marriageClusterPersonIds(current, seed);
    dragPersonIds.current = clusterPeople.length > 0 ? clusterPeople : seed;

    const followers = marriageClusterFollowerStarts(
      current,
      dragPersonIds.current,
      node,
    );
    dragCluster.current =
      followers.size > 0
        ? {
            draggedId: node.id,
            originAbs: nodeAbsolutePosition(node, byId),
            followers,
          }
        : null;
  }, [getNodes]);

  const onNodeDrag = useCallback<OnNodeDrag>((_, node) => {
    dragMoved.current = true;
    if (dragRaf.current != null) return;
    dragRaf.current = requestAnimationFrame(() => {
      dragRaf.current = null;
      const personIds = dragPersonIds.current;
      const cluster = dragCluster.current;
      setNodes((current) => {
        let next = current;
        if (cluster && cluster.followers.size > 0) {
          const byId = new Map(current.map((item) => [item.id, item]));
          const dragged = byId.get(cluster.draggedId) ?? node;
          const nowAbs = nodeAbsolutePosition(dragged, byId);
          const dx = nowAbs.x - cluster.originAbs.x;
          const dy = nowAbs.y - cluster.originAbs.y;
          if (Math.abs(dx) >= 0.01 || Math.abs(dy) >= 0.01) {
            next = current.map((item) => {
              const start = cluster.followers.get(item.id);
              if (!start) return item;
              return {
                ...item,
                position: { x: start.x + dx, y: start.y + dy },
              };
            });
          }
        }
        if (personIds.length === 0) return next;
        return syncUnionPositionsForPeople(next, personIds);
      });
    });
  }, [setNodes]);

  const onNodeDragStop = useCallback(() => {
    if (dragRaf.current != null) {
      cancelAnimationFrame(dragRaf.current);
      dragRaf.current = null;
    }
    const personIds = dragPersonIds.current;
    dragPersonIds.current = [];
    dragCluster.current = null;
    setNodes((current) => {
      const synced =
        personIds.length > 0
          ? syncUnionPositionsForPeople(current, personIds)
          : syncUnionPositions(current);
      const styled = stylePedigreeGraph({
        nodes: synced,
        edges: edgeTopology.current,
        selectedId: selectedRef.current,
        focusIds: focusRef.current,
        pathIds: pathRef.current,
        pathOrder: pathOrderRef.current,
        altPathIds: altPathRef.current,
        pathLaneById: pathLaneRef.current,
        visiblePersonIds: visibleRef.current,
      });
      setEdges(styled.edges);
      return styled.nodes;
    });
    // Keep dragMoved true long enough to ignore the trailing click after a
    // drag, then clear so later clicks are not permanently blocked.
    window.setTimeout(() => {
      dragMoved.current = false;
    }, 0);
  }, [setNodes, setEdges]);

  const showMiniMap = !narrowViewport && nodes.length <= MINIMAP_NODE_LIMIT;

  // Stable identity: an inline callback makes MiniMap recolour every node on
  // every parent render.
  const miniMapNodeColor = useCallback((node: Node) => {
    if (node.type === "union") {
      const data = node.data as CoupleNodeData;
      return data.tone === "secondary"
        ? "var(--pedigree-spouse-alt)"
        : "var(--accent)";
    }
    if (node.type === "couple") {
      const data = node.data as CoupleNodeData;
      return data.tone === "secondary"
        ? "color-mix(in srgb, var(--pedigree-spouse-alt) 45%, var(--surface))"
        : "color-mix(in srgb, var(--accent) 45%, var(--surface))";
    }
    const data = node.data as PersonNodeData | undefined;
    if (data?.person.gender === "female") return "var(--pedigree-female)";
    if (data?.person.gender === "male") return "var(--pedigree-male)";
    return "var(--accent)";
  }, []);

  const exportLabels = useCallback(
    () => ({
      born: t("born"),
      died: t("died"),
      age: t("fields.age"),
      gender: t("fields.gender"),
      birthPlace: t("fields.birthPlace"),
      notYetMarried: t("notYetMarried"),
      empty: "—",
      male: t("gender.male"),
      female: t("gender.female"),
    }),
    [t],
  );

  const buildGraphic = useCallback(
    async (theme: ExportTheme) => {
      // Serialised: two concurrent builds would both fetch every photo.
      const run = captureLock.current.then(() =>
        buildPedigreeGraphic({
          nodes: getNodes(),
          edges: getEdges(),
          pathIds: pathRef.current,
          theme,
          locale,
          labels: exportLabels(),
          asOfYear,
          includePhotos: true,
        }),
      );
      captureLock.current = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
    [getNodes, getEdges, locale, exportLabels, asOfYear],
  );

  useEffect(() => {
    if (!exportApiRef) return;
    exportApiRef.current = { buildGraphic };
    return () => {
      exportApiRef.current = null;
    };
  }, [exportApiRef, buildGraphic]);

  return (
    <PedigreeSelectProvider value={onSelect}>
      <PedigreeAsOfYearProvider value={asOfYear}>
      <PedigreeDataAccessProvider value={dataAccess}>
      <PedigreeBranchProvider value={branchActions}>
      <div ref={rootRef} className={styles.flowHost} dir="ltr">
        <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={(_, node) => {
          if (node.type !== "person") return;
          // A trailing click after a real pan/zoom must not steal the path.
          if (viewportDidMove.current) return;
          const moved = dragMoved.current;
          dragMoved.current = false;
          if (moved) return;
          onSelect(node.id);
        }}
        onPaneClick={() => {
          dragMoved.current = false;
          if (viewportDidMove.current) return;
          onSelect(null);
        }}
        onMoveStart={(event) => {
          // Programmatic fitView/setCenter report a null event — ignore those
          // so an opening shot cannot cancel itself mid-tween.
          if (!event) return;
          markViewportGesture();
        }}
        onMove={(event) => {
          if (!event) return;
          noteViewportMove();
        }}
        onMoveEnd={(event) => {
          if (!event) return;
          endViewportGesture();
        }}
        nodesDraggable={!narrowViewport}
        nodesConnectable={false}
        elementsSelectable
        selectNodesOnDrag={false}
        onlyRenderVisibleElements
        // Camera framing is owned by layout/camera tokens; RF's focus pan would
        // otherwise yank the viewport onto a card that gained focus later.
        autoPanOnNodeFocus={false}
        panOnDrag
        panOnScroll
        zoomOnScroll={!narrowViewport}
        zoomOnPinch
        zoomOnDoubleClick={!narrowViewport}
        preventScrolling
        paneClickDistance={8}
        nodeClickDistance={6}
        minZoom={0.08}
        maxZoom={1.9}
        colorMode={colorMode}
        proOptions={{ hideAttribution: true }}
        className={styles.flow}
        defaultEdgeOptions={{ animated: false }}
      >
        <Background
          id="pedigree-dots"
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.1}
          color="color-mix(in srgb, var(--border) 70%, transparent)"
        />
        <Controls
          showInteractive={!narrowViewport}
          position={narrowViewport ? "bottom-right" : "bottom-left"}
          className={styles.controls}
        />
        {showMiniMap ? (
          <MiniMap
            className={styles.minimap}
            pannable
            zoomable
            maskColor="color-mix(in srgb, var(--background) 55%, transparent)"
            nodeColor={miniMapNodeColor}
          />
        ) : null}
        <PathTraveler pathOrder={pathOrder} />
        </ReactFlow>
      </div>
      </PedigreeBranchProvider>
      </PedigreeDataAccessProvider>
      </PedigreeAsOfYearProvider>
    </PedigreeSelectProvider>
  );
}

export function PedigreeCanvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
