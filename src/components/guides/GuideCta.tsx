import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/Button";
import styles from "./Guides.module.css";

type Props = {
  /** Overrides the default "build your family tree" heading. */
  title?: string;
  body?: string;
};

/** The closing ask under every guide and the kinship tool: start a tree. */
export async function GuideCta({ title, body }: Props) {
  const t = await getTranslations("guides");
  const heading = title ?? t("ctaTitle");
  return (
    <aside className={styles.cta} aria-label={heading}>
      <p className={styles.ctaTitle}>{heading}</p>
      <p className={styles.ctaBody}>{body ?? t("ctaBody")}</p>
      <ButtonLink href="/register">{t("ctaButton")}</ButtonLink>
    </aside>
  );
}
