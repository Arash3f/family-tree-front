import { getLocale, getTranslations } from "next-intl/server";
import { ProductShotGallery } from "./ProductShotGallery";
import styles from "./ProductShots.module.css";

/** Captured by `scripts/shoot-showcase.mjs` from an invented family. */
const SHOTS = ["tree", "relation"] as const;

/** Real screens of the app under the feature list; each opens full screen. */
export async function ProductShots() {
  const locale = await getLocale();
  const t = await getTranslations("features.shots");
  const shotLocale = locale === "fa" ? "fa" : "en";

  return (
    <div className={styles.shots}>
      <ProductShotGallery
        shots={SHOTS.map((shot) => ({
          id: shot,
          base: `/showcase/${shot}-${shotLocale}`,
          alt: t(`${shot}.alt`),
          title: t(`${shot}.title`),
          body: t(`${shot}.body`),
        }))}
        labels={{
          open: t("viewer.open"),
          dialog: t("viewer.dialog"),
          close: t("viewer.close"),
          previous: t("viewer.previous"),
          next: t("viewer.next"),
          zoomIn: t("viewer.zoomIn"),
          zoomOut: t("viewer.zoomOut"),
        }}
      />
      <p className={styles.note}>{t("note")}</p>
    </div>
  );
}
