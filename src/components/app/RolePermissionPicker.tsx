"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  HiOutlineKey,
  HiOutlineLockClosed,
  HiOutlineMagnifyingGlass,
  HiOutlineRectangleGroup,
  HiOutlineShieldCheck,
  HiOutlineSquares2X2,
  HiOutlineTicket,
  HiOutlineUsers,
  HiOutlineXMark,
} from "react-icons/hi2";
import {
  isAssignableSystemPermission,
  type AppPermission,
} from "@/lib/auth/types";
import {
  expandSelectedPermissionIds,
  getRequiredCompanions,
  getRequiringPermissions,
  minimizeExplicitPermissionIds,
  setsEqualPermissionIds,
} from "@/lib/auth/permission-bundles";
import { groupPermissionsByModule } from "@/lib/auth/permission-modules";
import { formatLocaleDigits } from "@/lib/localeDigits";
import styles from "./RolesView.module.css";

type Props = {
  permissions: AppPermission[];
  selectedIds: Set<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
  /** Change when the underlying role selection is replaced (e.g. after load). */
  resetKey?: string;
};

const MODULE_ICONS: Record<string, ReactNode> = {
  user: <HiOutlineUsers aria-hidden />,
  role: <HiOutlineShieldCheck aria-hidden />,
  permission: <HiOutlineKey aria-hidden />,
  tree: <HiOutlineRectangleGroup aria-hidden />,
  ticket: <HiOutlineTicket aria-hidden />,
};

/** Fold the Arabic/Persian letter variants and separators users type either way. */
function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\u064a/g, "\u06cc")
    .replace(/\u0643/g, "\u06a9")
    .replace(/\u0629/g, "\u0647")
    .replace(/[\u200b-\u200f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function labelFor(
  name: string,
  tPerm: { has: (key: string) => boolean; (key: string): string },
): string {
  return tPerm.has(name) ? tPerm(name) : name;
}

export function RolePermissionPicker({
  permissions: catalog,
  selectedIds,
  onChange,
  disabled = false,
  resetKey = "default",
}: Props) {
  const t = useTranslations("roles");
  const tPerm = useTranslations("permissions");
  const tModules = useTranslations("permissionModules");
  const locale = useLocale();
  const searchId = useId();
  const permissions = useMemo(
    () => catalog.filter((permission) => isAssignableSystemPermission(permission.name)),
    [catalog],
  );

  const seedExplicitIds = () =>
    permissions.length === 0
      ? new Set<string>()
      : minimizeExplicitPermissionIds(selectedIds, permissions);

  const [explicitIds, setExplicitIds] = useState<Set<string>>(seedExplicitIds);
  const [seededFrom, setSeededFrom] = useState({ permissions, resetKey });
  const [query, setQuery] = useState("");

  // Re-seed explicit roots when role data / permission catalog arrives.
  if (
    seededFrom.permissions !== permissions ||
    seededFrom.resetKey !== resetKey
  ) {
    setSeededFrom({ permissions, resetKey });
    setExplicitIds(seedExplicitIds());
  }

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const permission of permissions) {
      map.set(permission.id, permission.name);
    }
    return map;
  }, [permissions]);

  const effectiveIds = useMemo(
    () => expandSelectedPermissionIds(explicitIds, permissions),
    [explicitIds, permissions],
  );
  const permissionGroups = useMemo(
    () => groupPermissionsByModule(permissions),
    [permissions],
  );

  const moduleTitle = useCallback(
    (moduleName: string) =>
      tModules.has(moduleName) ? tModules(moduleName) : moduleName,
    [tModules],
  );

  const visibleGroups = useMemo(() => {
    const needle = normalizeSearchText(query);
    if (!needle) return permissionGroups;

    return permissionGroups
      .map((group) => {
        if (normalizeSearchText(moduleTitle(group.module)).includes(needle)) {
          return group;
        }
        const matched = group.permissions.filter((permission) =>
          normalizeSearchText(
            `${labelFor(permission.name, tPerm)} ${permission.name}`,
          ).includes(needle),
        );
        return { module: group.module, permissions: matched };
      })
      .filter((group) => group.permissions.length > 0);
  }, [permissionGroups, query, tPerm, moduleTitle]);

  const explicitNames = useMemo(() => {
    const names: string[] = [];
    for (const id of explicitIds) {
      const name = nameById.get(id);
      if (name) names.push(name);
    }
    return names;
  }, [explicitIds, nameById]);

  // Push effective (explicit + prerequisites) up to the parent form state.
  useEffect(() => {
    if (permissions.length === 0) return;
    if (setsEqualPermissionIds(effectiveIds, selectedIds)) return;
    onChange(effectiveIds);
  }, [effectiveIds, selectedIds, permissions, onChange]);

  const togglePermission = (permission: AppPermission) => {
    const nextExplicit = new Set(explicitIds);
    const isEffective = effectiveIds.has(permission.id);

    if (isEffective) {
      const requiredBy = getRequiringPermissions(
        permission.name,
        explicitNames,
      );
      if (requiredBy.length > 0) return;
      nextExplicit.delete(permission.id);
      setExplicitIds(nextExplicit);
      return;
    }

    nextExplicit.add(permission.id);
    setExplicitIds(nextExplicit);
  };

  const setSelection = (targets: AppPermission[], select: boolean) => {
    const nextExplicit = new Set(explicitIds);
    for (const permission of targets) {
      if (select) nextExplicit.add(permission.id);
      else nextExplicit.delete(permission.id);
    }
    setExplicitIds(nextExplicit);
  };

  const visiblePermissions = visibleGroups.flatMap((group) => group.permissions);
  const allVisibleSelected =
    visiblePermissions.length > 0 &&
    visiblePermissions.every((permission) => effectiveIds.has(permission.id));
  // Counted over the catalog, since `effectiveIds` also carries ids the role
  // holds that this picker does not list.
  const selectedCount = permissions.filter((permission) =>
    effectiveIds.has(permission.id),
  ).length;
  const num = (value: number) => formatLocaleDigits(value, locale);

  return (
    <div className={styles.permGroup}>
      <div className={styles.permHead}>
        <div>
          <p className={styles.permLabel}>{t("permissions")}</p>
          <p className={styles.bundleNote}>{t("bundleNote")}</p>
        </div>
        <span className={styles.permCounter}>
          {t("permissionSelected", {
            count: num(selectedCount),
            total: num(permissions.length),
          })}
        </span>
      </div>

      <div className={styles.permToolbar}>
        <div className={styles.searchField}>
          <label className={styles.srOnly} htmlFor={searchId}>
            {t("permissionSearchLabel")}
          </label>
          <HiOutlineMagnifyingGlass className={styles.searchIcon} aria-hidden />
          <input
            id={searchId}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("permissionSearchPlaceholder")}
            autoComplete="off"
          />
          {query ? (
            <button
              type="button"
              className={styles.searchClear}
              aria-label={t("permissionSearchClear")}
              onClick={() => setQuery("")}
            >
              <HiOutlineXMark aria-hidden />
            </button>
          ) : null}
        </div>

        <div className={styles.permBulk}>
          <button
            type="button"
            className={styles.textAction}
            disabled={disabled || allVisibleSelected}
            onClick={() => setSelection(visiblePermissions, true)}
          >
            {t("permissionSelectAll")}
          </button>
          <button
            type="button"
            className={styles.textAction}
            disabled={disabled || explicitIds.size === 0}
            onClick={() => setExplicitIds(new Set())}
          >
            {t("permissionClearAll")}
          </button>
        </div>
      </div>

      {visibleGroups.length === 0 ? (
        <p className={styles.empty}>
          {t("permissionSearchEmpty", { query: query.trim() })}
        </p>
      ) : (
        <div className={styles.permModules}>
          {visibleGroups.map((group) => {
            const groupSelected = group.permissions.filter((permission) =>
              effectiveIds.has(permission.id),
            ).length;
            const allSelected = groupSelected === group.permissions.length;

            return (
              <section key={group.module} className={styles.permModule}>
                <header className={styles.permModuleHead}>
                  <span className={styles.permModuleIcon}>
                    {MODULE_ICONS[group.module] ?? <HiOutlineSquares2X2 aria-hidden />}
                  </span>
                  <h3 className={styles.permModuleTitle}>
                    {moduleTitle(group.module)}
                  </h3>
                  <span className={styles.permModuleCount}>
                    {t("permissionGroupCount", {
                      count: num(groupSelected),
                      total: num(group.permissions.length),
                    })}
                  </span>
                  <button
                    type="button"
                    className={styles.textAction}
                    disabled={disabled}
                    onClick={() => setSelection(group.permissions, !allSelected)}
                  >
                    {allSelected
                      ? t("permissionClearGroup")
                      : t("permissionSelectGroup")}
                  </button>
                </header>

                <ul className={styles.permList}>
                  {group.permissions.map((permission) => {
                    const checked = effectiveIds.has(permission.id);
                    const requiredBy = getRequiringPermissions(
                      permission.name,
                      explicitNames,
                    );
                    const locked = requiredBy.length > 0;
                    const requires = getRequiredCompanions(permission.name);

                    return (
                      <li key={permission.id}>
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
                            onChange={() => togglePermission(permission)}
                            disabled={disabled || locked}
                          />
                          <span className={styles.permText}>
                            <span className={styles.permName}>
                              {labelFor(permission.name, tPerm)}
                              {locked ? (
                                <HiOutlineLockClosed
                                  className={styles.permLock}
                                  aria-hidden
                                />
                              ) : null}
                            </span>
                            {requires.length > 0 ? (
                              <span className={styles.permHint}>
                                {t("bundleRequires", {
                                  names: requires
                                    .map((name) => labelFor(name, tPerm))
                                    .join(t("bundleNameSeparator")),
                                })}
                              </span>
                            ) : null}
                            {locked ? (
                              <span className={styles.permHint}>
                                {t("bundleRequiredBy", {
                                  names: requiredBy
                                    .map((name) => labelFor(name, tPerm))
                                    .join(t("bundleNameSeparator")),
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
      )}
    </div>
  );
}
