"use client";

import type { RefObject } from "react";
import type { Marriage, Person } from "@/lib/auth/types";
import type { TreeExcelPreviewResult } from "@/lib/auth/client";
import { TicketCreateDialog } from "@/components/app/TicketCreateDialog";
import { DocumentPortal } from "@/components/ui/DocumentPortal";
import { ExcelPreviewDialog } from "./ExcelPreviewDialog";
import { ExportDialogHost } from "./ExportDialogHost";
import { MaleLineExportDialog } from "./MaleLineExportDialog";
import type { ExportFlow } from "./useExportFlow";
import type { PersonLineagePosterHandle } from "./PersonLineagePoster";

type ExcelOverlay = {
  preview: TreeExcelPreviewResult;
  fileName: string;
  selectedPersonRefs: Set<string>;
  selectedMarriageRefs: Set<string>;
  selectedPersonCount: number;
  selectedMarriageCount: number;
  canConfirm: boolean;
  busy: boolean;
  onTogglePerson: (ref: string, checked: boolean) => void;
  onToggleMarriage: (ref: string, checked: boolean) => void;
  onSelectNew: () => void;
  onClearSelection: () => void;
  onConfirm: () => void;
  onClose: () => void;
};

type ExportOverlay = {
  flow: Omit<ExportFlow, "posterRef">;
  posterRef: RefObject<PersonLineagePosterHandle | null>;
  persons: Person[];
  marriages: Marriage[];
  treeName: string;
};

type TicketOverlay = {
  treeId: string;
  open: boolean;
  onClose: () => void;
};

type MaleLineOverlay = {
  person: Person;
  persons: Person[];
  treeName: string;
  onClose: () => void;
};

type Props = {
  excel: ExcelOverlay | null;
  exportHost: ExportOverlay | null;
  ticket: TicketOverlay;
  maleLine: MaleLineOverlay | null;
};

/**
 * Heavy dialogs kept out of the main pedigree render tree so the canvas
 * shell can paint first.
 */
export function PedigreeOverlays({ excel, exportHost, ticket, maleLine }: Props) {
  return (
    <DocumentPortal>
      {excel ? (
        <ExcelPreviewDialog
          preview={excel.preview}
          fileName={excel.fileName}
          selectedPersonRefs={excel.selectedPersonRefs}
          selectedMarriageRefs={excel.selectedMarriageRefs}
          selectedPersonCount={excel.selectedPersonCount}
          selectedMarriageCount={excel.selectedMarriageCount}
          canConfirm={excel.canConfirm}
          busy={excel.busy}
          onTogglePerson={excel.onTogglePerson}
          onToggleMarriage={excel.onToggleMarriage}
          onSelectNew={excel.onSelectNew}
          onClearSelection={excel.onClearSelection}
          onConfirm={excel.onConfirm}
          onClose={excel.onClose}
        />
      ) : null}

      {exportHost ? (
        <ExportDialogHost
          flow={exportHost.flow}
          posterRef={exportHost.posterRef}
          persons={exportHost.persons}
          marriages={exportHost.marriages}
          treeName={exportHost.treeName}
        />
      ) : null}

      <TicketCreateDialog
        treeId={ticket.treeId}
        open={ticket.open}
        onClose={ticket.onClose}
      />

      {maleLine ? (
        <MaleLineExportDialog
          person={maleLine.person}
          persons={maleLine.persons}
          treeName={maleLine.treeName}
          onClose={maleLine.onClose}
        />
      ) : null}
    </DocumentPortal>
  );
}
