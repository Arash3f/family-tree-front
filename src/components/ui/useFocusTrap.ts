"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

/**
 * Keep keyboard focus inside `container` while `active`, restoring it on exit.
 *
 * Three dialogs in this app each grew their own version of this: the landing
 * menu had a full trap, the confirm dialog handled only Escape, and the export
 * dialog handled neither, so Tab walked into the page behind it.
 *
 * `onEscape` is optional because some surfaces are not dismissible.
 */
export function useFocusTrap(
  container: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape?: () => void,
) {
  useEffect(() => {
    if (!active) return;
    const node = container.current;
    if (!node) return;

    const previous = document.activeElement as HTMLElement | null;

    // `offsetParent` filters out anything hidden by an ancestor, which a plain
    // selector match would happily return.
    const items = () =>
      [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      );

    const initial = node.querySelector<HTMLElement>("[data-autofocus]") ?? items()[0];
    initial?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && onEscape) {
        event.stopPropagation();
        onEscape();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = items();
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const current = document.activeElement;
      // Focus may sit outside after a click on the backdrop; pull it back in.
      if (!node.contains(current)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    node.ownerDocument.addEventListener("keydown", onKeyDown, true);
    return () => {
      node.ownerDocument.removeEventListener("keydown", onKeyDown, true);
      // Only restore if focus is still inside; the caller may have moved it on
      // purpose, for example to the row a dialog just created.
      if (!previous) return;
      if (node.contains(document.activeElement) || document.activeElement === document.body) {
        previous.focus?.();
      }
    };
  }, [container, active, onEscape]);
}

/** Prevent background scrolling while an overlay is open. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const { body } = document;
    const previous = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previous;
    };
  }, [active]);
}
