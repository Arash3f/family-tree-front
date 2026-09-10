"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";
import styles from "./OverflowMarquee.module.css";

type Props = {
  children: ReactNode;
  className?: string;
  /** Accessible full text when truncated (defaults to string children). */
  title?: string;
  as?: ElementType;
  /** Force LTR for emails / dial codes inside RTL pages. */
  dir?: "ltr" | "rtl" | "auto";
};

/**
 * When the label is wider than its box, ping-pong scrolls so the full text
 * can be read. Short labels stay still. Honours prefers-reduced-motion.
 */
export function OverflowMarquee({
  children,
  className,
  title,
  as: Tag = "span",
  dir,
}: Props) {
  const outerRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLSpanElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [shiftPx, setShiftPx] = useState(0);
  const [durationSec, setDurationSec] = useState(6);

  const measure = useCallback(() => {
    const outer = outerRef.current;
    const track = trackRef.current;
    if (!outer || !track) return;

    // Track must be unconstrained while measuring; max-width:100% makes
    // scrollWidth collapse to the visible box and the marquee never reaches
    // the end of long emails.
    const prevMax = track.style.maxWidth;
    track.style.maxWidth = "none";
    const full = track.scrollWidth;
    track.style.maxWidth = prevMax;

    const visible = outer.clientWidth;
    const overflow = Math.max(0, full - visible);
    const next = overflow > 2;
    setOverflowing(next);
    // Extra 8px so the last glyph clears the clip edge.
    setShiftPx(next ? -(overflow + 8) : 0);
    setDurationSec(next ? Math.min(22, Math.max(6, (overflow + 8) / 24)) : 6);
  }, []);

  useEffect(() => {
    measure();
    const outer = outerRef.current;
    const track = trackRef.current;
    if (!outer) return;

    const ro = new ResizeObserver(() => measure());
    ro.observe(outer);
    if (track) ro.observe(track);

    const fonts = document.fonts;
    if (fonts?.ready) {
      void fonts.ready.then(measure);
    }

    return () => ro.disconnect();
  }, [measure, children]);

  const titleText =
    title ??
    (typeof children === "string" || typeof children === "number"
      ? String(children)
      : undefined);

  const style = {
    "--marquee-shift": `${shiftPx}px`,
    "--marquee-duration": `${durationSec}s`,
  } as CSSProperties;

  return (
    <Tag
      ref={outerRef as never}
      className={[
        styles.root,
        overflowing ? styles.overflowing : null,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
      dir={dir}
      title={overflowing ? titleText : undefined}
    >
      <span ref={trackRef} className={styles.track}>
        {children}
      </span>
    </Tag>
  );
}
