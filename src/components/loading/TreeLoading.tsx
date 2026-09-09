import styles from "./TreeLoading.module.css";

type Props = {
  brand: string;
  label: string;
};

export function TreeLoading({ brand, label }: Props) {
  return (
    <div className={styles.screen} role="status" aria-live="polite" aria-busy="true">
      <div className={styles.glow} aria-hidden />
      <div className={styles.grain} aria-hidden />

      <div className={styles.stage}>
        <div className={styles.orb} aria-hidden>
          <svg className={styles.tree} viewBox="0 0 280 240" fill="none">
            <defs>
              <linearGradient id="ftLoadLine" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.95" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.18" />
              </linearGradient>
              <radialGradient id="ftLoadCore" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="1" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.4" />
              </radialGradient>
              <filter id="ftLoadSoft" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="1.2" />
              </filter>
            </defs>

            <g className={styles.dust} fill="var(--accent)">
              <circle className={styles.spark} cx="48" cy="54" r="1.6" />
              <circle className={styles.spark} cx="232" cy="42" r="1.2" />
              <circle className={styles.spark} cx="64" cy="196" r="1.4" />
              <circle className={styles.spark} cx="214" cy="188" r="1.1" />
              <circle className={styles.spark} cx="140" cy="28" r="1.3" />
              <circle className={styles.spark} cx="36" cy="128" r="1" />
              <circle className={styles.spark} cx="248" cy="132" r="1.2" />
            </g>

            <g
              className={styles.edges}
              stroke="url(#ftLoadLine)"
              strokeWidth="1.7"
              strokeLinecap="round"
            >
              <path className={styles.edge} pathLength={1} d="M140 56C140 86 140 108 140 126" />
              <path className={styles.edge} pathLength={1} d="M140 126C104 136 78 156 62 176" />
              <path className={styles.edge} pathLength={1} d="M140 126C176 136 202 156 218 176" />
              <path className={styles.edge} pathLength={1} d="M62 176C48 194 42 206 38 218" />
              <path className={styles.edge} pathLength={1} d="M62 176C78 194 88 206 96 218" />
              <path className={styles.edge} pathLength={1} d="M218 176C202 194 192 206 184 218" />
              <path className={styles.edge} pathLength={1} d="M218 176C232 194 240 206 242 218" />
              <path className={styles.edge} pathLength={1} d="M100 56C78 66 62 80 52 98" />
              <path className={styles.edge} pathLength={1} d="M180 56C202 66 218 80 228 98" />
            </g>

            <g className={styles.nodes}>
              <circle className={styles.node} cx="100" cy="56" r="4.5" />
              <circle className={styles.node} cx="180" cy="56" r="4.5" />
              <circle className={`${styles.node} ${styles.root}`} cx="140" cy="56" r="6.2" />
              <circle className={styles.node} cx="52" cy="98" r="3.5" />
              <circle className={styles.node} cx="228" cy="98" r="3.5" />
              <circle
                className={`${styles.node} ${styles.core}`}
                cx="140"
                cy="126"
                r="8"
                fill="url(#ftLoadCore)"
              />
              <circle className={styles.ring} cx="140" cy="126" r="15" />
              <circle className={styles.ringDelayed} cx="140" cy="126" r="15" />
              <circle className={styles.node} cx="62" cy="176" r="5" />
              <circle className={styles.node} cx="218" cy="176" r="5" />
              <circle className={styles.node} cx="38" cy="218" r="3.5" />
              <circle className={styles.node} cx="96" cy="218" r="3.5" />
              <circle className={styles.node} cx="184" cy="218" r="3.5" />
              <circle className={styles.node} cx="242" cy="218" r="3.5" />
            </g>

            <g className={styles.leaves} fill="var(--accent)" filter="url(#ftLoadSoft)">
              <ellipse className={styles.leaf} cx="74" cy="42" rx="5" ry="2.4" transform="rotate(-28 74 42)" />
              <ellipse className={styles.leaf} cx="206" cy="40" rx="5" ry="2.4" transform="rotate(32 206 40)" />
              <ellipse className={styles.leaf} cx="34" cy="160" rx="4.2" ry="2" transform="rotate(-18 34 160)" />
              <ellipse className={styles.leaf} cx="246" cy="158" rx="4.2" ry="2" transform="rotate(22 246 158)" />
            </g>
          </svg>
        </div>

        <p className={styles.brand}>{brand}</p>
        <p className={styles.label}>{label}</p>

        <div className={styles.bar} aria-hidden>
          <span className={styles.barFill} />
        </div>
      </div>
    </div>
  );
}
