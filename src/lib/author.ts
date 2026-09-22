/** Public profiles of the site's author — shown in the landing "Built by" section and in JSON-LD. */
export const AUTHOR_LINKS = {
  website: "https://arash-alfooneh.ir/",
  linkedin: "https://www.linkedin.com/in/arash-alfooneh/",
  github: "https://github.com/Arash3f",
} as const;

/**
 * The author's names for JSON-LD, identical on every locale. The Person shares
 * its `@id` with arash-alfooneh.ir, which declares the same name/alternateName
 * pair — both sites must describe that entity the same way.
 */
export const AUTHOR_NAMES = {
  name: "Arash Alfooneh",
  alternateName: "آرش آلفونه",
} as const;
