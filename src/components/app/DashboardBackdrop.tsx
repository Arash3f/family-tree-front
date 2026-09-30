"use client";

import { useId } from "react";
import styles from "./DashboardBackdrop.module.css";

/**
 * Quiet dashboard atmosphere: static washes + a still lineage silhouette.
 * No continuous CSS/SVG motion, filters, or pointer parallax — those were
 * measurable on mid-range machines and especially Firefox with a blurred topbar.
 */
export function DashboardBackdrop() {
  const uid = `db${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <div className={styles.root} aria-hidden>
      <div className={styles.wash} />
      <div className={styles.glowA} />
      <div className={styles.glowB} />
      <div className={styles.glowC} />

      <div className={styles.mirror}>
        <svg
          className={styles.graph}
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
        >
          <defs>
            <linearGradient id={`${uid}-edge`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.75" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.14" />
            </linearGradient>
            <radialGradient id={`${uid}-halo`}>
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
              <stop offset="55%" stopColor="var(--accent)" stopOpacity="0.08" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </radialGradient>
          </defs>

          <circle cx="720" cy="128" r="200" fill={`url(#${uid}-halo)`} />

          <g
            stroke={`url(#${uid}-edge)`}
            strokeWidth="1.3"
            strokeLinecap="round"
            opacity="0.7"
          >
            <path d="M640 72C668 96 688 118 720 128" />
            <path d="M800 72C772 96 752 118 720 128" />
            <path d="M720 128C560 158 430 188 360 220" />
            <path d="M720 128C720 168 720 198 720 220" />
            <path d="M720 128C880 158 1010 188 1080 220" />
            <path d="M220 220C242 248 264 268 290 280" />
            <path d="M360 220C338 248 316 268 290 280" />
            <path d="M720 220C742 248 768 268 790 280" />
            <path d="M860 220C838 248 812 268 790 280" />
            <path d="M1080 220C1102 248 1128 268 1150 280" />
            <path d="M1220 220C1198 248 1172 268 1150 280" />
            <path d="M290 280C240 332 214 372 200 400" />
            <path d="M290 280C290 328 290 368 290 400" />
            <path d="M290 280C340 332 366 372 380 400" />
            <path d="M790 280C740 332 714 372 700 400" />
            <path d="M790 280C790 328 790 368 790 400" />
            <path d="M790 280C840 332 866 372 880 400" />
            <path d="M1150 280C1100 332 1074 372 1060 400" />
            <path d="M1150 280C1150 328 1150 368 1150 400" />
            <path d="M1150 280C1200 332 1226 372 1240 400" />
            <path d="M380 400C396 430 412 454 430 470" />
            <path d="M480 400C464 430 448 454 430 470" />
            <path d="M430 470C392 522 376 566 370 600" />
            <path d="M430 470C430 520 430 562 430 600" />
            <path d="M430 470C468 522 484 566 490 600" />
            <path d="M960 400C976 430 992 454 1010 470" />
            <path d="M1060 400C1044 430 1028 454 1010 470" />
            <path d="M1010 470C972 522 956 566 950 600" />
            <path d="M1010 470C1010 520 1010 562 1010 600" />
            <path d="M1010 470C1048 522 1064 566 1070 600" />
            <path d="M490 600C506 654 512 700 520 744" />
            <path d="M430 600C424 654 420 700 416 744" />
            <path d="M950 600C942 654 936 700 930 744" />
            <path d="M1070 600C1082 654 1090 700 1098 744" />
          </g>

          <g fill="var(--accent)" opacity="0.55">
            <circle cx="720" cy="128" r="4" />
            <circle cx="290" cy="280" r="3.2" />
            <circle cx="790" cy="280" r="3.2" />
            <circle cx="1150" cy="280" r="3.2" />
            <circle cx="430" cy="470" r="3" />
            <circle cx="1010" cy="470" r="3" />
          </g>

          <g>
            <circle className={styles.male} cx="640" cy="72" r="6.5" />
            <circle className={styles.female} cx="800" cy="72" r="6.5" />
            <circle className={styles.male} cx="220" cy="220" r="5.8" />
            <circle className={styles.female} cx="360" cy="220" r="6" />
            <circle className={styles.male} cx="720" cy="220" r="6" />
            <circle className={styles.female} cx="860" cy="220" r="5.8" />
            <circle className={styles.male} cx="1080" cy="220" r="6" />
            <circle className={styles.female} cx="1220" cy="220" r="5.8" />
            <circle className={styles.female} cx="200" cy="400" r="5" />
            <circle className={styles.male} cx="290" cy="400" r="5" />
            <circle className={styles.female} cx="380" cy="400" r="5.2" />
            <circle className={styles.male} cx="700" cy="400" r="5" />
            <circle className={styles.female} cx="790" cy="400" r="5" />
            <circle className={styles.male} cx="880" cy="400" r="5" />
            <circle className={styles.female} cx="960" cy="400" r="5" />
            <circle className={styles.male} cx="1060" cy="400" r="5.2" />
            <circle className={styles.female} cx="1150" cy="400" r="5" />
            <circle className={styles.male} cx="1240" cy="400" r="5" />
            <circle className={styles.male} cx="480" cy="400" r="5" />
            <circle className={styles.female} cx="370" cy="600" r="4.5" />
            <circle className={styles.male} cx="430" cy="600" r="4.5" />
            <circle className={styles.female} cx="490" cy="600" r="4.5" />
            <circle className={styles.male} cx="950" cy="600" r="4.5" />
            <circle className={styles.female} cx="1010" cy="600" r="4.5" />
            <circle className={styles.male} cx="1070" cy="600" r="4.5" />
            <circle className={styles.male} cx="416" cy="744" r="3.8" />
            <circle className={styles.female} cx="520" cy="744" r="3.8" />
            <circle className={styles.female} cx="930" cy="744" r="3.8" />
            <circle className={styles.male} cx="1098" cy="744" r="3.8" />
          </g>
        </svg>
      </div>

      <div className={styles.vignette} />
    </div>
  );
}
