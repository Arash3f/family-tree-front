import { getTranslations } from "next-intl/server";

import { TreeLoading } from "@/components/loading/TreeLoading";

/**
 * Rendered on the server: the loading screen shows before any client JavaScript
 * has run, so making it a client component only delayed the thing it exists to
 * cover.
 */
export default async function Loading() {
  const t = await getTranslations("loading");

  return <TreeLoading brand={t("brand")} label={t("label")} />;
}
