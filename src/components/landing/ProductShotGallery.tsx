"use client";

import { useCallback, useState } from "react";
import { HiOutlineArrowsPointingOut } from "react-icons/hi2";
import styles from "./ProductShots.module.css";
import { ShotImage, type Shot } from "./ShotImage";
import { ShotLightbox, type ShotLightboxLabels } from "./ShotLightbox";

type Props = {
  shots: Shot[];
  labels: ShotLightboxLabels & { open: string };
};

/** The landing's product shots; a click opens one full screen. */
export function ProductShotGallery({ shots, labels }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const close = useCallback(() => setOpenIndex(null), []);

  return (
    <>
      {shots.map((shot, index) => (
        <figure key={shot.id} className={styles.figure}>
          <button
            type="button"
            className={styles.frame}
            onClick={() => setOpenIndex(index)}
            aria-label={`${labels.open}: ${shot.title}`}
            aria-haspopup="dialog"
          >
            <ShotImage shot={shot} className={styles.image} loading="lazy" />
            <span className={styles.expand} aria-hidden>
              <HiOutlineArrowsPointingOut />
            </span>
          </button>
          <figcaption className={styles.caption}>
            <span className={styles.captionTitle}>{shot.title}</span>
            {shot.body}
          </figcaption>
        </figure>
      ))}
      {openIndex !== null && (
        <ShotLightbox
          shots={shots}
          index={openIndex}
          onIndexChange={setOpenIndex}
          onClose={close}
          labels={labels}
        />
      )}
    </>
  );
}
