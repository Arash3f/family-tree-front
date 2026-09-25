export type ChromeLayout = "stack" | "centered";
export type ChromeTools = "menu" | "icons" | "labeled";

export type ChromePlan = {
  /** How the three chrome regions are arranged. */
  layout: ChromeLayout;
  /** How many tools sit beside search. */
  tools: ChromeTools;
};

/** Breakpoints are against the header's own width (sidebar-safe). */
export const CHROME_PHONE_MAX = 719;
/**
 * Full Persian labeled strip needs ~720px in the actions column. Equal side
 * tracks only give that once the chrome itself is near full HD+ after sidebar.
 */
export const CHROME_LABELED_MIN = 1900;

/**
 * Pedigree toolbar plan from the chrome bar width — never the viewport.
 * Search is overlaid on centered layout (not a third grid track).
 */
export function chromePlanFromWidth(width: number): ChromePlan {
  if (width <= CHROME_PHONE_MAX) {
    return { layout: "stack", tools: "menu" };
  }
  if (width < CHROME_LABELED_MIN) {
    return { layout: "centered", tools: "icons" };
  }
  return { layout: "centered", tools: "labeled" };
}

/**
 * When the actions strip collides with search, fold every inline tool into the
 * overflow menu. Keep search centered (do not switch to the phone stack).
 */
export function chromePlanAfterOverflow(
  plan: ChromePlan,
  overflowed: boolean,
): ChromePlan {
  if (!overflowed || plan.tools === "menu") return plan;
  return {
    layout: plan.layout === "stack" ? "stack" : "centered",
    tools: "menu",
  };
}

export function chromePlanEquals(a: ChromePlan, b: ChromePlan): boolean {
  return a.layout === b.layout && a.tools === b.tools;
}
