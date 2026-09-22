"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import { TreeMemberAccessDialog } from "@/components/app/TreeMemberAccessDialog";
import {
  addTreeMember,
  deleteFamilyTree,
  getFamilyTree,
  listTreeMembers,
  removeTreeMember,
  updateFamilyTree,
  updateTreeMember,
} from "@/lib/auth/client";
import {
  AuthApiError,
  getApiErrorMessage,
  Permissions,
  type FamilyTree,
  type TreeMembership,
} from "@/lib/auth/types";
import {
  TreeAccess,
  canAccessTreeSettings,
  groupTreeAccess,
  isTreeOwner,
  normalizeTreeAccess,
} from "@/lib/auth/tree-access";
import { Link, useRouter } from "@/i18n/navigation";
import { Button, ButtonLink } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Alert, Badge } from "@/components/ui/Feedback";
import { Form, FormActions } from "@/components/ui/Form";
import { Page, PageHeader, Panel } from "@/components/ui/Page";
import styles from "./TreesView.module.css";

type Props = {
  treeId: string;
};

type SettingsTab = "members" | "details";

type AccessDialogState =
  | { mode: "add" }
  | { mode: "edit"; member: TreeMembership };

const USER_NOT_FOUND_CODE = 1400;

export function TreeDetailView({ treeId }: Props) {
  const t = useTranslations("trees");
  const { showError, showSuccess, confirm } = useFeedback();
  const { status, user: me, hasPermission } = useAuth();
  const router = useRouter();
  const [tree, setTree] = useState<FamilyTree | null>(null);
  const [members, setMembers] = useState<TreeMembership[]>([]);
  const [name, setName] = useState("");
  const [tab, setTab] = useState<SettingsTab>("members");
  const [accessDialog, setAccessDialog] = useState<AccessDialogState | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const canRename = isTreeOwner(tree, me?.id);
  const canDeleteTree =
    isTreeOwner(tree, me?.id) && hasPermission(Permissions.TREE_DELETE);
  const myAccess = new Set(tree?.my_permissions ?? []);
  const canAddMember = myAccess.has(TreeAccess.MEMBER_ADD);
  const canRemoveMember = myAccess.has(TreeAccess.MEMBER_REMOVE);
  const canSaveName = canRename && name.trim().length > 0;

  const ownerCount = useMemo(
    () => members.filter((member) => member.role === "owner").length,
    [members],
  );

  const ownerLabel = useMemo(() => {
    if (!tree) return "";
    const ownerMember = members.find(
      (member) => member.user_id === tree.owner_user_id,
    );
    if (ownerMember?.username) return ownerMember.username;
    if (me && me.id === tree.owner_user_id) return me.fullname || me.username;
    return t("owner");
  }, [tree, members, me, t]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!hasPermission(Permissions.TREE_READ)) {
      router.replace("/dashboard");
      return;
    }

    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const treeData = await getFamilyTree(treeId);
        if (!canAccessTreeSettings(treeData, me?.id)) {
          router.replace(`/dashboard/trees/${treeId}`);
          return;
        }
        const memberList = await listTreeMembers(treeId);
        setTree(treeData);
        setName(treeData.name);
        setMembers(memberList);
      } catch (err) {
        const message = getApiErrorMessage(err, t("loadError"));
        setLoadError(message);
        showError(message);
      } finally {
        setLoading(false);
      }
    })();
  }, [status, hasPermission, router, treeId, t, showError, me?.id]);

  const onSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!canRename || !canSaveName) return;
    setSaving(true);
    try {
      const updated = await updateFamilyTree(treeId, { name: name.trim() });
      setTree(updated);
      setName(updated.name);
      showSuccess(t("saveSuccess"));
    } catch (err) {
      showError(getApiErrorMessage(err, t("saveError")));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canDeleteTree) return;
    const ok = await confirm(t("deleteConfirm"), {
      confirmLabel: t("delete"),
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteFamilyTree(treeId);
      router.replace("/dashboard/trees");
    } catch (err) {
      showError(getApiErrorMessage(err, t("deleteError")));
      setDeleting(false);
    }
  };

  const handleAddMember = async (username: string, access: string[]) => {
    setAddingMember(true);
    try {
      const membership = await addTreeMember(
        treeId,
        username,
        normalizeTreeAccess(access),
      );
      setMembers((prev) => [...prev, membership]);
      setAccessDialog(null);
      showSuccess(t("memberAddSuccess"));
    } catch (err) {
      if (
        err instanceof AuthApiError &&
        (err.status === 404 || Number(err.errorCode) === USER_NOT_FOUND_CODE)
      ) {
        showError(t("memberNotFound"));
      } else {
        showError(getApiErrorMessage(err, t("memberAddError")));
      }
    } finally {
      setAddingMember(false);
    }
  };

  const handleSaveAccess = async (userId: string, access: string[]) => {
    setSavingAccess(true);
    try {
      const updated = await updateTreeMember(
        treeId,
        userId,
        normalizeTreeAccess(access),
      );
      setMembers((prev) =>
        prev.map((member) =>
          member.user_id === userId ? updated : member,
        ),
      );
      setAccessDialog(null);
      showSuccess(t("memberAccessSuccess"));
    } catch (err) {
      showError(getApiErrorMessage(err, t("memberAccessError")));
    } finally {
      setSavingAccess(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    const target = members.find((member) => member.user_id === userId);
    if (target?.role === "owner" && ownerCount <= 1) {
      showError(t("lastOwnerRemoveBlocked"));
      return;
    }
    const ok = await confirm(t("memberRemoveConfirm"), {
      confirmLabel: t("memberRemove"),
    });
    if (!ok) return;
    setRemovingId(userId);
    try {
      await removeTreeMember(treeId, userId);
      setMembers((prev) => prev.filter((member) => member.user_id !== userId));
      if (
        accessDialog?.mode === "edit" &&
        accessDialog.member.user_id === userId
      ) {
        setAccessDialog(null);
      }
      showSuccess(t("memberRemoveSuccess"));
    } catch (err) {
      showError(getApiErrorMessage(err, t("memberRemoveError")));
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) {
    return (
      <Page>
        <p className={styles.empty}>{t("loading")}</p>
      </Page>
    );
  }

  if (!tree) {
    return (
      <Page>
        <Alert tone="error">{loadError ?? t("notFound")}</Alert>
        <Link className={styles.link} href={`/dashboard/trees/${treeId}`}>
          {t("backToPedigree")}
        </Link>
      </Page>
    );
  }

  const busy =
    saving ||
    deleting ||
    addingMember ||
    savingAccess ||
    removingId !== null;

  const memberLabel = (member: TreeMembership) =>
    member.username ||
    (me && me.id === member.user_id
      ? me.fullname || me.username
      : t("memberRole.member"));

  return (
    <Page>
      <PageHeader
        back={{
          href: `/dashboard/trees/${treeId}`,
          label: t("backToPedigree"),
        }}
        title={t("editTitle", { name: tree.name })}
        support={t("editSupport")}
        actions={
          <ButtonLink
            href={`/dashboard/trees/${treeId}`}
            variant="subtle"
            className={styles.openTreeAction}
          >
            <span className={styles.openLong}>{t("open")}</span>
            <span className={styles.openShort}>{t("openShort")}</span>
          </ButtonLink>
        }
      />

      <div
        className={`${styles.scopeTrack} ${styles.settingsTabs}`}
        role="tablist"
        aria-label={t("settingsTabsLabel")}
      >
        {(
          [
            ["members", t("membersTitle")],
            ["details", t("detailsTitle")],
          ] as const
        ).map(([value, label]) => {
          const selected = tab === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={selected}
              className={
                selected
                  ? `${styles.scopeTab} ${styles.scopeTabActive}`
                  : styles.scopeTab
              }
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tab === "details" ? (
        <Panel
          delay={1}
          title={t("detailsTitle")}
          support={t("detailsSupport")}
        >
          <Form columns="single" onSubmit={onSave}>
            <TextField
              label={t("name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={1}
              maxLength={100}
              disabled={!canRename || busy}
              autoComplete="off"
            />

            <dl className={styles.metaGrid}>
              <div className={styles.metaItem}>
                <dt>{t("owner")}</dt>
                <dd>{ownerLabel}</dd>
              </div>
              <div className={styles.metaItem}>
                <dt>{t("membersTitle")}</dt>
                <dd>{t("memberCount", { count: members.length })}</dd>
              </div>
            </dl>

            {canRename ? (
              <FormActions>
                <Button
                  type="submit"
                  loading={saving}
                  disabled={!canSaveName || busy}
                >
                  {saving ? t("saving") : t("save")}
                </Button>
              </FormActions>
            ) : null}
          </Form>

          {canDeleteTree ? (
            <div className={styles.dangerZone}>
              <div className={styles.dangerZoneText}>
                <h3 className={styles.dangerZoneTitle}>{t("dangerTitle")}</h3>
                <p className={styles.dangerZoneSupport}>{t("dangerSupport")}</p>
              </div>
              <Button
                variant="danger"
                loading={deleting}
                disabled={busy}
                onClick={() => void handleDelete()}
              >
                {deleting ? t("working") : t("delete")}
              </Button>
            </div>
          ) : null}
        </Panel>
      ) : (
        <Panel
          delay={1}
          title={t("membersTitle")}
          support={t("membersSupport")}
          actions={
            canAddMember ? (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => setAccessDialog({ mode: "add" })}
              >
                {t("addMemberTitle")}
              </Button>
            ) : undefined
          }
        >
          {members.length === 0 ? (
            <p className={styles.empty}>{t("membersEmpty")}</p>
          ) : (
            <ul className={styles.memberList}>
              {members.map((member) => {
                const isLastOwner =
                  member.role === "owner" && ownerCount <= 1;
                const label = memberLabel(member);
                const perms = member.permissions ?? [];
                const accessGroups = groupTreeAccess(perms);
                return (
                  <li key={member.id} className={styles.memberCard}>
                    <div className={styles.memberHead}>
                      <div className={styles.memberIdentity}>
                        <p className={styles.memberName}>{label}</p>
                        <span
                          className={`${styles.badge} ${
                            member.role === "owner"
                              ? styles.badgeOwned
                              : styles.badgeJoined
                          }`}
                        >
                          {t(`memberRole.${member.role}`)}
                        </span>
                      </div>
                      <div className={styles.memberActions}>
                        {canAddMember && member.role !== "owner" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() =>
                              setAccessDialog({ mode: "edit", member })
                            }
                          >
                            {t("memberAccessEdit")}
                          </Button>
                        ) : null}
                        {canRemoveMember ? (
                          <Button
                            size="sm"
                            variant="dangerGhost"
                            loading={removingId === member.user_id}
                            disabled={busy}
                            title={
                              isLastOwner
                                ? t("lastOwnerRemoveBlocked")
                                : undefined
                            }
                            onClick={() =>
                              void handleRemoveMember(member.user_id)
                            }
                          >
                            {removingId === member.user_id
                              ? t("working")
                              : t("memberRemove")}
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {member.role === "owner" ? (
                      <p className={styles.accessSummaryMuted}>
                        {t("ownerAccessFull")}
                      </p>
                    ) : accessGroups.length > 0 ? (
                      <div className={styles.accessSummary}>
                        <span className={styles.accessSummaryCount}>
                          {t("accessSummaryCount", { count: perms.length })}
                        </span>
                        <div className={styles.accessSummaryChips}>
                          {accessGroups.map((group) => (
                            <Badge key={group.id} tone="neutral">
                              {t(`accessGroups.${group.id}`)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className={styles.accessSummaryMuted}>
                        {t("accessSummaryEmpty")}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      )}

      {accessDialog?.mode === "add" ? (
        <TreeMemberAccessDialog
          open
          mode="add"
          busy={addingMember}
          onClose={() => {
            if (!addingMember) setAccessDialog(null);
          }}
          onSubmit={handleAddMember}
        />
      ) : null}

      {accessDialog?.mode === "edit" ? (
        <TreeMemberAccessDialog
          open
          mode="edit"
          busy={savingAccess}
          memberLabel={memberLabel(accessDialog.member)}
          initialAccess={
            accessDialog.member.permissions ?? [TreeAccess.VIEW]
          }
          onClose={() => {
            if (!savingAccess) setAccessDialog(null);
          }}
          onSubmit={(access) =>
            handleSaveAccess(accessDialog.member.user_id, access)
          }
        />
      ) : null}
    </Page>
  );
}
