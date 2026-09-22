"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = { children: ReactNode };

const emptySubscribe = () => () => {};

/**
 * Mount fixed overlays on `document.body` so a transformed ancestor (page
 * entrance, immersive pedigree workspace) cannot trap `position: fixed`.
 */
export function DocumentPortal({ children }: Props) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
