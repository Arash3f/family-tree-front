"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import { getAlternativeRelationshipPaths, getClosestRelationship } from "@/lib/auth/client";
import {
  getApiErrorMessage,
  type ClosestRelationship,
  type Marriage,
  type Person,
} from "@/lib/auth/types";
import { formatLocaleDigits } from "@/lib/localeDigits";
import { resolvePersonPhotoUrl } from "@/lib/media";
import {
  personDisplayName,
  resolvePersonParents,
} from "@/lib/pedigree/layout";
import type { PedigreeLayoutJob } from "@/lib/pedigree/layout-compute";
import {
  buildTreeIndex,
  neighborhoodOf,
} from "@/lib/pedigree/index-tree";
import { subsetWithoutHidden } from "@/lib/pedigree/collapse";
import { countDescendantsByGeneration } from "@/lib/pedigree/descendants";
import { ageInYearsAtYear, todayIso } from "@/lib/pedigree/dates";
import { Link } from "@/i18n/navigation";
import { Alert } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { useScrollLock } from "@/components/ui/useFocusTrap";
import styles from "./PedigreeView.module.css";
import { TimelineBar } from "./TimelineBar";
import type { PedigreeCanvasHandle } from "./PedigreeCanvas";
import type { MarriageFormState } from "./MarriageFormPanel";
import { PedigreeHeader } from "./PedigreeHeader";
import { PedigreeOverlays } from "./PedigreeOverlays";
import { PedigreeSidePanels } from "./PedigreeSidePanels";
import { RelationResult } from "./RelationResult";
import {
  emptyPersonForm,
  personToForm,
  type LinkAsParentOf,
  type PanelMode,
  type ParentRole,
  type PersonFormState,
} from "./person-form";
import { useBranchCollapse } from "./useBranchCollapse";
import { useExcelTransfer } from "./useExcelTransfer";
import { useExportFlow } from "./useExportFlow";
import { useFullscreen } from "./useFullscreen";
import {
  useGraphFocus,
  type RelationPathView,
} from "./useGraphFocus";
import { usePedigreeLayout } from "./usePedigreeLayout";
import { usePedigreePermissions } from "./usePedigreePermissions";
import { useTimelineSlice } from "./useTimelineSlice";
import { useTreeData } from "./useTreeData";

const EMPTY_PATH_IDS = new Set<string>();

function relationshipToPathViews(
  result: ClosestRelationship,
): RelationPathView[] {
  const raw =
    result.paths?.length > 0
      ? result.paths
      : [
          {
            distance: result.distance ?? 0,
            path_person_ids: result.path_person_ids,
            relationship_types: result.relationship_types,
          },
        ];
  return raw.map((path) => ({
    ids: path.path_person_ids.map(String),
    distance: path.distance,
  }));
}

const PedigreeCanvas = dynamic(
  () =>
    import("./PedigreeCanvas").then((mod) => ({ default: mod.PedigreeCanvas })),
  {
    ssr: false,
    loading: () => <p className={styles.empty}>…</p>,
  },
);

const EMPTY_FOCUS_IDS = new Set<string>();

type Props = {
  treeId: string;
};

export function PedigreeView({ treeId }: Props) {
  const t = useTranslations("pedigree");
  const tTrees = useTranslations("trees");
  const locale = useLocale();
  const { showError } = useFeedback();

  const focus = useGraphFocus();
  const fullscreen = useFullscreen();
  const {
    bumpLayout,
    relayoutKeeping,
    relayoutFraming,
    clearRelationHighlight,
    focusCameraOn,
  } = focus;
  /**
   * Opening-shot fit runs once per tree. Later reloads (auth refresh, manual
   * reload after import) must not yank the camera back to the oldest generation
   * while the user is already browsing.
   */
  const openingFitTreeId = useRef<string | null>(null);
  const onTreeLoaded = useCallback(() => {
    if (openingFitTreeId.current === treeId) return;
    openingFitTreeId.current = treeId;
    bumpLayout();
  }, [treeId, bumpLayout]);
  const tree = useTreeData(treeId, onTreeLoaded);
  const { busy, marriages, persons } = tree;
  const permissions = usePedigreePermissions(tree.hasTreeAccess);
  const branches = useBranchCollapse(treeId, persons, marriages);

  const canvasApiRef = useRef<PedigreeCanvasHandle | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelMode>({ kind: "none" });
  /** Matches the CSS sheet breakpoint: detail covers the canvas instead of sitting beside it. */
  const [sheetLayout, setSheetLayout] = useState(false);
  const [openingDetail, setOpeningDetail] = useState(false);
  const panelOpenedAt = useRef(0);
  const [personForm, setPersonForm] = useState<PersonFormState>(emptyPersonForm);
  const [marriageForm, setMarriageForm] = useState<MarriageFormState>({
    spouse_a_id: "",
    spouse_b_id: "",
    married_at: todayIso(),
  });
  const [relateToId, setRelateToId] = useState("");
  const [divorceDate, setDivorceDate] = useState(todayIso());
  const [ticketOpen, setTicketOpen] = useState(false);
  const [alternativesLoading, setAlternativesLoading] = useState(false);
  const relationRequestSeq = useRef(0);

  // Identity has to stay stable: it feeds a context read by every graph node.
  const dataAccess = useMemo(
    () => ({
      canViewBirthDate: permissions.canViewBirthDate,
      canViewMarriageDate: permissions.canViewMarriageDate,
      canViewPhoto: permissions.canViewPhoto,
    }),
    [
      permissions.canViewBirthDate,
      permissions.canViewMarriageDate,
      permissions.canViewPhoto,
    ],
  );

  // Identity has to stay stable for the same reason as `dataAccess` above.
  const branchActions = useMemo(
    () => ({
      toggleCollapse: branches.toggleCollapse,
      hideBranch: branches.hideBranch,
    }),
    [branches.toggleCollapse, branches.hideBranch],
  );

  const timeline = useTimelineSlice(persons, marriages, locale);
  const excel = useExcelTransfer(treeId, tree.treeName, tree.setBusy, tree.reload);
  const { posterRef, ...exportDialog } = useExportFlow({
    canvasApiRef,
    treeName: tree.treeName,
    scope:
      focus.highlightIds.size > 0
        ? "path"
        : focus.branchRootId
          ? "branch"
          : "tree",
  });

  /**
   * Adjacency maps for the loaded tree, rebuilt only when the data changes.
   * Selection, path highlighting and layout all read from this instead of
   * rescanning every person.
   */
  const treeIndex = useMemo(
    () => buildTreeIndex(persons, marriages),
    [persons, marriages],
  );
  const personById = treeIndex.personById;

  const selectedPerson = useMemo(
    () => persons.find((person) => person.id === selectedId) ?? null,
    [persons, selectedId],
  );
  const selectedPersonPhoto = selectedPerson
    ? resolvePersonPhotoUrl(
        selectedPerson.photo_url,
        selectedPerson.photo_object_key,
      )
    : null;
  const panelOpen = panel.kind !== "none" || Boolean(selectedPerson);
  const panelBodyRef = useRef<HTMLDivElement | null>(null);
  /** Mobile bottom sheet: peek leaves the path (and timeline) visible. */
  const [sheetSnap, setSheetSnap] = useState<"peek" | "half" | "full">("half");
  const sheetDrag = useRef<{ startY: number; moved: boolean } | null>(null);
  const sheetDragMoved = useRef(false);
  const pathDockActive =
    sheetLayout &&
    Boolean(focus.relationLabel) &&
    focus.highlightIds.size > 0;

  const branchRootPerson = useMemo(
    () => persons.find((person) => person.id === focus.branchRootId) ?? null,
    [persons, focus.branchRootId],
  );

  const selectedMarriages = useMemo(() => {
    if (!selectedId) return [];
    return marriages.filter(
      (marriage) =>
        marriage.spouse_a_id === selectedId ||
        marriage.spouse_b_id === selectedId,
    );
  }, [marriages, selectedId]);

  const editingMarriages = useMemo(() => {
    if (panel.kind !== "edit-person") return [];
    return marriages.filter(
      (marriage) =>
        marriage.spouse_a_id === panel.personId ||
        marriage.spouse_b_id === panel.personId,
    );
  }, [marriages, panel]);

  const editingPerson = useMemo(
    () =>
      panel.kind === "edit-person"
        ? (persons.find((person) => person.id === panel.personId) ?? null)
        : null,
    [panel, persons],
  );

  const descendantStats = useMemo(
    () =>
      selectedPerson
        ? countDescendantsByGeneration(selectedPerson.id, persons)
        : null,
    [persons, selectedPerson],
  );

  const personOptions = useMemo(
    () =>
      [...persons].sort((a, b) =>
        personDisplayName(a).localeCompare(personDisplayName(b), locale),
      ),
    [persons, locale],
  );

  const selectedPersonParents = useMemo(
    () =>
      selectedPerson
        ? resolvePersonParents(selectedPerson, personById)
        : { father: null, mother: null },
    [selectedPerson, personById],
  );

  const creatingParent =
    panel.kind === "create-person" ? panel.linkAsParentOf : undefined;
  const creatingParentChild = creatingParent
    ? (personById.get(creatingParent.childId) ?? null)
    : null;

  const parentFormOptions = useMemo(() => {
    const exclude = new Set<string>();
    if (panel.kind === "edit-person") exclude.add(panel.personId);
    if (creatingParent) exclude.add(creatingParent.childId);
    if (exclude.size === 0) return personOptions;
    return personOptions.filter((person) => !exclude.has(person.id));
  }, [personOptions, panel, creatingParent]);

  const marriageOptions = useMemo(
    () =>
      marriages.map((marriage) => {
        const a = personById.get(marriage.spouse_a_id);
        const b = personById.get(marriage.spouse_b_id);
        return {
          id: marriage.id,
          label: `${a ? personDisplayName(a) : "?"} × ${b ? personDisplayName(b) : "?"}`,
        };
      }),
    [marriages, personById],
  );

  const nameOf = useCallback(
    (personId: string) => {
      const person = personById.get(personId);
      return person ? personDisplayName(person) : personId;
    },
    [personById],
  );

  const personSearchHint = useCallback(
    (person: Person) => {
      const { father, mother } = resolvePersonParents(person, personById);
      const fatherName = father ? personDisplayName(father) : "";
      const motherName = mother ? personDisplayName(mother) : "";
      if (fatherName && motherName) {
        return t("searchChildOfBoth", {
          father: fatherName,
          mother: motherName,
        });
      }
      if (fatherName) return t("searchChildOf", { parent: fatherName });
      if (motherName) return t("searchChildOf", { parent: motherName });
      return null;
    },
    [personById, t],
  );

  const onSelect = useCallback(
    (personId: string | null) => {
      if (personId) {
        panelOpenedAt.current = Date.now();
        if (sheetLayout) {
          setOpeningDetail(true);
          setSheetSnap("half");
        }
      } else {
        setOpeningDetail(false);
        setSheetSnap("half");
      }
      setSelectedId(personId);
      setPanel({ kind: "none" });
      // Keep the highlighted route when the user inspects someone who is
      // already on it — only leave the path when they pick elsewhere or
      // clear the canvas.
      if (personId !== null && focus.coverPathIds.has(personId)) return;
      clearRelationHighlight();
    },
    [clearRelationHighlight, focus.coverPathIds, sheetLayout],
  );

  const focusIds = useMemo(() => {
    if (focus.highlightIds.size > 0) return focus.highlightIds;
    if (selectedId) return neighborhoodOf(treeIndex, selectedId);
    return EMPTY_FOCUS_IDS;
  }, [focus.highlightIds, selectedId, treeIndex]);

  const selectedPersonAge = selectedPerson
    ? ageInYearsAtYear(
        selectedPerson.birth_date,
        selectedPerson.death_date,
        timeline.year,
        locale,
      )
    : null;

  /**
   * The tree minus the folded branches. Folding removes people from the graph
   * input rather than hiding rendered nodes, so the layout closes the gap and
   * an exported image carries the same trimmed shape as the screen.
   */
  const unfolded = useMemo(() => {
    if (branches.hiddenPersonIds.size === 0) {
      return { persons, marriages, index: treeIndex };
    }
    const subset = subsetWithoutHidden(
      persons,
      marriages,
      branches.hiddenPersonIds,
    );
    return {
      ...subset,
      index: buildTreeIndex(subset.persons, subset.marriages),
    };
  }, [persons, marriages, treeIndex, branches.hiddenPersonIds]);

  /** People kept when clipping the canvas to path view (all paths or selected). */
  const pathSubsetKey = useMemo(() => {
    if (focus.pathViewMode === "active") {
      return [...focus.highlightIds].sort().join(",");
    }
    if (focus.pathViewMode === "all") {
      return [...focus.coverPathIds].sort().join(",");
    }
    return "";
  }, [focus.pathViewMode, focus.highlightIds, focus.coverPathIds]);

  const layoutJob = useMemo((): PedigreeLayoutJob => {
    const pathOrders =
      focus.pathViewMode === "active"
        ? focus.highlightPathOrder.length > 0
          ? [focus.highlightPathOrder]
          : []
        : focus.pathViewMode === "all"
          ? [
              ...(focus.highlightPathOrder.length > 0
                ? [focus.highlightPathOrder]
                : []),
              ...focus.relationPaths
                .filter((_, index) => index !== focus.activePathIndex)
                .map((path) => path.ids),
            ]
          : [];
    const pathLayout =
      focus.pathMinimal && pathOrders.length > 0
        ? { orders: pathOrders, compact: true as const }
        : null;

    return {
      persons: unfolded.persons,
      marriages: unfolded.marriages,
      pathPersonIds:
        focus.pathMinimal && pathSubsetKey
          ? pathSubsetKey.split(",").filter(Boolean)
          : null,
      branchRootId:
        focus.pathMinimal && pathSubsetKey ? null : focus.branchRootId,
      pathLayout,
    };
  }, [
    unfolded.persons,
    unfolded.marriages,
    focus.pathMinimal,
    pathSubsetKey,
    focus.branchRootId,
    focus.pathViewMode,
    focus.highlightPathOrder,
    focus.relationPaths,
    focus.activePathIndex,
  ]);

  const graph = usePedigreeLayout({
    job: layoutJob,
    foldIndex: unfolded.index,
    countByRoot: branches.countByRoot,
  });

  const filterPeople = useCallback(
    (query: string, excludeId?: string | null) => {
      const q = query.trim().toLowerCase();
      if (!q) return [];
      return personOptions
        .filter((person) => {
          if (excludeId && person.id === excludeId) return false;
          const hay =
            `${person.name} ${person.family_name ?? ""}`.toLowerCase();
          return hay.includes(q);
        })
        .slice(0, 8);
    },
    [personOptions],
  );

  const searchPeople = useCallback(
    (query: string) => filterPeople(query),
    [filterPeople],
  );

  const searchRelatePeople = useCallback(
    (query: string) => filterPeople(query, selectedId),
    [filterPeople, selectedId],
  );

  const relateToPerson = useMemo(
    () => persons.find((person) => person.id === relateToId) ?? null,
    [persons, relateToId],
  );

  const openCreatePerson = (
    defaults?: Partial<PersonFormState>,
    linkAsParentOf?: LinkAsParentOf,
  ) => {
    setPersonForm({ ...emptyPersonForm(), ...defaults });
    setPanel({ kind: "create-person", defaults, linkAsParentOf });
  };

  const openCreateParent = (child: Person, role: ParentRole) => {
    openCreatePerson(
      {
        gender: role === "father" ? "male" : "female",
        family_name: role === "father" ? (child.family_name ?? "") : "",
      },
      { childId: child.id, role },
    );
  };

  const openEditPerson = (person: Person) => {
    setPersonForm(personToForm(person));
    setPanel({ kind: "edit-person", personId: person.id });
  };

  const openCreateMarriage = (spouseAId?: string) => {
    setMarriageForm({
      spouse_a_id: spouseAId ?? selectedId ?? "",
      spouse_b_id: "",
      married_at: todayIso(),
    });
    setPanel({ kind: "create-marriage", spouseAId });
  };

  const closePanel = () => setPanel({ kind: "none" });
  const dismissSidePanel = () => {
    setOpeningDetail(false);
    setSheetSnap("half");
    closePanel();
    setSelectedId(null);
  };
  const dismissBackdrop = () => {
    // The same touch that opens the sheet often delivers a delayed click onto
    // the freshly mounted backdrop — ignore it briefly.
    if (Date.now() - panelOpenedAt.current < 450) return;
    dismissSidePanel();
  };

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1099.98px)");
    const sync = () => {
      const matches = mq.matches;
      setSheetLayout(matches);
      if (!matches) setSheetSnap("half");
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!openingDetail || !selectedPerson) return;
    // Keep the loader on screen long enough to read — sheet paint alone is too fast.
    const shownFor = Date.now() - panelOpenedAt.current;
    const remaining = Math.max(0, 900 - shownFor);
    const timer = window.setTimeout(() => setOpeningDetail(false), remaining);
    return () => window.clearTimeout(timer);
  }, [openingDetail, selectedPerson]);

  useScrollLock(
    fullscreen.active || (panelOpen && sheetSnap !== "peek"),
  );

  useEffect(() => {
    if (sheetSnap === "full") return;
    const node = panelBodyRef.current;
    if (node && node.scrollTop > 0) node.scrollTop = 0;
  }, [sheetSnap]);

  const toggleSheetExpanded = useCallback(() => {
    if (sheetDragMoved.current) {
      sheetDragMoved.current = false;
      return;
    }
    setSheetSnap((snap) => {
      if (snap === "peek") return "half";
      if (snap === "half") return "full";
      return pathDockActive ? "peek" : "half";
    });
  }, [pathDockActive]);

  const onSheetGrabberPointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      sheetDragMoved.current = false;
      sheetDrag.current = { startY: event.clientY, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [],
  );

  const onSheetGrabberPointerMove = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const drag = sheetDrag.current;
      if (!drag) return;
      if (Math.abs(event.clientY - drag.startY) > 8) drag.moved = true;
    },
    [],
  );

  const onSheetGrabberPointerUp = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const drag = sheetDrag.current;
      sheetDrag.current = null;
      if (!drag) return;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* already released */
      }
      if (!drag.moved) return;
      sheetDragMoved.current = true;
      const dy = event.clientY - drag.startY;
      if (dy < -24) {
        setSheetSnap((snap) => (snap === "peek" ? "half" : "full"));
      } else if (dy > 24) {
        setSheetSnap((snap) => {
          if (snap === "full") return "half";
          if (snap === "half" && pathDockActive) return "peek";
          return snap;
        });
      }
    },
    [pathDockActive],
  );

  // Soft-keyboard geometry for the side sheet and portaled search list.
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      const vv = window.visualViewport;
      if (!vv) {
        root.style.removeProperty("--vv-height");
        root.style.removeProperty("--keyboard-inset");
        root.style.removeProperty("--sheet-available");
        return;
      }
      root.style.setProperty("--vv-height", `${vv.height}px`);
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty("--keyboard-inset", `${inset}px`);

      // Full-height sheet must stop under the app topbar (it lives in a lower
      // stacking context, so 100dvh otherwise tucks behind the header).
      const immersive = document.body.dataset.immersive === "true";
      const topbar = document.querySelector("[data-app-topbar]");
      const headerBottom =
        !immersive && topbar instanceof HTMLElement
          ? topbar.getBoundingClientRect().bottom
          : 0;
      const available = Math.max(0, vv.height - Math.max(0, headerBottom - vv.offsetTop));
      root.style.setProperty("--sheet-available", `${available}px`);
    };
    sync();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    return () => {
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      root.style.removeProperty("--vv-height");
      root.style.removeProperty("--keyboard-inset");
      root.style.removeProperty("--sheet-available");
    };
  }, []);

  const submitPerson = async () => {
    const target =
      panel.kind === "create-person"
        ? { kind: "create" as const, linkAsParentOf: panel.linkAsParentOf }
        : panel.kind === "edit-person"
          ? { kind: "edit" as const, personId: panel.personId }
          : null;
    if (!target) return;

    const saved = await tree.savePerson({
      form: personForm,
      canUploadPhoto: permissions.canUpload,
      target,
    });
    if (!saved) return;
    closePanel();
    setSelectedId(saved.id);
    // After create or edit, land the camera on that person so the save does
    // not feel like it jumped back to the opening shot of the tree.
    relayoutFraming([saved.id]);
  };

  const handleDeletePerson = async (person: Person) => {
    const removed = await tree.removePerson(person);
    if (!removed) return;
    if (selectedId === person.id) setSelectedId(null);
    closePanel();
    relayoutKeeping([]);
  };

  const submitMarriage = async () => {
    const created = await tree.addMarriage(marriageForm);
    if (!created) return;
    closePanel();
    relayoutFraming([created.spouse_a_id, created.spouse_b_id]);
  };

  const handleDeleteMarriage = async (marriage: Marriage) => {
    const removed = await tree.removeMarriage(marriage);
    if (removed) relayoutKeeping([]);
  };

  const runRelation = async () => {
    if (!selectedId || !relateToId) return;
    const seq = ++relationRequestSeq.current;
    tree.setBusy(true);
    setAlternativesLoading(false);
    try {
      const result = await getClosestRelationship(
        treeId,
        selectedId,
        relateToId,
      );
      if (seq !== relationRequestSeq.current) return;
      if (!result.found) {
        focus.showRelationMiss(t("relationNotFound"));
        return;
      }
      const shortestPaths = relationshipToPathViews(result);
      focus.showRelationPaths(
        shortestPaths,
        t("relationFound", {
          distance: formatLocaleDigits(shortestPaths[0]?.distance ?? 0, locale),
        }),
      );
      if (sheetLayout) setSheetSnap("peek");
    } catch (err) {
      if (seq !== relationRequestSeq.current) return;
      showError(getApiErrorMessage(err, t("relationError")));
      return;
    } finally {
      if (seq === relationRequestSeq.current) tree.setBusy(false);
    }

    // Shortest is already on screen; load diverse routes without blocking.
    setAlternativesLoading(true);
    try {
      const alternatives = await getAlternativeRelationshipPaths(
        treeId,
        selectedId,
        relateToId,
      );
      if (seq !== relationRequestSeq.current) return;
      if (!alternatives.found) return;
      const paths = relationshipToPathViews(alternatives);
      if (paths.length <= 1) return;
      focus.showRelationPaths(
        paths,
        t("relationFound", {
          distance: formatLocaleDigits(paths[0]?.distance ?? 0, locale),
        }),
      );
    } catch {
      // Soft-fail: closest path already shown.
    } finally {
      if (seq === relationRequestSeq.current) setAlternativesLoading(false);
    }
  };

  const handleFitView = () => {
    focus.frameWholeGraph();
  };

  if (tree.loading) {
    return <p className={styles.empty}>{t("loading")}</p>;
  }

  if (tree.loadError && !tree.treeName) {
    return (
      <section className={styles.root}>
        <Alert tone="error">{tree.loadError}</Alert>
        <Link href="/dashboard/trees">{tTrees("back")}</Link>
      </section>
    );
  }

  const shortestPathIds = new Set(focus.relationPaths[0]?.ids ?? []);
  const pathChoices = focus.relationPaths.map((path, index) => {
    const distance = formatLocaleDigits(path.distance, locale);
    const lane = index === focus.activePathIndex ? 0 : 1;
    if (index === 0) {
      return {
        key: `closest-${path.ids.join("-")}`,
        label: t("relationPathClosest", { distance }),
        lane,
      };
    }
    const viaId = path.ids.slice(1, -1).find((id) => !shortestPathIds.has(id));
    const viaPerson = viaId ? personById.get(viaId) : undefined;
    const name = viaPerson ? personDisplayName(viaPerson) : null;
    return {
      key: `alt-${index}-${path.ids.join("-")}`,
      label: name
        ? t("relationPathVia", { name, distance })
        : t("relationPathOther", {
            n: formatLocaleDigits(index + 1, locale),
            distance,
          }),
      lane,
    };
  });

  const canvasAltPathIds =
    focus.pathViewMode === "active" ? EMPTY_PATH_IDS : focus.altPathIds;

  const relationResult = (
    <RelationResult
      label={focus.relationLabel}
      hasPath={focus.highlightIds.size > 0}
      viewMode={focus.pathViewMode}
      onApplyView={focus.applyPathView}
      paths={pathChoices}
      activePathIndex={focus.activePathIndex}
      onSelectPath={focus.selectRelationPath}
      alternativesLoading={alternativesLoading}
    />
  );

  return (
    <section
      className={
        fullscreen.active ? `${styles.root} ${styles.immersive}` : styles.root
      }
    >
      <PedigreeHeader
        treeId={treeId}
        treeName={tree.treeName}
        personCount={persons.length}
        marriageCount={marriages.length}
        busy={busy}
        searchPeople={searchPeople}
        hint={personSearchHint}
        onPickSearchResult={(person) => {
          // Sheet layout covers the canvas — search only frames the person;
          // tapping the node still opens the detail page.
          if (sheetLayout) {
            setSelectedId(null);
            setPanel({ kind: "none" });
            focusCameraOn([person.id]);
            return;
          }
          onSelect(person.id);
          focusCameraOn([person.id]);
        }}
        canReadPersons={permissions.canReadPersons}
        canCreatePerson={permissions.canCreatePerson}
        canCreateMarriage={permissions.canCreateMarriage}
        canDownloadSample={permissions.canDownloadSample}
        canImportExcel={permissions.canImportExcel}
        canExportExcel={permissions.canExportExcel}
        canCreateTicket={permissions.canCreateTicket}
        branchActive={Boolean(focus.branchRootId)}
        fullscreen={fullscreen.active}
        foldedCount={branches.hiddenPersonIds.size}
        onExpandFolded={branches.expandAll}
        fileInputRef={excel.fileInputRef}
        onAddPerson={() => openCreatePerson()}
        onAddMarriage={() => openCreateMarriage()}
        onTidyLayout={bumpLayout}
        onFitView={handleFitView}
        onToggleFullscreen={fullscreen.toggle}
        onExport={() => exportDialog.openTreeExport()}
        onExitBranch={focus.clearBranchPreview}
        onDownloadSample={() => void excel.downloadSample()}
        onExportExcel={() => void excel.exportExcel()}
        onPickFile={(file) => void excel.openPreview(file)}
        onCreateTicket={() => setTicketOpen(true)}
        people={persons}
        canViewBirthDate={permissions.canViewBirthDate}
        onSelectBirthdayPerson={(personId) => {
          onSelect(personId);
          focusCameraOn([personId]);
        }}
      />

      {!permissions.canReadPersons ? (
        <Alert tone="error">{t("needPersonRead")}</Alert>
      ) : null}

      <div
        className={
          sheetSnap === "peek" && pathDockActive
            ? `${styles.workspace} ${styles.workspacePathDock}`
            : styles.workspace
        }
      >
        <div className={styles.stage}>
          <div className={styles.canvasWrap}>
            {persons.length === 0 && permissions.canReadPersons ? (
              <div className={styles.emptyState}>
                <h2>{t("emptyTitle")}</h2>
                <p>{t("emptySupport")}</p>
                {permissions.canCreatePerson ? (
                  <Button onClick={() => openCreatePerson()}>
                    {t("addPerson")}
                  </Button>
                ) : null}
              </div>
            ) : (
              <PedigreeCanvas
                layoutNodes={graph.nodes}
                layoutEdges={graph.edges}
                layoutToken={focus.layoutToken}
                layoutAnchor={focus.layoutAnchor}
                cameraToken={focus.cameraToken}
                cameraNodeIds={focus.cameraNodeIds}
                selectedId={selectedId}
                focusIds={focusIds}
                pathIds={focus.highlightIds}
                pathOrder={focus.highlightPathOrder}
                altPathIds={canvasAltPathIds}
                pathLaneById={focus.pathLaneById}
                visiblePersonIds={timeline.visiblePersonIds}
                onSelect={onSelect}
                asOfYear={timeline.year}
                dataAccess={dataAccess}
                branchActions={branchActions}
                exportApiRef={canvasApiRef}
              />
            )}
          </div>

          {timeline.bounds &&
          timeline.year !== null &&
          permissions.canReadPersons ? (
            <TimelineBar
              bounds={timeline.bounds}
              year={timeline.year}
              visibleCount={timeline.visiblePersons.length}
              totalCount={persons.length}
              onYearChange={timeline.setYear}
            />
          ) : null}
        </div>

        {panelOpen && sheetSnap !== "peek" ? (
          <button
            type="button"
            className={styles.panelBackdrop}
            aria-label={t("close")}
            onClick={dismissBackdrop}
          />
        ) : null}

        {panelOpen ? (
          <aside
            className={
              sheetSnap === "full"
                ? `${styles.panel} ${styles.panelExpanded}`
                : sheetSnap === "peek"
                  ? `${styles.panel} ${styles.panelPeek}`
                  : styles.panel
            }
            aria-live="polite"
          >
            <button
              type="button"
              className={styles.panelGrabber}
              aria-label={
                sheetSnap === "peek"
                  ? t("sheetExpand")
                  : sheetSnap === "full"
                    ? pathDockActive
                      ? t("sheetPeek")
                      : t("sheetCollapse")
                    : t("sheetExpand")
              }
              aria-expanded={sheetSnap === "full"}
              onClick={toggleSheetExpanded}
              onPointerDown={onSheetGrabberPointerDown}
              onPointerMove={onSheetGrabberPointerMove}
              onPointerUp={onSheetGrabberPointerUp}
              onPointerCancel={() => {
                sheetDrag.current = null;
              }}
            />
            <div
              ref={panelBodyRef}
              className={styles.panelBody}
              onScroll={() => {
                if (sheetSnap !== "half") return;
                const node = panelBodyRef.current;
                if (node && node.scrollTop > 10) setSheetSnap("full");
              }}
            >
              {sheetSnap === "peek" && pathDockActive ? (
                <div className={styles.pathPeekDock}>
                  <p className={styles.pathPeekHint}>{t("pathPeekHint")}</p>
                  {relationResult}
                  <div className={styles.pathPeekActions}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSheetSnap("half")}
                    >
                      {t("sheetExpand")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        relationRequestSeq.current += 1;
                        setAlternativesLoading(false);
                        clearRelationHighlight();
                        setRelateToId("");
                        setOpeningDetail(false);
                        setSheetSnap("half");
                        setSelectedId(null);
                        closePanel();
                      }}
                    >
                      {t("close")}
                    </Button>
                  </div>
                </div>
              ) : (
              <PedigreeSidePanels
                panel={panel}
                selectedPerson={selectedPerson}
                personForm={personForm}
                setPersonForm={setPersonForm}
                marriageForm={marriageForm}
                setMarriageForm={setMarriageForm}
                busy={busy}
                parentFormOptions={parentFormOptions}
                personOptions={personOptions}
                personSearchHint={personSearchHint}
                marriageOptions={marriageOptions}
                marriages={marriages}
                editingMarriages={editingMarriages}
                nameOf={nameOf}
                parentOfName={
                  creatingParentChild
                    ? personDisplayName(creatingParentChild)
                    : null
                }
                existingPhotoUrl={
                  editingPerson
                    ? resolvePersonPhotoUrl(
                        editingPerson.photo_url,
                        editingPerson.photo_object_key,
                      )
                    : null
                }
                divorceDate={divorceDate}
                onDivorceDateChange={setDivorceDate}
                canReadMarriages={permissions.canReadMarriages}
                canUpdateMarriage={permissions.canUpdateMarriage}
                canDeleteMarriage={permissions.canDeleteMarriage}
                canDivorce={permissions.canDivorce}
                canUpload={permissions.canUpload}
                onSubmitPerson={() => void submitPerson()}
                onSubmitMarriage={() => void submitMarriage()}
                onClosePanel={closePanel}
                onUpdateMarriedAt={(marriage, marriedAt) =>
                  void tree.changeMarriedAt(marriage, marriedAt)
                }
                onDivorce={(marriage) =>
                  void tree.divorce(marriage, divorceDate)
                }
                onDeleteMarriage={(marriage) =>
                  void handleDeleteMarriage(marriage)
                }
                selectedPersonPhoto={selectedPersonPhoto}
                selectedPersonAge={selectedPersonAge}
                asOfYear={timeline.year}
                selectedMarriages={selectedMarriages}
                descendantStats={descendantStats}
                hasFather={Boolean(selectedPersonParents.father)}
                hasMother={Boolean(selectedPersonParents.mother)}
                branchActive={focus.branchRootId === selectedPerson?.id}
                branchRootName={
                  branchRootPerson ? personDisplayName(branchRootPerson) : null
                }
                relationResult={relationResult}
                canReadPersons={permissions.canReadPersons}
                canViewBirthDate={permissions.canViewBirthDate}
                canViewMarriageDate={permissions.canViewMarriageDate}
                canViewPhoto={permissions.canViewPhoto}
                canUpdatePerson={permissions.canUpdatePerson}
                canDeletePerson={permissions.canDeletePerson}
                canCreatePerson={permissions.canCreatePerson}
                canCreateMarriage={permissions.canCreateMarriage}
                onCloseDetail={() => setSelectedId(null)}
                onSelectPerson={onSelect}
                onEditPerson={() =>
                  selectedPerson ? openEditPerson(selectedPerson) : undefined
                }
                onAddMarriage={() =>
                  selectedPerson
                    ? openCreateMarriage(selectedPerson.id)
                    : undefined
                }
                onAddChild={() =>
                  selectedPerson
                    ? openCreatePerson({
                        parent1_id: selectedPerson.id,
                        parent1_type: "biological",
                      })
                    : undefined
                }
                onAddParent={(role) =>
                  selectedPerson
                    ? openCreateParent(selectedPerson, role)
                    : undefined
                }
                onFindRelation={() => {
                  if (!selectedPerson) return;
                  setRelateToId("");
                  setPanel({ kind: "relate", fromId: selectedPerson.id });
                }}
                onToggleBranch={() => {
                  if (!selectedPerson) return;
                  const personId = selectedPerson.id;
                  setSelectedId(null);
                  setPanel({ kind: "none" });
                  if (focus.branchRootId === personId) {
                    focus.clearBranchPreview();
                  } else {
                    focus.openBranchPreview(personId);
                  }
                }}
                onDownloadLineage={() =>
                  selectedPerson
                    ? exportDialog.openLineageExport(selectedPerson)
                    : undefined
                }
                onDeletePerson={() =>
                  selectedPerson
                    ? void handleDeletePerson(selectedPerson)
                    : undefined
                }
                relateToId={relateToId}
                relateToName={
                  relateToPerson ? personDisplayName(relateToPerson) : null
                }
                searchRelatePeople={searchRelatePeople}
                onPickRelate={setRelateToId}
                onClearRelatePick={() => setRelateToId("")}
                onSubmitRelate={() => void runRelation()}
                onCancelRelate={() => {
                  relationRequestSeq.current += 1;
                  setAlternativesLoading(false);
                  clearRelationHighlight();
                  setRelateToId("");
                  setSheetSnap("half");
                  closePanel();
                }}
              />
              )}
            </div>
          </aside>
        ) : null}
      </div>

      <PedigreeOverlays
        excel={
          excel.preview
            ? {
                preview: excel.preview,
                fileName: excel.previewName,
                selectedPersonRefs: excel.selectedPersonRefs,
                selectedMarriageRefs: excel.selectedMarriageRefs,
                selectedPersonCount: excel.selectedPersonCount,
                selectedMarriageCount: excel.selectedMarriageCount,
                canConfirm: excel.canConfirm,
                busy,
                onTogglePerson: excel.togglePerson,
                onToggleMarriage: excel.toggleMarriage,
                onSelectNew: excel.selectNewRows,
                onClearSelection: excel.clearSelection,
                onConfirm: () => void excel.confirmImport(),
                onClose: excel.closePreview,
              }
            : null
        }
        exportHost={
          exportDialog.job
            ? {
                flow: exportDialog,
                posterRef,
                persons,
                marriages,
                treeName: tree.treeName,
              }
            : null
        }
        ticket={{
          treeId,
          open: ticketOpen,
          onClose: () => setTicketOpen(false),
        }}
      />

      {openingDetail
        ? createPortal(
            <div
              className={styles.detailOpening}
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <div className={styles.detailOpeningCard}>
                <span className={styles.detailOpeningSpinner} aria-hidden />
                <p>{t("openingPerson")}</p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
