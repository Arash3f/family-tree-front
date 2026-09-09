"use client";

import { useEffect, useId, useRef } from "react";
import styles from "./DashboardBackdrop.module.css";

const LINEAGE_MAIN =
  "M200 400C214 372 240 332 290 280C316 268 338 248 360 220C430 188 560 158 720 128C880 158 1010 188 1080 220C1102 248 1128 268 1150 280C1200 332 1226 372 1240 400";
const LINEAGE_CENTER =
  "M720 128C720 168 720 198 720 220C742 248 768 268 790 280C790 328 790 368 790 400C816 430 842 452 880 400";
const LINEAGE_LEFT =
  "M720 128C560 158 430 188 360 220C338 248 316 268 290 280C340 332 366 372 380 400C396 430 412 454 430 470C430 520 430 562 430 600C452 648 470 690 490 740";

export function DashboardBackdrop() {
  const uid = `db${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (
      !window.matchMedia("(pointer: fine)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let frame = 0;
    let x = 0;
    let y = 0;

    const commit = () => {
      frame = 0;
      root.style.setProperty("--px", x.toFixed(4));
      root.style.setProperty("--py", y.toFixed(4));
    };

    const onMove = (event: PointerEvent) => {
      x = event.clientX / window.innerWidth - 0.5;
      y = event.clientY / window.innerHeight - 0.5;
      if (!frame) frame = window.requestAnimationFrame(commit);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={rootRef} className={styles.root} aria-hidden>
      <div className={styles.wash} />

      <div className={`${styles.par} ${styles.auroraPar}`}>
        <div className={styles.glowA} />
        <div className={styles.glowB} />
        <div className={styles.glowC} />
        <div className={styles.glowD} />
      </div>

      <div className={`${styles.par} ${styles.gridPar}`}>
        <div className={styles.grid} />
      </div>

      <div className={`${styles.par} ${styles.farPar}`}>
        <svg
          className={styles.far}
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
        >
          <g stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round">
            <path d="M120 640C210 560 300 520 420 500" />
            <path d="M420 500C520 470 600 420 640 340" />
            <path d="M640 340C760 330 880 350 980 400" />
            <path d="M980 400C1080 440 1200 480 1330 470" />
            <path d="M420 500C400 600 380 680 300 780" />
            <path d="M980 400C1000 300 1060 240 1180 200" />
          </g>
          <g fill="var(--accent)">
            <circle cx="120" cy="640" r="9" />
            <circle cx="420" cy="500" r="11" />
            <circle cx="640" cy="340" r="13" />
            <circle cx="980" cy="400" r="11" />
            <circle cx="1330" cy="470" r="9" />
            <circle cx="300" cy="780" r="8" />
            <circle cx="1180" cy="200" r="8" />
          </g>
        </svg>
      </div>

      <div className={styles.mirror}>
        <div className={`${styles.par} ${styles.graphPar}`}>
          <svg
            className={styles.graph}
            viewBox="0 0 1440 900"
            preserveAspectRatio="xMidYMid slice"
            fill="none"
          >
            <defs>
              <linearGradient id={`${uid}-edge`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.9" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.18" />
              </linearGradient>
              <linearGradient id={`${uid}-trace`} x1="0" y1="0" x2="1" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--pedigree-path)"
                  stopOpacity="0.15"
                />
                <stop
                  offset="50%"
                  stopColor="var(--pedigree-path)"
                  stopOpacity="0.9"
                />
                <stop
                  offset="100%"
                  stopColor="var(--pedigree-path)"
                  stopOpacity="0.15"
                />
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.42" />
                <stop offset="45%" stopColor="var(--accent)" stopOpacity="0.14" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </radialGradient>
              <filter
                id={`${uid}-soft`}
                x="-40%"
                y="-40%"
                width="180%"
                height="180%"
              >
                <feGaussianBlur stdDeviation="0.8" />
              </filter>
            </defs>

            <g fill={`url(#${uid}-halo)`}>
              <circle className={styles.halo} cx="720" cy="128" r="230" />
              <circle className={styles.haloSlow} cx="430" cy="470" r="150" />
              <circle className={styles.haloSlow} cx="1010" cy="470" r="150" />
            </g>

            <g
              className={styles.edges}
              stroke={`url(#${uid}-edge)`}
              strokeWidth="1.35"
              strokeLinecap="round"
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

            <path
              className={styles.trace}
              pathLength={1}
              d={LINEAGE_MAIN}
              stroke={`url(#${uid}-trace)`}
              strokeWidth="2.1"
              strokeLinecap="round"
            />

            <g
              className={styles.pulses}
              stroke="var(--pedigree-path)"
              strokeLinecap="round"
            >
              <path
                className={`${styles.pulse} ${styles.wide}`}
                pathLength={1}
                d={LINEAGE_MAIN}
              />
              <path className={styles.pulse} pathLength={1} d={LINEAGE_MAIN} />
              <path
                className={`${styles.pulseSlow} ${styles.wide}`}
                pathLength={1}
                d={LINEAGE_CENTER}
              />
              <path className={styles.pulseSlow} pathLength={1} d={LINEAGE_CENTER} />
              <path
                className={`${styles.pulseDeep} ${styles.wide}`}
                pathLength={1}
                d={LINEAGE_LEFT}
              />
              <path className={styles.pulseDeep} pathLength={1} d={LINEAGE_LEFT} />
            </g>

            <g className={styles.unions}>
              <circle className={styles.union} cx="720" cy="128" r="4.2" />
              <circle className={styles.union} cx="290" cy="280" r="3.4" />
              <circle className={styles.union} cx="790" cy="280" r="3.4" />
              <circle className={styles.union} cx="1150" cy="280" r="3.4" />
              <circle className={styles.union} cx="430" cy="470" r="3.2" />
              <circle className={styles.union} cx="1010" cy="470" r="3.2" />
            </g>

            <g>
              <circle className={styles.ring} cx="720" cy="128" r="11" />
              <circle className={styles.ringLate} cx="720" cy="128" r="11" />
              <circle className={styles.ringWide} cx="430" cy="470" r="9" />
              <circle className={styles.ringWide} cx="1010" cy="470" r="9" />
            </g>

            <g className={styles.people}>
              <circle className={`${styles.person} ${styles.male}`} cx="640" cy="72" r="7" />
              <circle className={`${styles.person} ${styles.female}`} cx="800" cy="72" r="7" />
              <circle className={`${styles.person} ${styles.male}`} cx="220" cy="220" r="6.2" />
              <circle className={`${styles.person} ${styles.female}`} cx="360" cy="220" r="6.5" />
              <circle className={`${styles.person} ${styles.male}`} cx="720" cy="220" r="6.5" />
              <circle className={`${styles.person} ${styles.female}`} cx="860" cy="220" r="6.2" />
              <circle className={`${styles.person} ${styles.male}`} cx="1080" cy="220" r="6.5" />
              <circle className={`${styles.person} ${styles.female}`} cx="1220" cy="220" r="6.2" />
              <circle className={`${styles.person} ${styles.female}`} cx="200" cy="400" r="5.4" />
              <circle className={`${styles.person} ${styles.male}`} cx="290" cy="400" r="5.4" />
              <circle className={`${styles.person} ${styles.female}`} cx="380" cy="400" r="5.6" />
              <circle className={`${styles.person} ${styles.male}`} cx="700" cy="400" r="5.4" />
              <circle className={`${styles.person} ${styles.female}`} cx="790" cy="400" r="5.4" />
              <circle className={`${styles.person} ${styles.male}`} cx="880" cy="400" r="5.4" />
              <circle className={`${styles.person} ${styles.female}`} cx="960" cy="400" r="5.4" />
              <circle className={`${styles.person} ${styles.male}`} cx="1060" cy="400" r="5.6" />
              <circle className={`${styles.person} ${styles.female}`} cx="1150" cy="400" r="5.4" />
              <circle className={`${styles.person} ${styles.male}`} cx="1240" cy="400" r="5.4" />
              <circle className={`${styles.person} ${styles.male}`} cx="480" cy="400" r="5.4" />
              <circle className={`${styles.person} ${styles.female}`} cx="370" cy="600" r="4.8" />
              <circle className={`${styles.person} ${styles.male}`} cx="430" cy="600" r="4.8" />
              <circle className={`${styles.person} ${styles.female}`} cx="490" cy="600" r="4.8" />
              <circle className={`${styles.person} ${styles.male}`} cx="950" cy="600" r="4.8" />
              <circle className={`${styles.person} ${styles.female}`} cx="1010" cy="600" r="4.8" />
              <circle className={`${styles.person} ${styles.male}`} cx="1070" cy="600" r="4.8" />
              <circle className={`${styles.person} ${styles.male}`} cx="416" cy="744" r="4.1" />
              <circle className={`${styles.person} ${styles.female}`} cx="520" cy="744" r="4.1" />
              <circle className={`${styles.person} ${styles.female}`} cx="930" cy="744" r="4.1" />
              <circle className={`${styles.person} ${styles.male}`} cx="1098" cy="744" r="4.1" />
            </g>

            <g className={styles.leaves} fill="var(--accent)" filter={`url(#${uid}-soft)`}>
              <ellipse className={styles.leaf} cx="168" cy="140" rx="7" ry="3.2" transform="rotate(-28 168 140)" />
              <ellipse className={styles.leaf} cx="1288" cy="156" rx="6.5" ry="3" transform="rotate(24 1288 156)" />
              <ellipse className={styles.leaf} cx="92" cy="510" rx="5.5" ry="2.6" transform="rotate(-16 92 510)" />
              <ellipse className={styles.leaf} cx="1348" cy="540" rx="6" ry="2.8" transform="rotate(18 1348 540)" />
              <ellipse className={styles.leaf} cx="560" cy="800" rx="5.8" ry="2.7" transform="rotate(-22 560 800)" />
              <ellipse className={styles.leaf} cx="980" cy="820" rx="5.2" ry="2.5" transform="rotate(30 980 820)" />
            </g>
          </svg>
        </div>
      </div>

      <div className={styles.beam} />

      <div className={`${styles.par} ${styles.motePar}`}>
        <span className={`${styles.mote} ${styles.mote1}`} />
        <span className={`${styles.mote} ${styles.mote2}`} />
        <span className={`${styles.mote} ${styles.mote3}`} />
        <span className={`${styles.mote} ${styles.mote4}`} />
        <span className={`${styles.mote} ${styles.mote5}`} />
        <span className={`${styles.mote} ${styles.mote6}`} />
        <span className={`${styles.mote} ${styles.mote7}`} />
        <span className={`${styles.mote} ${styles.mote8}`} />
      </div>

      <div className={styles.grain} />
      <div className={styles.vignette} />
    </div>
  );
}
