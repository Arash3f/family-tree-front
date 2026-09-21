"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = { children: ReactNode };

/**
 * Mount fixed overlays on `document.body` so a transformed ancestor (page
 * entrance, immersive pedigree workspace) cannot trap `position: fixed`.
 */
export function DocumentPortal({ children }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
