"use client";

import { createContext, useContext } from "react";

const PedigreeSelectContext = createContext<(personId: string | null) => void>(
  () => {},
);

export const PedigreeSelectProvider = PedigreeSelectContext.Provider;

export function usePedigreeSelect() {
  return useContext(PedigreeSelectContext);
}

const PedigreeAsOfYearContext = createContext<number | null>(null);

export const PedigreeAsOfYearProvider = PedigreeAsOfYearContext.Provider;

export function usePedigreeAsOfYear() {
  return useContext(PedigreeAsOfYearContext);
}

/** Folding a branch away from the canvas, reached from a person card. */
export type PedigreeBranchActions = {
  toggleCollapse: (personId: string) => void;
  hideBranch: (personId: string) => void;
};

const PedigreeBranchContext = createContext<PedigreeBranchActions>({
  toggleCollapse: () => {},
  hideBranch: () => {},
});

export const PedigreeBranchProvider = PedigreeBranchContext.Provider;

export function usePedigreeBranchActions() {
  return useContext(PedigreeBranchContext);
}

/** Per-tree grants for the fields the backend redacts when they are missing. */
export type PedigreeDataAccess = {
  canViewBirthDate: boolean;
  canViewMarriageDate: boolean;
  canViewPhoto: boolean;
};

const PedigreeDataAccessContext = createContext<PedigreeDataAccess>({
  canViewBirthDate: true,
  canViewMarriageDate: true,
  canViewPhoto: true,
});

export const PedigreeDataAccessProvider = PedigreeDataAccessContext.Provider;

export function usePedigreeDataAccess() {
  return useContext(PedigreeDataAccessContext);
}
