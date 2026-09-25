"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import {
  chromePlanAfterOverflow,
  chromePlanEquals,
  chromePlanFromWidth,
  type ChromePlan,
} from "./chrome-density";

const INITIAL_PLAN: ChromePlan = { layout: "centered", tools: "icons" };

/** Sum of flex children + gaps. Works with overflow:visible (unlike scrollWidth). */
function flexContentWidth(el: HTMLElement): number {
  const kids = el.children;
  if (kids.length === 0) return 0;
  const gap = parseFloat(getComputedStyle(el).gap) || 0;
  let sum = 0;
  for (let i = 0; i < kids.length; i++) {
    sum += (kids[i] as HTMLElement).getBoundingClientRect().width;
  }
  return sum + gap * Math.max(0, kids.length - 1);
}

function rectsCollide(a: DOMRect, b: DOMRect, pad = 2): boolean {
  return !(
    a.right + pad <= b.left ||
    a.left - pad >= b.right ||
    a.bottom + pad <= b.top ||
    a.top - pad >= b.bottom
  );
}

function actionsOverflow(
  actions: HTMLElement | null,
  search: HTMLElement | null,
): boolean {
  if (!actions) return false;
  if (flexContentWidth(actions) > actions.clientWidth + 1) return true;
  if (!search) return false;
  // Spill past the cell can paint over search even when the cell box itself
  // does not intersect — walk children against the search rect.
  const searchBox = search.getBoundingClientRect();
  for (const child of actions.children) {
    if (rectsCollide((child as HTMLElement).getBoundingClientRect(), searchBox)) {
      return true;
    }
  }
  return false;
}

/**
 * Observe the pedigree chrome width and, if the actions cell overflows or
 * paints over search, fold tools into the overflow menu.
 */
export function useChromePlan(
  chromeRef: RefObject<HTMLElement | null>,
  actionsRef: RefObject<HTMLElement | null>,
  searchRef: RefObject<HTMLElement | null>,
): ChromePlan {
  const [plan, setPlan] = useState<ChromePlan>(INITIAL_PLAN);
  /** Last measured inline-tools strip width — keeps menu from oscillating. */
  const stripWidthRef = useRef(0);

  useLayoutEffect(() => {
    const chrome = chromeRef.current;
    if (!chrome || typeof ResizeObserver === "undefined") return;

    const applyFromWidth = () => {
      const width = chrome.getBoundingClientRect().width;
      const fromWidth = chromePlanFromWidth(width);
      setPlan((prev) => {
        let next = fromWidth;
        // Stay folded until the actions cell can hold the last strip width.
        if (prev.tools === "menu" && next.tools !== "menu") {
          const cell = actionsRef.current?.clientWidth ?? 0;
          if (stripWidthRef.current > cell + 1) {
            next = { layout: next.layout, tools: "menu" };
          }
        }
        return chromePlanEquals(prev, next) ? prev : next;
      });
    };

    applyFromWidth();

    const observer = new ResizeObserver(() => {
      applyFromWidth();
    });
    observer.observe(chrome);
    const actions = actionsRef.current;
    if (actions) observer.observe(actions);
    return () => observer.disconnect();
  }, [chromeRef, actionsRef]);

  // After React commits the chosen tool set, fold again if it still won't fit.
  useLayoutEffect(() => {
    if (plan.tools === "menu") return;
    const actions = actionsRef.current;
    const search = searchRef.current;
    if (actions) {
      stripWidthRef.current = flexContentWidth(actions);
    }
    if (!actionsOverflow(actions, search)) return;
    setPlan((prev) => {
      const next = chromePlanAfterOverflow(prev, true);
      return chromePlanEquals(prev, next) ? prev : next;
    });
  }, [plan, actionsRef, searchRef]);

  return plan;
}
