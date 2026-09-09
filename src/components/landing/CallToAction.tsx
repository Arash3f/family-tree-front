import { getTranslations } from "next-intl/server";
import { getApiDocsUrl } from "@/lib/api";
import { Link } from "@/i18n/navigation";
import buttonStyles from "@/components/ui/Button.module.css";
import styles from "./CallToAction.module.css";

const primaryCta = `${buttonStyles.base} ${buttonStyles.lg} ${buttonStyles.primary}`;
const secondaryCta = `${buttonStyles.base} ${buttonStyles.lg} ${buttonStyles.ghost}`;

export async function CallToAction() {
  const t = await getTranslations("cta");
  const headingId = "cta-title";

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <div className={styles.panel}>
        <div className={styles.glow} aria-hidden />
        <div className={styles.body}>
          <h2 id={headingId} className={styles.title}>
            {t("title")}
          </h2>
          <p className={styles.support}>{t("body")}</p>
        </div>
        <div className={styles.actions}>
          <Link className={primaryCta} href="/login">
            {t("primary")}
          </Link>
          <a
            className={secondaryCta}
            href={getApiDocsUrl()}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("secondary")}
          </a>
        </div>
      </div>
    </section>
  );
}
