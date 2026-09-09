import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatLocaleDigits } from "@/lib/localeDigits";
import styles from "./Footer.module.css";

export async function Footer() {
  const locale = await getLocale();
  const t = await getTranslations("footer");
  const year = formatLocaleDigits(new Date().getFullYear(), locale);

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.meta}>
          <p className={styles.brand}>
            {t("rights")} · {year}
          </p>
          <p className={styles.tagline}>{t("tagline")}</p>
        </div>
        <nav className={styles.legal} aria-label={t("legalNav")}>
          <Link href="/privacy">{t("privacy")}</Link>
          <Link href="/terms">{t("terms")}</Link>
        </nav>
      </div>
    </footer>
  );
}
