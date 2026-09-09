import { getTranslations } from "next-intl/server";
import { getApiDocsUrl } from "@/lib/api";
import { Link } from "@/i18n/navigation";
import buttonStyles from "@/components/ui/Button.module.css";
import { ApiStatus } from "./ApiStatus";
import styles from "./Hero.module.css";

const primaryCta = `${buttonStyles.base} ${buttonStyles.lg} ${buttonStyles.primary}`;
const secondaryCta = `${buttonStyles.base} ${buttonStyles.lg} ${buttonStyles.ghost}`;

export async function Hero() {
  const t = await getTranslations("hero");

  return (
    <section className={styles.hero} id="top">
      <div className={styles.atmosphere} aria-hidden>
        <svg
          className={styles.graph}
          viewBox="0 0 720 600"
          preserveAspectRatio="xMidYMid meet"
          fill="none"
        >
          <defs>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.55" />
              <stop
                offset="100%"
                stopColor="var(--accent)"
                stopOpacity="0.12"
              />
            </linearGradient>
            <radialGradient id="coreFill" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="1" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.55" />
            </radialGradient>
          </defs>

          <g stroke="url(#lineGrad)" strokeWidth="1.25" strokeLinecap="round">
            {/* upper lineage */}
            <path
              className={styles.edge}
              pathLength={1}
              d="M96 70C170 52 230 96 292 88"
            />
            <path
              className={styles.edge}
              pathLength={1}
              d="M292 88C360 72 420 42 498 62"
            />
            <path
              className={styles.edge}
              pathLength={1}
              d="M498 62C560 48 600 78 648 90"
            />
            <path
              className={styles.edge}
              pathLength={1}
              d="M292 88C292 150 300 200 348 248"
            />
            <path
              className={styles.edge}
              pathLength={1}
              d="M220 108C190 160 150 200 108 228"
            />

            {/* mid branches from core */}
            <path
              className={styles.edge}
              pathLength={1}
              d="M348 248C420 220 480 270 552 252"
            />
            <path
              className={styles.edge}
              pathLength={1}
              d="M348 248C390 300 430 332 492 348"
            />
            <path
              className={styles.edge}
              pathLength={1}
              d="M348 248C300 310 240 342 188 360"
            />
            <path
              className={styles.edge}
              pathLength={1}
              d="M552 252C600 240 640 270 680 288"
            />

            {/* lower continuation */}
            <path
              className={styles.edge}
              pathLength={1}
              d="M492 348C540 380 570 420 602 460"
            />
            <path
              className={styles.edge}
              pathLength={1}
              d="M492 348C470 400 490 440 520 490"
            />
            <path
              className={styles.edge}
              pathLength={1}
              d="M188 360C230 400 270 430 310 460"
            />
            <path
              className={styles.edge}
              pathLength={1}
              d="M188 360C150 400 120 440 96 490"
            />
            <path
              className={styles.edge}
              pathLength={1}
              d="M310 460C350 500 390 520 440 545"
            />
            <path
              className={styles.edge}
              pathLength={1}
              d="M602 460C640 490 660 520 678 555"
            />
            <path
              className={styles.edge}
              pathLength={1}
              d="M520 490C560 520 600 535 640 560"
            />
          </g>

          <g className={styles.nodes}>
            <circle className={styles.node} cx="96" cy="70" r="4" />
            <circle className={styles.node} cx="292" cy="88" r="5.5" />
            <circle className={styles.node} cx="498" cy="62" r="4" />
            <circle className={styles.node} cx="648" cy="90" r="3.5" />
            <circle className={styles.node} cx="108" cy="228" r="4" />

            <circle className={styles.nodeCore} cx="348" cy="248" r="7" />
            <circle className={styles.nodeRing} cx="348" cy="248" r="14" />

            <circle className={styles.node} cx="552" cy="252" r="4.5" />
            <circle className={styles.node} cx="680" cy="288" r="3.5" />
            <circle className={styles.node} cx="492" cy="348" r="4.5" />
            <circle className={styles.node} cx="188" cy="360" r="4.5" />
            <circle className={styles.node} cx="602" cy="460" r="4" />
            <circle className={styles.node} cx="520" cy="490" r="3.5" />
            <circle className={styles.node} cx="310" cy="460" r="4" />
            <circle className={styles.node} cx="96" cy="490" r="3.5" />
            <circle className={styles.node} cx="440" cy="545" r="3.5" />
            <circle className={styles.node} cx="678" cy="555" r="3" />
            <circle className={styles.node} cx="640" cy="560" r="3" />
          </g>
        </svg>
        <div className={styles.mesh} />
        <div className={styles.horizon} />
      </div>

      <div className={styles.content}>
        <div className={styles.metaRow}>
          <p className={styles.brand}>{t("brand")}</p>
          <ApiStatus />
        </div>
        <h1 className={styles.headline}>{t("headline")}</h1>
        <p className={styles.support}>{t("support")}</p>
        <div className={styles.ctas}>
          <Link className={`${primaryCta} ${styles.cta}`} href="/login">
            {t("ctaLogin")}
          </Link>
          <a
            className={`${secondaryCta} ${styles.cta}`}
            href={getApiDocsUrl()}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("ctaDocs")}
          </a>
        </div>
      </div>

      <a className={styles.scrollCue} href="#features" aria-label={t("scroll")}>
        <span className={styles.scrollLine} aria-hidden />
      </a>
    </section>
  );
}
