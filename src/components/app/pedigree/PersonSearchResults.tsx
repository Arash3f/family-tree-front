"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { personDisplayName } from "@/lib/pedigree/layout";
import type { Person } from "@/lib/auth/types";
import styles from "./PedigreeView.module.css";

const emptySubscribe = () => () => {};

type Props = {
  people: Person[];
  /** Parent names shown under the match, or null when both are unknown. */
  hint: (person: Person) => string | null;
  onPick: (person: Person) => void;
};

type Placement = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

/**
 * Visible layout box. On mobile the soft keyboard shrinks
 * `visualViewport` without changing `innerHeight`, so dropdowns that only
 * look at the layout viewport end up under the keyboard.
 */
function visibleBox() {
  const vv = window.visualViewport;
  if (vv) {
    return {
      top: vv.offsetTop,
      left: vv.offsetLeft,
      width: vv.width,
      height: vv.height,
      bottom: vv.offsetTop + vv.height,
    };
  }
  return {
    top: 0,
    left: 0,
    width: window.innerWidth,
    height: window.innerHeight,
    bottom: window.innerHeight,
  };
}

function measurePlacement(anchor: HTMLElement): Placement | null {
  const field =
    anchor.querySelector<HTMLElement>("input, textarea, [role='combobox']") ??
    anchor;
  const rect = field.getBoundingClientRect();
  if (rect.width < 2 && rect.height < 2) return null;

  const view = visibleBox();
  const gap = 6;
  const edge = 8;
  const spaceBelow = view.bottom - rect.bottom - gap;
  const spaceAbove = rect.top - view.top - gap;
  // Prefer below the field; flip when the keyboard (or sheet edge) leaves
  // too little room and there is more air above.
  const above = spaceBelow < 9.5 * 16 && spaceAbove > spaceBelow;
  const maxHeight = Math.max(
    7.5 * 16,
    Math.min(18 * 16, above ? spaceAbove : spaceBelow),
  );
  const width = Math.min(rect.width, view.width - edge * 2);
  const left = Math.min(
    Math.max(view.left + edge, rect.left),
    view.left + view.width - edge - width,
  );
  const top = above
    ? Math.max(view.top + edge, rect.top - gap - maxHeight)
    : rect.bottom + gap;

  return { top, left, width, maxHeight };
}

export function PersonSearchResults({ people, hint, onPick }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  useLayoutEffect(() => {
    if (people.length === 0) return;

    const host = hostRef.current;
    const anchor = host?.parentElement;
    if (!anchor) return;

    const sync = () => {
      setPlacement(measurePlacement(anchor));
    };

    sync();
    // iOS often finishes the keyboard resize a beat after focus.
    const retry = window.setTimeout(sync, 160);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    return () => {
      window.clearTimeout(retry);
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
    };
  }, [people]);

  if (people.length === 0) {
    return <div ref={hostRef} className={styles.searchResultsHost} hidden />;
  }

  const listStyle: CSSProperties | undefined = placement
    ? {
        top: placement.top,
        left: placement.left,
        width: placement.width,
        maxHeight: placement.maxHeight,
      }
    : undefined;

  const list = (
    <ul
      className={styles.searchResults}
      style={listStyle}
      role="listbox"
    >
      {people.map((person) => {
        const parentHint = hint(person);
        return (
          <li key={person.id} role="option" aria-selected={false}>
            <button type="button" onClick={() => onPick(person)}>
              <span className={styles.searchResultName}>
                {personDisplayName(person)}
              </span>
              {parentHint ? (
                <span className={styles.searchResultMeta}>{parentHint}</span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      <div ref={hostRef} className={styles.searchResultsHost} hidden />
      {mounted && placement ? createPortal(list, document.body) : null}
    </>
  );
}
