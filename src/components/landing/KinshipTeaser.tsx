import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import buttonStyles from "@/components/ui/Button.module.css";
// The same band as the closing call to action, so the two read as a pair.
import styles from "./CallToAction.module.css";

const toolCta = `${buttonStyles.base} ${buttonStyles.lg} ${buttonStyles.primary}`;

/** Points visitors at the kinship tool, the one thing they can try signed out. */
export async function KinshipTeaser() {
  const t = await getTranslations("kinshipTeaser");
  const headingId = "kinship-teaser-title";

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
          <Link className={toolCta} href="/kinship">
            {t("cta")}
          </Link>
        </div>
      </div>
    </section>
  );
}
