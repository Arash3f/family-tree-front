import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { formatLocaleDigits } from "@/lib/localeDigits";
import { Section } from "./Section";
import styles from "./Faq.module.css";

/**
 * Read the question keys for the active locale, in the order the message file
 * lists them.
 *
 * The two locales deliberately ask *different* questions: Persian searches are
 * about building a first tree and keeping it private, English ones about
 * GEDCOM, self-hosting and cousin terminology. Deriving the keys from the
 * messages instead of hard-coding one shared list is what lets each locale
 * carry its own set — and its own length — without the other having to invent
 * a translation for a question nobody asks in that language.
 */
async function faqKeys(): Promise<string[]> {
  const messages = (await getMessages()) as {
    faq?: { items?: Record<string, unknown> };
  };
  return Object.keys(messages.faq?.items ?? {});
}

export async function Faq() {
  const locale = await getLocale();
  const t = await getTranslations("faq");
  const tNav = await getTranslations("nav");
  const keys = await faqKeys();

  // Rich result eligibility requires the answer text to be identical to what the
  // page renders, so both are read from the same messages in the same pass.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: locale,
    mainEntity: keys.map((key) => ({
      "@type": "Question",
      name: t(`items.${key}.q`),
      acceptedAnswer: {
        "@type": "Answer",
        text: t(`items.${key}.a`),
      },
    })),
  };

  return (
    <Section
      id="faq"
      ordinal={formatLocaleDigits("05", locale)}
      eyebrow={tNav("faq")}
      title={t("title")}
      subtitle={t("subtitle")}
      delay={120}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/*
       * `details` rather than a JS accordion: the answers are in the DOM whether
       * or not they are open, so a crawler reads the full text, the section
       * needs no client bundle, and in-page search (Ctrl+F) still opens them.
       */}
      <ul className={styles.list}>
        {keys.map((key) => (
          <li key={key}>
            <details className={styles.item} name="faq">
              <summary className={styles.question}>
                <h3 className={styles.questionText}>{t(`items.${key}.q`)}</h3>
                <span className={styles.marker} aria-hidden />
              </summary>
              <p className={styles.answer}>{t(`items.${key}.a`)}</p>
            </details>
          </li>
        ))}
      </ul>
    </Section>
  );
}
