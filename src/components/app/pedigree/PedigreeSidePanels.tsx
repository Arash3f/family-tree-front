"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { Marriage, Person } from "@/lib/auth/types";
import type { DescendantStats } from "@/lib/pedigree/descendants";
import { personDisplayName } from "@/lib/pedigree/layout";
import { MarriageFormPanel, type MarriageFormState } from "./MarriageFormPanel";
import { PersonDetailPanel } from "./PersonDetailPanel";
import { PersonFormPanel } from "./PersonFormPanel";
import { RelatePanel } from "./RelatePanel";
import type {
  PanelMode,
  ParentRole,
  PersonFormState,
} from "./person-form";

type Props = {
  panel: PanelMode;
  selectedPerson: Person | null;
  personForm: PersonFormState;
  setPersonForm: Dispatch<SetStateAction<PersonFormState>>;
  marriageForm: MarriageFormState;
  setMarriageForm: Dispatch<SetStateAction<MarriageFormState>>;
  busy: boolean;
  parentFormOptions: Person[];
  personOptions: Person[];
  personSearchHint: (person: Person) => string | null;
  marriageOptions: { id: string; label: string }[];
  marriages: Marriage[];
  editingMarriages: Marriage[];
  nameOf: (personId: string) => string;
  parentOfName: string | null;
  existingPhotoUrl: string | null;
  divorceDate: string;
  onDivorceDateChange: (value: string) => void;
  canReadMarriages: boolean;
  canUpdateMarriage: boolean;
  canDeleteMarriage: boolean;
  canDivorce: boolean;
  canUpload: boolean;
  onSubmitPerson: () => void;
  onSubmitMarriage: () => void;
  onClosePanel: () => void;
  onUpdateMarriedAt: (marriage: Marriage, marriedAt: string) => void;
  onDivorce: (marriage: Marriage) => void;
  onDeleteMarriage: (marriage: Marriage) => void;
  selectedPersonPhoto: string | null;
  selectedPersonAge: number | null;
  asOfYear: number | null;
  selectedMarriages: Marriage[];
  descendantStats: DescendantStats | null;
  hasFather: boolean;
  hasMother: boolean;
  branchActive: boolean;
  branchRootName: string | null;
  relationResult: ReactNode;
  canReadPersons: boolean;
  canViewBirthDate: boolean;
  canViewMarriageDate: boolean;
  canViewPhoto: boolean;
  canUpdatePerson: boolean;
  canDeletePerson: boolean;
  canCreatePerson: boolean;
  canCreateMarriage: boolean;
  onCloseDetail: () => void;
  onSelectPerson: (personId: string) => void;
  onEditPerson: () => void;
  onAddMarriage: () => void;
  onAddChild: () => void;
  onAddParent: (role: ParentRole) => void;
  onFindRelation: () => void;
  onToggleBranch: () => void;
  onDownloadLineage: () => void;
  onDeletePerson: () => void;
  relateToId: string;
  relateToName: string | null;
  searchRelatePeople: (query: string) => Person[];
  onPickRelate: (personId: string) => void;
  onClearRelatePick: () => void;
  onSubmitRelate: () => void;
  onCancelRelate: () => void;
};

export function PedigreeSidePanels({
  panel,
  selectedPerson,
  personForm,
  setPersonForm,
  marriageForm,
  setMarriageForm,
  busy,
  parentFormOptions,
  personOptions,
  personSearchHint,
  marriageOptions,
  marriages,
  editingMarriages,
  nameOf,
  parentOfName,
  existingPhotoUrl,
  divorceDate,
  onDivorceDateChange,
  canReadMarriages,
  canUpdateMarriage,
  canDeleteMarriage,
  canDivorce,
  canUpload,
  onSubmitPerson,
  onSubmitMarriage,
  onClosePanel,
  onUpdateMarriedAt,
  onDivorce,
  onDeleteMarriage,
  selectedPersonPhoto,
  selectedPersonAge,
  asOfYear,
  selectedMarriages,
  descendantStats,
  hasFather,
  hasMother,
  branchActive,
  branchRootName,
  relationResult,
  canReadPersons,
  canViewBirthDate,
  canViewMarriageDate,
  canViewPhoto,
  canUpdatePerson,
  canDeletePerson,
  canCreatePerson,
  canCreateMarriage,
  onCloseDetail,
  onSelectPerson,
  onEditPerson,
  onAddMarriage,
  onAddChild,
  onAddParent,
  onFindRelation,
  onToggleBranch,
  onDownloadLineage,
  onDeletePerson,
  relateToId,
  relateToName,
  searchRelatePeople,
  onPickRelate,
  onClearRelatePick,
  onSubmitRelate,
  onCancelRelate,
}: Props) {
  return (
    <>
      {panel.kind === "create-person" || panel.kind === "edit-person" ? (
        <PersonFormPanel
          mode={
            panel.kind === "create-person"
              ? { kind: "create", linkAsParentOf: panel.linkAsParentOf }
              : { kind: "edit", personId: panel.personId }
          }
          form={personForm}
          setForm={setPersonForm}
          busy={busy}
          parentOptions={parentFormOptions}
          parentOptionHint={personSearchHint}
          marriageOptions={marriageOptions}
          marriages={marriages}
          editingMarriages={editingMarriages}
          nameOf={nameOf}
          parentOfName={parentOfName}
          existingPhotoUrl={existingPhotoUrl}
          divorceDate={divorceDate}
          onDivorceDateChange={onDivorceDateChange}
          canReadMarriages={canReadMarriages}
          canUpdateMarriage={canUpdateMarriage}
          canDeleteMarriage={canDeleteMarriage}
          canDivorce={canDivorce}
          canUpload={canUpload}
          onSubmit={onSubmitPerson}
          onClose={onClosePanel}
          onUpdateMarriedAt={onUpdateMarriedAt}
          onDivorce={onDivorce}
          onDeleteMarriage={onDeleteMarriage}
        />
      ) : null}

      {panel.kind === "create-marriage" ? (
        <MarriageFormPanel
          form={marriageForm}
          setForm={setMarriageForm}
          personOptions={personOptions}
          busy={busy}
          onSubmit={onSubmitMarriage}
          onClose={onClosePanel}
        />
      ) : null}

      {panel.kind === "none" && selectedPerson ? (
        <PersonDetailPanel
          person={selectedPerson}
          photoUrl={selectedPersonPhoto}
          age={selectedPersonAge}
          asOfYear={asOfYear}
          marriages={selectedMarriages}
          descendantStats={descendantStats}
          hasFather={hasFather}
          hasMother={hasMother}
          branchActive={branchActive}
          branchRootName={branchRootName}
          relationResult={relationResult}
          busy={busy}
          canReadPersons={canReadPersons}
          canReadMarriages={canReadMarriages}
          canViewBirthDate={canViewBirthDate}
          canViewMarriageDate={canViewMarriageDate}
          canViewPhoto={canViewPhoto}
          canUpdatePerson={canUpdatePerson}
          canDeletePerson={canDeletePerson}
          canCreatePerson={canCreatePerson}
          canCreateMarriage={canCreateMarriage}
          canDeleteMarriage={canDeleteMarriage}
          nameOf={nameOf}
          onClose={onCloseDetail}
          onSelectPerson={onSelectPerson}
          onEdit={onEditPerson}
          onAddMarriage={onAddMarriage}
          onAddChild={onAddChild}
          onAddParent={onAddParent}
          onFindRelation={onFindRelation}
          onToggleBranch={onToggleBranch}
          onDownloadLineage={onDownloadLineage}
          onDelete={onDeletePerson}
        />
      ) : null}

      {panel.kind === "relate" && selectedPerson ? (
        <RelatePanel
          fromName={personDisplayName(selectedPerson)}
          pickedId={relateToId}
          pickedName={relateToName}
          searchPeople={searchRelatePeople}
          hint={personSearchHint}
          busy={busy}
          onPick={onPickRelate}
          onClearPick={onClearRelatePick}
          onSubmit={onSubmitRelate}
          onCancel={onCancelRelate}
          onClose={onClosePanel}
          relationResult={relationResult}
        />
      ) : null}
    </>
  );
}
