"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import {
  createMarriage as apiCreateMarriage,
  createPerson as apiCreatePerson,
  deleteMarriage as apiDeleteMarriage,
  deletePerson as apiDeletePerson,
  divorceMarriage as apiDivorceMarriage,
  getFamilyTree,
  listAllMarriages,
  listAllPersons,
  updateMarriage as apiUpdateMarriage,
  updatePerson as apiUpdatePerson,
  uploadMedia,
} from "@/lib/auth/client";
import {
  freeOwnerAtMarriageLimit,
  freeOwnerAtPersonLimit,
} from "@/lib/auth/account-limits";
import { useFreeAccountNotice } from "@/lib/auth/useFreeAccountNotice";
import {
  getApiErrorMessage,
  Permissions,
  type FamilyTree,
  type Marriage,
  type MarriageCreateInput,
  type Person,
} from "@/lib/auth/types";
import { TreeAccess } from "@/lib/auth/tree-access";
import { allOrCancelled, isAbortError } from "@/lib/api";
import { toLatinDigits } from "@/lib/localeDigits";
import { personDisplayName } from "@/lib/pedigree/layout";
import { useRouter } from "@/i18n/navigation";
import {
  personPayloadFromForm,
  type LinkAsParentOf,
  type PersonFormState,
} from "./person-form";

type SavePersonTarget =
  | { kind: "create"; linkAsParentOf?: LinkAsParentOf }
  | { kind: "edit"; personId: string };

type SavePersonInput = {
  form: PersonFormState;
  /** Without the media permission a picked file is dropped, not uploaded. */
  canUploadPhoto: boolean;
  target: SavePersonTarget;
};

type TreeSnapshot = {
  tree: Awaited<ReturnType<typeof getFamilyTree>>;
  personList: Person[];
  marriageList: Marriage[];
};

export type TreeData = {
  treeName: string;
  persons: Person[];
  marriages: Marriage[];
  loading: boolean;
  loadError: string | null;
  busy: boolean;
  /**
   * Held for callers that own their own error handling (the Excel wizard and
   * the relationship lookup), so the whole view greys out as one.
   */
  setBusy: (busy: boolean) => void;
  hasTreeAccess: (permission: string) => boolean;
  reload: () => Promise<void>;
  savePerson: (input: SavePersonInput) => Promise<Person | null>;
  removePerson: (person: Person) => Promise<boolean>;
  addMarriage: (input: MarriageCreateInput) => Promise<Marriage | null>;
  changeMarriedAt: (marriage: Marriage, marriedAt: string) => Promise<void>;
  divorce: (marriage: Marriage, divorcedAt: string) => Promise<void>;
  removeMarriage: (marriage: Marriage) => Promise<boolean>;
};

/**
 * Owns the loaded tree and every write against it. Callers get the resulting
 * record back (or `null` after a handled failure) and decide what the UI does
 * next — which panel closes, what gets selected, whether the layout re-fits.
 *
 * `onLoaded` fires after a fetch replaces the tree, which is when the graph has
 * to be laid out again.
 */
export function useTreeData(treeId: string, onLoaded: () => void): TreeData {
  const t = useTranslations("pedigree");
  const router = useRouter();
  const { status, user, hasPermission } = useAuth();
  const { showError, showSuccess, confirm } = useFeedback();
  const { showFreeAccountNotice, handleMaybeFreeLimit } = useFreeAccountNotice();

  const [treeName, setTreeName] = useState("");
  const [treeMeta, setTreeMeta] = useState<FamilyTree | null>(null);
  const [persons, setPersons] = useState<Person[]>([]);
  const [marriages, setMarriages] = useState<Marriage[]>([]);
  const [treeAccess, setTreeAccess] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingTreeId, setPendingTreeId] = useState(treeId);

  // Switching trees without remounting must show the new tree loading rather
  // than the previous tree's data.
  if (treeId !== pendingTreeId) {
    setPendingTreeId(treeId);
    setLoading(true);
    setLoadError(null);
  }

  const hasTreeAccess = useCallback(
    (permission: string) => treeAccess.has(permission),
    [treeAccess],
  );

  // Read through a ref so a caller passing an inline callback cannot make the
  // fetch effect re-run, and therefore re-fetch, on every render.
  const onLoadedRef = useRef(onLoaded);
  useEffect(() => {
    onLoadedRef.current = onLoaded;
  });

  /** Resolves `null` when the caller was cancelled before the data arrived. */
  const fetchSnapshot = useCallback(
    async (signal?: AbortSignal): Promise<TreeSnapshot | null> => {
      const tree = await getFamilyTree(treeId, signal);
      if (signal?.aborted) return null;

      const canView = (tree.my_permissions ?? []).includes(TreeAccess.VIEW);
      if (!canView) {
        return { tree, personList: [], marriageList: [] };
      }

      const loaded = await allOrCancelled(
        [
          listAllPersons(treeId, signal),
          listAllMarriages(treeId, signal),
        ] as const,
        signal,
      );
      if (!loaded) return null;

      const [personList, marriageList] = loaded;
      return { tree, personList, marriageList };
    },
    [treeId],
  );

  const applySnapshot = useCallback((snapshot: TreeSnapshot) => {
    setLoadError(null);
    setTreeName(snapshot.tree.name);
    setTreeMeta(snapshot.tree);
    const access = new Set(snapshot.tree.my_permissions ?? []);
    setTreeAccess(access);

    const canView = access.has(TreeAccess.VIEW);
    setPersons(canView ? snapshot.personList : []);
    setMarriages(canView ? snapshot.marriageList : []);
    onLoadedRef.current();
  }, []);

  const applyLoadFailure = useCallback(
    (err: unknown) => {
      const message = getApiErrorMessage(err, t("loadError"));
      setLoadError(message);
      showError(message);
    },
    [t, showError],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const snapshot = await fetchSnapshot();
      if (snapshot) applySnapshot(snapshot);
    } catch (err) {
      applyLoadFailure(err);
    } finally {
      setLoading(false);
    }
  }, [fetchSnapshot, applySnapshot, applyLoadFailure]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!hasPermission(Permissions.TREE_READ)) {
      router.replace("/dashboard");
      return;
    }
    // Navigating between trees must not let the slower response win.
    const controller = new AbortController();
    async function run() {
      try {
        // A cleanup abort (tree switch, unmount, React StrictMode remount)
        // cancels the in-flight requests and resolves without a snapshot.
        const snapshot = await fetchSnapshot(controller.signal);
        // A cancel that lands after the data arrived still has to be honoured,
        // or a tree switch could paint the tree that was left behind.
        if (!snapshot || controller.signal.aborted) return;
        applySnapshot(snapshot);
      } catch (err) {
        if (controller.signal.aborted || isAbortError(err)) return;
        applyLoadFailure(err);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void run();
    return () =>
      controller.abort(
        new DOMException("Tree view navigated away", "AbortError"),
      );
  }, [
    status,
    hasPermission,
    router,
    fetchSnapshot,
    applySnapshot,
    applyLoadFailure,
  ]);

  const savePerson = useCallback(
    async ({ form, canUploadPhoto, target }: SavePersonInput) => {
      if (
        target.kind === "create" &&
        freeOwnerAtPersonLimit(user, treeMeta, persons.length)
      ) {
        await showFreeAccountNotice();
        return null;
      }
      setBusy(true);
      try {
        let photoObjectKey: string | null | undefined;
        if (form.photoFile && canUploadPhoto) {
          const uploaded = await uploadMedia(treeId, form.photoFile);
          photoObjectKey = uploaded.object_key;
        } else if (target.kind === "edit" && form.photoRemoved) {
          photoObjectKey = null;
        }

        const payload = personPayloadFromForm(form, photoObjectKey, marriages);

        if (target.kind === "create") {
          const created = await apiCreatePerson(treeId, payload);
          let nextPersons = [...persons, created];
          const link = target.linkAsParentOf;
          if (link) {
            const child = persons.find((person) => person.id === link.childId);
            if (child) {
              const updatedChild = await apiUpdatePerson(treeId, child.id, {
                parents: [
                  ...child.parents,
                  {
                    parent_id: created.id,
                    relationship_type: "biological",
                  },
                ],
              });
              nextPersons = nextPersons.map((person) =>
                person.id === updatedChild.id ? updatedChild : person,
              );
            }
          }
          setPersons(nextPersons);
          showSuccess(t("personCreateSuccess"));
          return created;
        }

        const updated = await apiUpdatePerson(treeId, target.personId, payload);
        setPersons((prev) =>
          prev.map((person) => (person.id === updated.id ? updated : person)),
        );
        showSuccess(t("personUpdateSuccess"));
        return updated;
      } catch (err) {
        await handleMaybeFreeLimit(
          err,
          getApiErrorMessage(err, t("personSaveError")),
        );
        return null;
      } finally {
        setBusy(false);
      }
    },
    [
      treeId,
      treeMeta,
      user,
      persons,
      marriages,
      showFreeAccountNotice,
      handleMaybeFreeLimit,
      showSuccess,
      t,
    ],
  );

  const removePerson = useCallback(
    async (person: Person) => {
      const ok = await confirm(
        t("personDeleteConfirm", { name: personDisplayName(person) }),
        { confirmLabel: t("delete") },
      );
      if (!ok) return false;
      setBusy(true);
      try {
        await apiDeletePerson(treeId, person.id);
        setPersons((prev) => prev.filter((item) => item.id !== person.id));
        showSuccess(t("personDeleteSuccess"));
        return true;
      } catch (err) {
        showError(getApiErrorMessage(err, t("personDeleteError")));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [treeId, confirm, showError, showSuccess, t],
  );

  const addMarriage = useCallback(
    async (input: MarriageCreateInput) => {
      if (freeOwnerAtMarriageLimit(user, treeMeta, marriages.length)) {
        await showFreeAccountNotice();
        return null;
      }
      setBusy(true);
      try {
        const created = await apiCreateMarriage(treeId, {
          spouse_a_id: input.spouse_a_id,
          spouse_b_id: input.spouse_b_id,
          married_at: toLatinDigits(input.married_at),
        });
        setMarriages((prev) => [...prev, created]);
        showSuccess(t("marriageCreateSuccess"));
        return created;
      } catch (err) {
        await handleMaybeFreeLimit(
          err,
          getApiErrorMessage(err, t("marriageSaveError")),
        );
        return null;
      } finally {
        setBusy(false);
      }
    },
    [
      treeId,
      treeMeta,
      user,
      marriages.length,
      showFreeAccountNotice,
      handleMaybeFreeLimit,
      showSuccess,
      t,
    ],
  );

  const changeMarriedAt = useCallback(
    async (marriage: Marriage, marriedAt: string) => {
      const next = toLatinDigits(marriedAt.trim());
      if (!next || next === marriage.married_at) return;
      setBusy(true);
      try {
        const updated = await apiUpdateMarriage(treeId, marriage.id, {
          married_at: next,
        });
        setMarriages((prev) =>
          prev.map((item) => (item.id === marriage.id ? updated : item)),
        );
        showSuccess(t("marriageUpdateSuccess"));
      } catch (err) {
        showError(getApiErrorMessage(err, t("marriageSaveError")));
      } finally {
        setBusy(false);
      }
    },
    [treeId, showError, showSuccess, t],
  );

  const divorce = useCallback(
    async (marriage: Marriage, divorcedAt: string) => {
      const ok = await confirm(t("divorceConfirm"), {
        confirmLabel: t("divorce"),
      });
      if (!ok) return;
      setBusy(true);
      try {
        await apiDivorceMarriage(treeId, marriage.id, toLatinDigits(divorcedAt));
        setMarriages((prev) =>
          prev.map((item) =>
            item.id === marriage.id
              ? { ...item, divorced_at: divorcedAt }
              : item,
          ),
        );
        showSuccess(t("divorceSuccess"));
      } catch (err) {
        showError(getApiErrorMessage(err, t("divorceError")));
      } finally {
        setBusy(false);
      }
    },
    [treeId, confirm, showError, showSuccess, t],
  );

  const removeMarriage = useCallback(
    async (marriage: Marriage) => {
      const ok = await confirm(t("marriageDeleteConfirm"), {
        confirmLabel: t("delete"),
      });
      if (!ok) return false;
      setBusy(true);
      try {
        await apiDeleteMarriage(treeId, marriage.id);
        setMarriages((prev) => prev.filter((item) => item.id !== marriage.id));
        showSuccess(t("marriageDeleteSuccess"));
        return true;
      } catch (err) {
        showError(getApiErrorMessage(err, t("marriageDeleteError")));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [treeId, confirm, showError, showSuccess, t],
  );

  return {
    treeName,
    persons,
    marriages,
    loading,
    loadError,
    busy,
    setBusy,
    hasTreeAccess,
    reload,
    savePerson,
    removePerson,
    addMarriage,
    changeMarriedAt,
    divorce,
    removeMarriage,
  };
}
