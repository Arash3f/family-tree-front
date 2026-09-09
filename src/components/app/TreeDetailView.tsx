"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import { TreeMemberAccessPicker } from "@/components/app/TreeMemberAccessPicker";
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
  groupTreeAccess,
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

const USER_NOT_FOUND_CODE = 1400;

export function TreeDetailView({ treeId }: Props) {
  const t = useTranslations("trees");
  const { showError, showSuccess, confirm } = useFeedback();
  const { status, user: me, hasPermission } = useAuth();
  const router = useRouter();
  const [tree, setTree] = useState<FamilyTree | null>(null);
  const [members, setMembers] = useState<TreeMembership[]>([]);
  const [name, setName] = useState("");
  const [memberUsername, setMemberUsername] = useState("");
  const [newMemberAccess, setNewMemberAccess] = useState<string[]>([
    TreeAccess.VIEW,
  ]);
  // The picker only reseeds when this changes. A constant key would keep the
  // last member's access after a successful add.
  const [memberFormKey, setMemberFormKey] = useState(0);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editAccess, setEditAccess] = useState<string[]>([TreeAccess.VIEW]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const canUpdate = hasPermission(Permissions.TREE_UPDATE);
  const canDelete = hasPermission(Permissions.TREE_DELETE);
  const myAccess = new Set(tree?.my_permissions ?? []);
  const canAddMember = myAccess.has(TreeAccess.MEMBER_ADD);
  const canRemoveMember = myAccess.has(TreeAccess.MEMBER_REMOVE);
  const canSaveName = canUpdate && name.trim().length > 0;

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
        const [treeData, memberList] = await Promise.all([
          getFamilyTree(treeId),
          listTreeMembers(treeId),
        ]);
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
  }, [status, hasPermission, router, treeId, t, showError]);

  const onSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!canUpdate || !canSaveName) return;
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

  const handleAddMember = async (event: FormEvent) => {
    event.preventDefault();
    const username = memberUsername.trim();
    if (!username) return;
    setAddingMember(true);
    try {
      const membership = await addTreeMember(
        treeId,
        username,
        normalizeTreeAccess(newMemberAccess),
      );
      setMembers((prev) => [...prev, membership]);
      setMemberUsername("");
      setNewMemberAccess([TreeAccess.VIEW]);
      setMemberFormKey((key) => key + 1);
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

  const startEditAccess = (member: TreeMembership) => {
    setEditingUserId(member.user_id);
    setEditAccess(normalizeTreeAccess(member.permissions ?? [TreeAccess.VIEW]));
  };

  const handleSaveAccess = async (userId: string) => {
    setSavingAccess(true);
    try {
      const updated = await updateTreeMember(
        treeId,
        userId,
        normalizeTreeAccess(editAccess),
      );
      setMembers((prev) =>
        prev.map((member) =>
          member.user_id === userId ? updated : member,
        ),
      );
      setEditingUserId(null);
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
      if (editingUserId === userId) setEditingUserId(null);
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
          <ButtonLink href={`/dashboard/trees/${treeId}`} variant="subtle">
            {t("open")}
          </ButtonLink>
        }
      />

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
            disabled={!canUpdate || busy}
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

          {canUpdate || canDelete ? (
            <FormActions
              secondary={
                canDelete ? (
                  <Button
                    variant="danger"
                    loading={deleting}
                    disabled={busy}
                    onClick={() => void handleDelete()}
                  >
                    {deleting ? t("working") : t("delete")}
                  </Button>
                ) : undefined
              }
            >
              {canUpdate ? (
                <Button
                  type="submit"
                  loading={saving}
                  disabled={!canSaveName || busy}
                >
                  {saving ? t("saving") : t("save")}
                </Button>
              ) : null}
            </FormActions>
          ) : null}
        </Form>
      </Panel>

      <Panel
        delay={2}
        title={t("membersTitle")}
        support={t("membersSupport")}
      >
        {members.length === 0 ? (
          <p className={styles.empty}>{t("membersEmpty")}</p>
        ) : (
          <ul className={styles.memberList}>
            {members.map((member) => {
              const isLastOwner =
                member.role === "owner" && ownerCount <= 1;
              const label =
                member.username ||
                (me && me.id === member.user_id
                  ? me.fullname || me.username
                  : t("memberRole.member"));
              const isEditing = editingUserId === member.user_id;
              const perms = member.permissions ?? [];
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
                        isEditing ? (
                          <>
                            <Button
                              size="sm"
                              loading={savingAccess}
                              disabled={busy}
                              onClick={() =>
                                void handleSaveAccess(member.user_id)
                              }
                            >
                              {savingAccess
                                ? t("working")
                                : t("memberAccessSave")}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => setEditingUserId(null)}
                            >
                              {t("memberAccessCancel")}
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => startEditAccess(member)}
                          >
                            {t("memberAccessEdit")}
                          </Button>
                        )
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

                  {!isEditing ? (
                    <div className={styles.accessBadgeGroups}>
                      {groupTreeAccess(perms).map((group) => (
                        <div
                          key={group.id}
                          className={styles.accessBadgeGroup}
                        >
                          <span className={styles.accessBadgeGroupTitle}>
                            {t(`accessGroups.${group.id}`)}
                          </span>
                          <div className={styles.accessBadges}>
                            {group.items.map((perm) => (
                              <Badge key={perm} tone="neutral">
                                {t(`access.${perm}`)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {isEditing && member.role !== "owner" ? (
                    <div className={styles.memberEditor}>
                      <TreeMemberAccessPicker
                        selected={editAccess}
                        onChange={setEditAccess}
                        disabled={busy}
                        resetKey={`${member.user_id}-${member.permissions?.join(",")}`}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {canAddMember ? (
          <div className={styles.addMemberPanel}>
            <div className={styles.addMemberHeader}>
              <h3 className={styles.addMemberTitle}>{t("addMemberTitle")}</h3>
              <p className={styles.addMemberSupport}>{t("addMemberSupport")}</p>
            </div>
            <Form columns="single" onSubmit={handleAddMember}>
              <TextField
                label={t("memberUser")}
                value={memberUsername}
                onChange={(e) => setMemberUsername(e.target.value)}
                required
                disabled={busy}
                placeholder={t("memberUsernamePlaceholder")}
                autoComplete="off"
                spellCheck={false}
              />
              <TreeMemberAccessPicker
                selected={newMemberAccess}
                onChange={setNewMemberAccess}
                disabled={busy}
                resetKey={`new-member-${memberFormKey}`}
              />
              <FormActions>
                <Button
                  type="submit"
                  loading={addingMember}
                  disabled={busy || !memberUsername.trim()}
                >
                  {addingMember ? t("working") : t("memberAdd")}
                </Button>
              </FormActions>
            </Form>
          </div>
        ) : null}
      </Panel>
    </Page>
  );
}
