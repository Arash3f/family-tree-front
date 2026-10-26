import styles from "./ProductShots.module.css";

/** One product shot: the base path of its files plus its copy. */
export type Shot = {
  id: string;
  /** `/showcase/<shot>-<locale>`; each theme has a `-1x` and `-2x` file. */
  base: string;
  alt: string;
  title: string;
  body: string;
};

const THEMES = ["light", "dark"] as const;
/** The width the landing column shows them at; each shot also has a 2x copy. */
export const SHOT_SIZE = { width: 1150, height: 719 };

type Props = {
  shot: Shot;
  className?: string;
  loading?: "lazy" | "eager";
  /** Always the 2x file: for a view larger than the landing column. */
  full?: boolean;
};

/**
 * A shot in both themes; the other theme's copy is `display: none`, and a lazy
 * image that is not rendered is never fetched.
 *
 * A plain <img>, not next/image: the files are lossless and each density has
 * its own capture, so any re-encode or resize would only blur the UI text.
 */
export function ShotImage({ shot, className, loading, full = false }: Props) {
  return THEMES.map((theme) => {
    const base = `${shot.base}-${theme}`;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={theme}
        className={`${className ?? ""} ${styles[theme]}`}
        src={`${base}-2x.webp`}
        srcSet={full ? undefined : `${base}-1x.webp 1x, ${base}-2x.webp 2x`}
        alt={shot.alt}
        width={SHOT_SIZE.width}
        height={SHOT_SIZE.height}
        loading={loading}
        decoding="async"
      />
    );
  });
}
