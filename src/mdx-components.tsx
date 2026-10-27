import type { MDXComponents } from "mdx/types";
import type { ComponentPropsWithoutRef } from "react";
import { Link } from "@/i18n/navigation";

/** A site path to a file in `public/` (it has an extension), not a page. */
const FILE_PATH = /\.[a-z0-9]+$/i;

/**
 * Global MDX components (required by @next/mdx). Links to pages that start
 * with "/" stay in the reader's locale, files are downloaded as they are, and
 * everything else opens a new tab.
 */
const components = {
  a: ({ href = "", ...props }: ComponentPropsWithoutRef<"a">) => {
    if (href.startsWith("/") && FILE_PATH.test(href)) {
      return <a href={href} download {...props} />;
    }
    if (href.startsWith("/") && !href.startsWith("//")) {
      return <Link href={href} {...props} />;
    }
    if (href.startsWith("#")) return <a href={href} {...props} />;
    return <a href={href} target="_blank" rel="noopener noreferrer" {...props} />;
  },
} satisfies MDXComponents;

export function useMDXComponents(): MDXComponents {
  return components;
}
