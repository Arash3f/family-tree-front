"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  HiOutlineEye,
  HiOutlineHeart,
  HiOutlineLockClosed,
  HiOutlinePhoto,
  HiOutlineTicket,
  HiOutlineUserGroup,
  HiOutlineUsers,
} from "react-icons/hi2";
import {
  TREE_ACCESS_GROUPS,
  expandTreeAccess,
  getTreeAccessRequiring,
  minimizeExplicitTreeAccess,
  treeAccessSetsEqual,
  type TreeAccessPermission,
} from "@/lib/auth/tree-access";
import styles from "./TreesView.module.css";

type Props = {
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  resetKey?: string;
};

const GROUP_ICONS: Record<string, React.ReactNode> = {
  person: <HiOutlineUsers aria-hidden />,
  marriage: <HiOutlineHeart aria-hidden />,
  photo: <HiOutlinePhoto aria-hidden />,
  members: <HiOutlineUserGroup aria-hidden />,
  tickets: <HiOutlineTicket aria-hidden />,
  views: <HiOutlineEye aria-hidden />,
};

export function TreeMemberAccessPicker({
  selected,
  onChange,
  disabled = false,
  resetKey = "default",
}: Props) {
  const t = useTranslations("trees");
  const [explicit, setExplicit] = useState<Set<string>>(() =>
    minimizeExplicitTreeAccess(selected),
  );
  const [seededKey, setSeededKey] = useState(resetKey);

  // Re-seed explicit roots on reset only, never on the parent's echo of onChange.
  if (seededKey !== resetKey) {
    setSeededKey(resetKey);
    setExplicit(minimizeExplicitTreeAccess(selected));
  }

  const effective = useMemo(() => expandTreeAccess(explicit), [explicit]);
  const selectedCount = effective.size;

  useEffect(() => {
    const next = [...effective].sort();
    if (treeAccessSetsEqual(next, selected)) return;
    onChange(next);
  }, [effective, selected, onChange]);

  const toggle = (name: TreeAccessPermission) => {
    const nextExplicit = new Set(explicit);
    const isEffective = effective.has(name);

    if (isEffective) {
      const requiredBy = getTreeAccessRequiring(name, explicit);
      if (requiredBy.length > 0) return;
      nextExplicit.delete(name);
      setExplicit(nextExplicit);
      return;
    }

    nextExplicit.add(name);
    setExplicit(nextExplicit);
  };

  return (
    <div className={styles.permGroup}>
      <div className={styles.permHead}>
        <div>
          <p className={styles.permLabel}>{t("accessTitle")}</p>
          <p className={styles.bundleNote}>{t("accessBundleNote")}</p>
        </div>
        <span className={styles.permCounter}>
          {t("accessSelectedCount", { count: selectedCount })}
        </span>
      </div>

      <div className={styles.permModules}>
        {TREE_ACCESS_GROUPS.map((group) => {
          const groupSelected = group.items.filter((name) =>
            effective.has(name),
          ).length;

          return (
            <section key={group.id} className={styles.permModule}>
              <header className={styles.permModuleHead}>
                <span className={styles.permModuleIcon}>
                  {GROUP_ICONS[group.id] ?? <HiOutlineUsers aria-hidden />}
                </span>
                <h3 className={styles.permModuleTitle}>
                  {t(`accessGroups.${group.id}`)}
                </h3>
                <span className={styles.permModuleCount}>
                  {t("accessGroupCount", {
                    count: groupSelected,
                    total: group.items.length,
                  })}
                </span>
              </header>

              <ul className={styles.permList}>
                {group.items.map((name) => {
                  const checked = effective.has(name);
                  const requiredBy = getTreeAccessRequiring(name, explicit);
                  const locked = requiredBy.length > 0;

                  return (
                    <li key={name}>
                      <label
                        className={[
                          styles.permItem,
                          checked ? styles.permItemSelected : null,
                          locked ? styles.permItemLocked : null,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(name)}
                          disabled={disabled || locked}
                        />
                        <span className={styles.permText}>
                          <span className={styles.permName}>
                            {t(`access.${name}`)}
                            {locked ? (
                              <HiOutlineLockClosed
                                className={styles.permLock}
                                aria-hidden
                              />
                            ) : null}
                          </span>
                          {locked ? (
                            <span className={styles.permHint}>
                              {t("accessRequiredBy", {
                                names: requiredBy
                                  .map((item) => t(`access.${item}`))
                                  .join(t("accessNameSeparator")),
                              })}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
