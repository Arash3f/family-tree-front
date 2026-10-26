"use client";

import { useLocale } from "next-intl";
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import {
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineXMark,
} from "react-icons/hi2";
import { DocumentPortal } from "@/components/ui/DocumentPortal";
import { useFocusTrap, useScrollLock } from "@/components/ui/useFocusTrap";
import styles from "./ShotLightbox.module.css";
import { ShotImage, type Shot } from "./ShotImage";

export type ShotLightboxLabels = {
  dialog: string;
  close: string;
  previous: string;
  next: string;
  zoomIn: string;
  zoomOut: string;
};

type Props = {
  shots: Shot[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  labels: ShotLightboxLabels;
};

/** How much a click on the fitted image enlarges it. */
const ZOOM_FACTOR = 2;

/** Where a zoom-in click landed, to keep that point under the pointer. */
type ZoomAnchor = { fx: number; fy: number; x: number; y: number };

/**
 * A product shot full screen, always from its 2x file. Escape, the close
 * button or a click beside the image closes it; the arrow buttons and keys
 * step through the shots (mirrored in RTL); a click on the image toggles a
 * zoom that keeps the clicked point under the pointer and scrolls.
 */
export function ShotLightbox({ shots, index, onIndexChange, onClose, labels }: Props) {
  const locale = useLocale();
  const rtl = locale === "fa";
  const dialogRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<{ width: number; anchor: ZoomAnchor } | null>(null);
  const shot = shots[index]!;
  const many = shots.length > 1;

  useFocusTrap(dialogRef, true, onClose);
  useScrollLock(true);

  const go = (step: number) => {
    setZoom(null);
    onIndexChange((index + step + shots.length) % shots.length);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!many || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    // "Next" sits on the reading direction's far side.
    go((event.key === "ArrowRight") !== rtl ? 1 : -1);
  };

  const toggleZoom = (event: MouseEvent<HTMLButtonElement>) => {
    if (zoom) {
      setZoom(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const stage = stageRef.current!.getBoundingClientRect();
    // A keyboard press reports (0, 0): zoom on the centre instead.
    const keyboard = event.detail === 0;
    setZoom({
      width: rect.width * ZOOM_FACTOR,
      anchor: {
        fx: keyboard ? 0.5 : (event.clientX - rect.left) / rect.width,
        fy: keyboard ? 0.5 : (event.clientY - rect.top) / rect.height,
        x: keyboard ? stage.width / 2 : event.clientX - stage.left,
        y: keyboard ? stage.height / 2 : event.clientY - stage.top,
      },
    });
  };

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!zoom || !stage) return;
    const { fx, fy, x, y } = zoom.anchor;
    const target = stage.firstElementChild as HTMLElement;
    stage.scrollLeft = target.offsetLeft + fx * target.offsetWidth - x;
    stage.scrollTop = target.offsetTop + fy * target.offsetHeight - y;
  }, [zoom]);

  const counter = new Intl.NumberFormat(locale);
  const PreviousIcon = rtl ? HiOutlineChevronRight : HiOutlineChevronLeft;
  const NextIcon = rtl ? HiOutlineChevronLeft : HiOutlineChevronRight;

  return (
    <DocumentPortal>
      <div
        ref={dialogRef}
        className={styles.root}
        role="dialog"
        aria-modal="true"
        aria-label={`${labels.dialog}: ${shot.title}`}
        onKeyDown={onKeyDown}
      >
        {/* LTR so scroll offsets keep one meaning while zoomed. */}
        <div
          ref={stageRef}
          className={`${styles.stage} ${zoom ? styles.zoomed : ""}`}
          dir="ltr"
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <button
            type="button"
            className={styles.zoomButton}
            style={zoom ? { width: zoom.width } : undefined}
            onClick={toggleZoom}
            aria-label={zoom ? labels.zoomOut : labels.zoomIn}
            data-autofocus
          >
            <ShotImage key={shot.id} shot={shot} className={styles.image} full />
          </button>
        </div>

        <button
          type="button"
          className={`${styles.control} ${styles.close}`}
          onClick={onClose}
          aria-label={labels.close}
        >
          <HiOutlineXMark />
        </button>

        {many && (
          <>
            <button
              type="button"
              className={`${styles.control} ${styles.previous}`}
              onClick={() => go(-1)}
              aria-label={labels.previous}
            >
              <PreviousIcon />
            </button>
            <button
              type="button"
              className={`${styles.control} ${styles.next}`}
              onClick={() => go(1)}
              aria-label={labels.next}
            >
              <NextIcon />
            </button>
          </>
        )}

        <p className={styles.caption} aria-live="polite">
          <span className={styles.captionTitle}>{shot.title}</span>
          {many && (
            <span className={styles.counter}>
              {counter.format(index + 1)} / {counter.format(shots.length)}
            </span>
          )}
        </p>
      </div>
    </DocumentPortal>
  );
}
