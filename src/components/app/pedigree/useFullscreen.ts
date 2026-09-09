"use client";

import { useCallback, useEffect, useState } from "react";

export type FullscreenControl = {
  active: boolean;
  toggle: () => void;
};

/**
 * Give the whole screen to the workspace.
 *
 * Two things have to happen, and they are deliberately kept apart: the browser
 * hides its own chrome, and the layout is told to leave the dashboard frame.
 * Only the second one is ours, so the flag stays on where the Fullscreen API is
 * missing (iOS Safari) or the request is refused — the canvas still grows to the
 * viewport, it just keeps the browser bars.
 *
 * The request targets the document rather than the workspace element so that
 * toasts and confirm dialogs, which render outside it, remain visible.
 */
export function useFullscreen(): FullscreenControl {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setActive(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  /**
   * The dashboard frame keeps a stacking context of its own, so no z-index on
   * the workspace can lift it over the topbar. Mark the document instead and
   * let the frame step aside — see `body[data-immersive]` in AppShell.module.css.
   */
  useEffect(() => {
    if (!active) return;
    document.body.dataset.immersive = "true";
    return () => {
      delete document.body.dataset.immersive;
    };
  }, [active]);

  // Escape leaves native fullscreen by itself, which the listener above picks
  // up. This covers the case where the request never went through.
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.fullscreenElement) return;
      setActive(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active]);

  const toggle = useCallback(() => {
    if (active) {
      setActive(false);
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
      }
      return;
    }
    setActive(true);
    const request = document.documentElement.requestFullscreen?.();
    if (request) void request.catch(() => {});
  }, [active]);

  return { active, toggle };
}
