"use client";

import { useMemo } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Permissions } from "@/lib/auth/types";
import { TreeAccess } from "@/lib/auth/tree-access";

export type PedigreePermissions = {
  canReadPersons: boolean;
  canCreatePerson: boolean;
  canUpdatePerson: boolean;
  canDeletePerson: boolean;
  canViewBirthDate: boolean;
  canViewMarriageDate: boolean;
  canViewPhoto: boolean;
  canReadMarriages: boolean;
  canCreateMarriage: boolean;
  canDeleteMarriage: boolean;
  canUpdateMarriage: boolean;
  canDivorce: boolean;
  canUpload: boolean;
  canExportExcel: boolean;
  canImportExcel: boolean;
  canDownloadSample: boolean;
  canCreateTicket: boolean;
};

/**
 * Genealogy actions are gated purely by per-tree access now — the matching
 * system RBAC no longer exists. System TREE_READ still guards entering a tree
 * (handled in useTreeData); tickets remain a system capability.
 */
export function usePedigreePermissions(
  hasTreeAccess: (permission: string) => boolean,
): PedigreePermissions {
  const { hasPermission } = useAuth();

  return useMemo(() => {
    const canReadPersons = hasTreeAccess(TreeAccess.VIEW);
    const canViewBirthDate = hasTreeAccess(TreeAccess.VIEW_BIRTH_DATE);
    const canViewMarriageDate = hasTreeAccess(TreeAccess.VIEW_MARRIAGE_DATE);
    const canCreatePerson = hasTreeAccess(TreeAccess.PERSON_CREATE);

    return {
      canReadPersons,
      canCreatePerson,
      canViewBirthDate,
      canViewMarriageDate,
      canViewPhoto: hasTreeAccess(TreeAccess.VIEW_PHOTO),
      canUpdatePerson: hasTreeAccess(TreeAccess.PERSON_UPDATE),
      canDeletePerson: hasTreeAccess(TreeAccess.PERSON_DELETE),
      canReadMarriages: hasTreeAccess(TreeAccess.VIEW),
      canCreateMarriage: hasTreeAccess(TreeAccess.MARRIAGE_CREATE),
      canDeleteMarriage: hasTreeAccess(TreeAccess.MARRIAGE_DELETE),
      canUpdateMarriage: hasTreeAccess(TreeAccess.MARRIAGE_UPDATE),
      canDivorce: hasTreeAccess(TreeAccess.MARRIAGE_DIVORCE),
      canUpload: hasTreeAccess(TreeAccess.UPLOAD_PHOTO),
      canExportExcel:
        canReadPersons && canViewBirthDate && canViewMarriageDate,
      canImportExcel:
        hasTreeAccess(TreeAccess.PERSON_CREATE) &&
        hasTreeAccess(TreeAccess.MARRIAGE_CREATE),
      canDownloadSample: canReadPersons,
      canCreateTicket: hasPermission(Permissions.TICKET_CREATE),
    };
  }, [hasPermission, hasTreeAccess]);
}
