export type ExportTheme = {
  background: string;
  surface: string;
  foreground: string;
  muted: string;
  inkSoft: string;
  accent: string;
  accentStrong: string;
  accentMuted: string;
  border: string;
  male: string;
  female: string;
  path: string;
  pathSoft: string;
  spouseAlt: string;
  spouseAltStrong: string;
  spouseAltMuted: string;
};

export type ExportPresetId =
  | "classic"
  | "parchment"
  | "ocean"
  | "garden"
  | "night"
  | "contrast";

export const EXPORT_PRESET_IDS: ExportPresetId[] = [
  "classic",
  "parchment",
  "ocean",
  "garden",
  "night",
  "contrast",
];

export const EXPORT_PRESETS: Record<ExportPresetId, ExportTheme> = {
  classic: {
    background: "#ffffff",
    surface: "#ffffff",
    foreground: "#14191b",
    muted: "#667275",
    inkSoft: "#243033",
    accent: "#0d6e67",
    accentStrong: "#0a5751",
    accentMuted: "#d7ebe8",
    border: "#e3e7e5",
    male: "#2f6fed",
    female: "#b84d7a",
    path: "#d97706",
    pathSoft: "#fef3c7",
    spouseAlt: "#8a4b2b",
    spouseAltStrong: "#6e3a20",
    spouseAltMuted: "#f0ddd0",
  },
  parchment: {
    background: "#f6efe2",
    surface: "#fffdf8",
    foreground: "#2a2218",
    muted: "#7a6d5d",
    inkSoft: "#3f3428",
    accent: "#8b5e34",
    accentStrong: "#6f4726",
    accentMuted: "#ead9c4",
    border: "#e4ddd0",
    male: "#3d6ea8",
    female: "#a14d6d",
    path: "#c2410c",
    pathSoft: "#ffedd5",
    spouseAlt: "#5c6b4a",
    spouseAltStrong: "#445038",
    spouseAltMuted: "#e2e6d8",
  },
  ocean: {
    background: "#eef6fb",
    surface: "#f7fbfe",
    foreground: "#16324a",
    muted: "#5b7386",
    inkSoft: "#1f3d56",
    accent: "#0e7490",
    accentStrong: "#155e75",
    accentMuted: "#cfeaf3",
    border: "#d5e4ee",
    male: "#2563eb",
    female: "#7c3aed",
    path: "#ea580c",
    pathSoft: "#ffedd5",
    spouseAlt: "#b45309",
    spouseAltStrong: "#9a3412",
    spouseAltMuted: "#ffedd5",
  },
  garden: {
    background: "#f3f7ef",
    surface: "#fbfdf8",
    foreground: "#1c2a1d",
    muted: "#667566",
    inkSoft: "#2a3b2c",
    accent: "#3f7a46",
    accentStrong: "#2f5d35",
    accentMuted: "#d9ead6",
    border: "#dde6d8",
    male: "#1d4ed8",
    female: "#be185d",
    path: "#b45309",
    pathSoft: "#fef3c7",
    spouseAlt: "#8a4b2b",
    spouseAltStrong: "#6e3a20",
    spouseAltMuted: "#f0ddd0",
  },
  night: {
    background: "#0c1216",
    surface: "#121b21",
    foreground: "#e8f2f4",
    muted: "#8aa0a9",
    inkSoft: "#c9e0dc",
    accent: "#2dd4bf",
    accentStrong: "#5eead4",
    accentMuted: "#115e59",
    border: "#1e3038",
    male: "#60a5fa",
    female: "#f472b6",
    path: "#fbbf24",
    pathSoft: "#78350f",
    spouseAlt: "#e8a87c",
    spouseAltStrong: "#f0c4a0",
    spouseAltMuted: "#5c3a28",
  },
  contrast: {
    background: "#ffffff",
    surface: "#ffffff",
    foreground: "#111111",
    muted: "#444444",
    inkSoft: "#111111",
    accent: "#000000",
    accentStrong: "#000000",
    accentMuted: "#e5e5e5",
    border: "#111111",
    male: "#0033cc",
    female: "#9d174d",
    path: "#b45309",
    pathSoft: "#fde68a",
    spouseAlt: "#666666",
    spouseAltStrong: "#333333",
    spouseAltMuted: "#eeeeee",
  },
};

export const DEFAULT_EXPORT_THEME = EXPORT_PRESETS.classic;

function parseHex(hex: string): [number, number, number] | null {
  const value = hex.replace("#", "").trim();
  if (value.length !== 6) return null;
  const n = Number.parseInt(value, 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixHex(from: string, toward: string, amount: number): string {
  const a = parseHex(from);
  const b = parseHex(toward);
  if (!a || !b) return from;
  const mix = (i: number) =>
    Math.round(a[i]! + (b[i]! - a[i]!) * amount)
      .toString(16)
      .padStart(2, "0");
  return `#${mix(0)}${mix(1)}${mix(2)}`;
}

export function patchExportTheme(
  theme: ExportTheme,
  key: keyof ExportTheme,
  value: string,
): ExportTheme {
  const next = { ...theme, [key]: value };
  if (key === "accent") {
    next.accentMuted = mixHex(value, theme.background, 0.78);
    next.accentStrong = mixHex(value, "#000000", 0.22);
  }
  if (key === "foreground") {
    next.inkSoft = mixHex(value, theme.background, 0.12);
    next.muted = mixHex(value, theme.background, 0.45);
  }
  if (key === "background") {
    next.border = mixHex(theme.foreground, value, 0.82);
    next.accentMuted = mixHex(theme.accent, value, 0.78);
  }
  return next;
}

const CANVAS_VAR_NAMES = [
  "--background",
  "--surface",
  "--foreground",
  "--muted",
  "--ink-soft",
  "--accent",
  "--accent-strong",
  "--accent-muted",
  "--border",
  "--pedigree-male",
  "--pedigree-female",
  "--pedigree-path",
  "--pedigree-path-soft",
  "--pedigree-spouse-alt",
  "--pedigree-spouse-alt-strong",
  "--pedigree-spouse-alt-muted",
] as const;

export function applyExportTheme(el: HTMLElement, theme: ExportTheme) {
  el.style.setProperty("--background", theme.background);
  el.style.setProperty("--surface", theme.surface);
  el.style.setProperty("--foreground", theme.foreground);
  el.style.setProperty("--muted", theme.muted);
  el.style.setProperty("--ink-soft", theme.inkSoft);
  el.style.setProperty("--accent", theme.accent);
  el.style.setProperty("--accent-strong", theme.accentStrong);
  el.style.setProperty("--accent-muted", theme.accentMuted);
  el.style.setProperty("--border", theme.border);
  el.style.setProperty("--pedigree-male", theme.male);
  el.style.setProperty("--pedigree-female", theme.female);
  el.style.setProperty("--pedigree-path", theme.path);
  el.style.setProperty("--pedigree-path-soft", theme.pathSoft);
  el.style.setProperty("--pedigree-spouse-alt", theme.spouseAlt);
  el.style.setProperty("--pedigree-spouse-alt-strong", theme.spouseAltStrong);
  el.style.setProperty("--pedigree-spouse-alt-muted", theme.spouseAltMuted);
}

export function clearExportTheme(el: HTMLElement) {
  for (const name of CANVAS_VAR_NAMES) {
    el.style.removeProperty(name);
  }
}

export function posterThemeStyle(theme: ExportTheme): Record<string, string> {
  return {
    "--export-paper": theme.background,
    "--export-surface": theme.surface,
    "--export-ink": theme.foreground,
    "--export-muted": theme.muted,
    "--export-ink-soft": theme.inkSoft,
    "--export-accent": theme.accent,
    "--export-accent-muted": theme.accentMuted,
    "--export-border": theme.border,
    "--export-male": theme.male,
    "--export-female": theme.female,
  };
}
