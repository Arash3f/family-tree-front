import { existsSync } from "node:fs";
import path from "node:path";
import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import { FaGithub, FaGlobe, FaLinkedin } from "react-icons/fa";
import { AUTHOR_LINKS } from "@/lib/author";
import { formatLocaleDigits } from "@/lib/localeDigits";
import { Section } from "./Section";
import styles from "./Author.module.css";

const PHOTO = "/arash-alfooneh.webp";
const PHOTO_FILE = path.join(process.cwd(), "public", "arash-alfooneh.webp");

export async function Author() {
  const locale = await getLocale();
  const t = await getTranslations("author");
  const name = t("name");
  const hasPhoto = existsSync(PHOTO_FILE);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <Section
      id="author"
      ordinal={formatLocaleDigits("04", locale)}
      eyebrow={t("title")}
      title={name}
      delay={160}
    >
      <div className={styles.card}>
        <div className={styles.photoWrap}>
          {hasPhoto ? (
            <Image
              className={styles.photo}
              src={PHOTO}
              alt={name}
              width={160}
              height={160}
              sizes="(max-width: 479.98px) 7.5rem, 8.5rem"
              priority={false}
            />
          ) : (
            <span className={styles.photoFallback} aria-hidden>
              {initials || "AA"}
            </span>
          )}
        </div>
        <div className={styles.body}>
          <p className={styles.role}>{t("role")}</p>
          <p className={styles.bio}>{t("bio")}</p>
          <div className={styles.links}>
            <a
              className={styles.link}
              href={AUTHOR_LINKS.website}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaGlobe className={styles.icon} aria-hidden />
              {t("website")}
            </a>
            <a
              className={styles.link}
              href={AUTHOR_LINKS.linkedin}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaLinkedin className={styles.icon} aria-hidden />
              {t("linkedin")}
            </a>
            <a
              className={styles.link}
              href={AUTHOR_LINKS.github}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaGithub className={styles.icon} aria-hidden />
              {t("github")}
            </a>
          </div>
        </div>
      </div>
    </Section>
  );
}
