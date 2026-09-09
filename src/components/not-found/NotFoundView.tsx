import { getLocale, getTranslations } from "next-intl/server";
import { getApiDocsUrl } from "@/lib/api";
import { formatLocaleDigits } from "@/lib/localeDigits";
import { Link } from "@/i18n/navigation";
import styles from "./NotFoundView.module.css";

export async function NotFoundView() {
  const locale = await getLocale();
  const t = await getTranslations("notFound");
  const brand = await getTranslations("hero");

  return (
    <section className={styles.page} aria-labelledby="not-found-title">
      <div className={styles.atmosphere} aria-hidden>
        <svg
          className={styles.graph}
          viewBox="0 0 720 600"
          preserveAspectRatio="xMidYMid meet"
          fill="none"
        >
          <defs>
            <linearGradient id="notFoundLine" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.55" />
              <stop
                offset="100%"
                stopColor="var(--accent)"
                stopOpacity="0.12"
              />
            </linearGradient>
            <radialGradient id="notFoundCore" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="1" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.55" />
            </radialGradient>
          </defs>

          <g
            stroke="url(#notFoundLine)"
            strokeWidth="1.25"
            strokeLinecap="round"
          >
            <path
              className={styles.edge}
              pathLength={1}
              d="M120 90C190 70 250 110 320 98"
            />
            <path
              className={styles.edge}
              pathLength={1}
              d="M320 98C390 80 450 55 530 78"
            />
            <path
              className={styles.edge}
              pathLength={1}
              d="M320 98C320 170 330 220 372 268"
            />
            <path
              className={styles.edge}
              pathLength={1}
              d="M372 268C440 240 500 290 580 272"
            />
            <path
              className={styles.edge}
              pathLength={1}
              d="M372 268C330 330 270 360 210 380"
            />
            <path
              className={styles.edge}
              pathLength={1}
              d="M210 380C250 420 290 450 330 480"
            />
            <path
              className={styles.edge}
              pathLength={1}
              d="M580 272C620 300 640 340 660 390"
            />
            <path
              className={styles.edge}
              pathLength={1}
              d="M330 480C380 520 430 540 480 560"
            />
            <path
              className={styles.edgeGhost}
              d="M580 272C620 230 660 210 700 190"
            />
          </g>

          <g className={styles.nodes}>
            <circle className={styles.node} cx="120" cy="90" r="4" />
            <circle className={styles.node} cx="320" cy="98" r="5.5" />
            <circle className={styles.node} cx="530" cy="78" r="4" />
            <circle className={styles.node} cx="210" cy="380" r="4.5" />
            <circle className={styles.node} cx="330" cy="480" r="4" />
            <circle className={styles.node} cx="480" cy="560" r="3.5" />
            <circle className={styles.node} cx="660" cy="390" r="3.5" />
            <circle className={styles.nodeCore} cx="372" cy="268" r="7" />
            <circle className={styles.nodeRing} cx="372" cy="268" r="14" />
            <circle className={styles.nodeMissing} cx="700" cy="190" r="8" />
          </g>
        </svg>
        <div className={styles.mesh} />
        <div className={styles.horizon} />
      </div>

      <div className={styles.content}>
        <p className={styles.brand}>{brand("brand")}</p>
        <p className={styles.code}>{formatLocaleDigits(404, locale)}</p>
        <h1 id="not-found-title" className={styles.headline}>
          {t("title")}
        </h1>
        <p className={styles.support}>{t("body")}</p>
        <div className={styles.ctas}>
          <Link className={styles.primary} href="/">
            {t("home")}
          </Link>
          <a
            className={styles.secondary}
            href={getApiDocsUrl()}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("docs")}
          </a>
        </div>
      </div>
    </section>
  );
}
