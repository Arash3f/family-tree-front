/**
 * Builds a resolution-independent description of the pedigree for export.
 *
 * The result is SVG markup for everything that scales cleanly (cards, frames,
 * edges, photos) plus a list of text runs that are painted onto the canvas
 * separately. Text is kept out of the SVG on purpose: an SVG loaded through an
 * `<img>` cannot reach the document's webfonts, so Persian text would silently
 * fall back to a default face. Painting it on the canvas keeps Vazirmatn.
 *
 * Coordinates are graph CSS pixels with the graph's top-left corner at (0, 0).
 */

import type { Edge, Node } from "@xyflow/react";

import { formatLocaleDigits } from "@/lib/localeDigits";
import { resolvePersonPhotoUrl } from "@/lib/media";
import {
  ageInYearsAtYear,
  formatDateForLocale,
  isReachedByYear,
} from "@/lib/pedigree/dates";
import type { ExportTheme } from "@/lib/pedigree/export-theme";
import {
  COUPLE_BOX_HEIGHT,
  COUPLE_BOX_WIDTH,
  PERSON_NODE_HEIGHT,
  PERSON_NODE_WIDTH,
  UNION_SIZE,
  nodeAbsolutePosition,
  personDisplayName,
  type CoupleNodeData,
  type PersonNodeData,
} from "@/lib/pedigree/layout";

export type PedigreeExportLabels = {
  born: string;
  died: string;
  age: string;
  gender: string;
  birthPlace: string;
  notYetMarried: string;
  empty: string;
  male: string;
  female: string;
};

export type TextRun = {
  x: number;
  y: number;
  text: string;
  size: number;
  weight: number;
  fill: string;
  /**
   * Physical alignment. Deliberately not `start`/`end`: those flip with the
   * canvas `direction`, which would mirror every card in Persian.
   */
  align: "left" | "right" | "center";
  rtl: boolean;
  /**
   * Horizontal budget in graph pixels. Overlong text is truncated with an
   * ellipsis rather than squeezed, so glyphs keep their real proportions.
   */
  maxWidth?: number;
  opacity?: number;
};

export type PedigreeGraphic = {
  /** SVG children, to be wrapped in a `<svg>` with the desired viewBox. */
  body: string;
  /** Graph size in CSS pixels. */
  width: number;
  height: number;
  texts: TextRun[];
  /** How many person cards the graphic contains, for progress reporting. */
  personCount: number;
};

const PAD = 56;

/** Photos are fetched once per URL and reused across renders. */
const photoCache = new Map<string, string | null>();
/** Bounded so long sessions across many trees cannot grow without limit. */
const PHOTO_CACHE_LIMIT = 400;

export function clearPhotoCache() {
  photoCache.clear();
}

function rememberPhoto(url: string, data: string | null) {
  if (photoCache.size >= PHOTO_CACHE_LIMIT) {
    const oldest = photoCache.keys().next();
    if (!oldest.done) photoCache.delete(oldest.value);
  }
  photoCache.set(url, data);
}

function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function parseHex(hex: string): [number, number, number] | null {
  const value = hex.replace("#", "").trim();
  if (value.length !== 6) return null;
  const n = Number.parseInt(value, 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * `tint("#0d6e67", 14, "#ffffff")` reads as the CSS it mirrors:
 * `color-mix(in srgb, #0d6e67 14%, #ffffff)` — 14% of `color`, the rest `base`.
 *
 * Spelling the percentage the same way as the stylesheet matters: the card
 * styles are built almost entirely from low-percentage tints, and reading them
 * backwards turns a barely-there wash into a fully saturated block.
 */
function tint(color: string, percent: number, base: string): string {
  const a = parseHex(color);
  const b = parseHex(base);
  if (!a || !b) return color;
  const weight = Math.min(100, Math.max(0, percent)) / 100;
  const channel = (i: number) =>
    Math.round(a[i]! * weight + b[i]! * (1 - weight))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

/** Perceived lightness, used to pick colours that only exist per theme mode. */
function isDark(color: string): boolean {
  const rgb = parseHex(color);
  if (!rgb) return false;
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] < 128;
}

/** `--danger` is not part of the export palette, so follow the background. */
function dangerFor(theme: ExportTheme): string {
  return isDark(theme.background) ? "#f87171" : "#b42318";
}

function nodeSize(node: Node): { w: number; h: number } {
  if (node.type === "person") {
    return { w: PERSON_NODE_WIDTH, h: PERSON_NODE_HEIGHT };
  }
  if (node.type === "couple") {
    return { w: COUPLE_BOX_WIDTH, h: COUPLE_BOX_HEIGHT };
  }
  return { w: UNION_SIZE, h: UNION_SIZE };
}

function graphBounds(nodes: Node[], byId: Map<string, Node>) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    if (node.hidden) continue;
    const p = nodeAbsolutePosition(node, byId);
    const { w, h } = nodeSize(node);
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + w);
    maxY = Math.max(maxY, p.y + h);
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, width: 800, height: 600 };
  }
  return {
    minX: minX - PAD,
    minY: minY - PAD,
    width: Math.max(400, maxX - minX + PAD * 2),
    height: Math.max(300, maxY - minY + PAD * 2),
  };
}

function handlePoint(
  node: Node,
  handle: string | null | undefined,
  byId: Map<string, Node>,
): { x: number; y: number } {
  const p = nodeAbsolutePosition(node, byId);
  const { w, h } = nodeSize(node);
  switch (handle) {
    case "parent":
    case "in":
    case "top":
      return { x: p.x + w / 2, y: p.y };
    case "child":
    case "out":
    case "bottom":
      return { x: p.x + w / 2, y: p.y + h };
    case "spouse-in":
    case "left":
      return { x: p.x, y: p.y + h / 2 };
    case "spouse-out":
    case "right":
      return { x: p.x + w, y: p.y + h / 2 };
    default:
      return { x: p.x + w / 2, y: p.y + h / 2 };
  }
}

function smoothstepPath(x1: number, y1: number, x2: number, y2: number): string {
  const midY = (y1 + y2) / 2;
  const radius = Math.min(12, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2);
  if (radius < 2) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const dir = x2 >= x1 ? 1 : -1;
  return [
    `M ${x1} ${y1}`,
    `L ${x1} ${midY - radius}`,
    `Q ${x1} ${midY} ${x1 + dir * radius} ${midY}`,
    `L ${x2 - dir * radius} ${midY}`,
    `Q ${x2} ${midY} ${x2} ${midY + radius}`,
    `L ${x2} ${y2}`,
  ].join(" ");
}

function resolveStroke(stroke: string | undefined, theme: ExportTheme): string {
  if (!stroke) return theme.muted;
  if (stroke.startsWith("#")) return stroke;
  if (stroke.includes("pedigree-path")) return theme.path;
  if (stroke.includes("pedigree-spouse-alt-strong")) return theme.spouseAltStrong;
  if (stroke.includes("pedigree-spouse-alt")) return theme.spouseAlt;
  if (stroke.includes("accent-strong")) return theme.accentStrong;
  if (stroke.includes("--accent")) return theme.accent;
  if (stroke.includes("--border") || stroke.includes("color-mix")) {
    return tint(theme.border, 70, theme.background);
  }
  return theme.muted;
}

function genderAccent(gender: string, theme: ExportTheme): string {
  if (gender === "male") return theme.male;
  if (gender === "female") return theme.female;
  return theme.accent;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2);
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`;
}

function formatPersonDate(
  value: string | null,
  locale: string,
  empty: string,
): string {
  if (!value) return empty;
  return formatLocaleDigits(formatDateForLocale(value, locale), locale);
}

/** Nodes that belong in an export: the visible graph, or only the relation path. */
export function selectExportNodes(nodes: Node[], pathIds: Set<string>): Node[] {
  const visible = nodes.filter((node) => !node.hidden);
  if (pathIds.size === 0) return visible;

  const keep = new Set<string>();
  for (const node of visible) {
    if (node.type === "person") {
      const data = node.data as PersonNodeData;
      if (data.onPath || pathIds.has(node.id)) {
        keep.add(node.id);
        if (node.parentId) keep.add(node.parentId);
      }
      continue;
    }
    if (node.type === "union" || node.type === "couple") {
      const data = node.data as UnionNodeData;
      if (data.onPath) keep.add(node.id);
    }
  }
  return visible.filter((node) => keep.has(node.id));
}

type UnionNodeData = { onPath?: boolean; onAltPath?: boolean };

function personCard(
  node: Node<PersonNodeData>,
  ox: number,
  oy: number,
  theme: ExportTheme,
  locale: string,
  labels: PedigreeExportLabels,
  asOfYear: number | null,
  photos: Map<string, string>,
): { svg: string; texts: TextRun[] } {
  const d = node.data;
  const person = d.person;
  const rtl = locale === "fa";
  const opacity = d.dimmed ? 0.28 : person.death_date ? 0.92 : 1;
  const accent = d.onPath ? theme.path : genderAccent(person.gender, theme);
  const surface = theme.surface;
  // Mirrors `.node` and `.onPath` in PersonNode.module.css.
  const fillTop = d.onPath
    ? tint(theme.path, 22, surface)
    : tint(accent, 14, surface);
  const fillMid = d.onPath ? tint(theme.pathSoft, 55, surface) : surface;
  const border = d.onPath ? theme.path : tint(accent, 22, theme.border);
  const name = personDisplayName(person);
  const photoUrl = resolvePersonPhotoUrl(person.photo_url, person.photo_object_key);
  const photo = photoUrl ? photos.get(photoUrl) : null;
  const age = ageInYearsAtYear(
    person.birth_date,
    person.death_date,
    asOfYear,
    locale,
  );
  const ageText = age != null ? formatLocaleDigits(age, locale) : "";
  const genderLabel = person.gender === "female" ? labels.female : labels.male;
  const birthDate = formatPersonDate(person.birth_date, locale, labels.empty);
  const birthPlace = person.birth_place?.trim() || labels.empty;
  const deathDate = person.death_date
    ? formatPersonDate(person.death_date, locale, labels.empty)
    : null;

  const pad = 10;
  const avatarR = 18;
  const avatarCx = rtl ? ox + PERSON_NODE_WIDTH - pad - avatarR : ox + pad + avatarR;
  const avatarCy = oy + pad + avatarR;
  const ageW = 30;
  const ageH = 22;
  const ageX = rtl ? ox + pad : ox + PERSON_NODE_WIDTH - pad - ageW;
  const ageY = oy + pad + 7;
  const nameRight = rtl
    ? avatarCx - avatarR - 8
    : ox + PERSON_NODE_WIDTH - pad - (ageText ? ageW + 8 : 0);
  const nameLeft = rtl
    ? ox + pad + (ageText ? ageW + 8 : 0)
    : avatarCx + avatarR + 8;
  const factsX = ox + pad;
  const factsW = PERSON_NODE_WIDTH - pad * 2;
  const factsY = oy + 52;
  const factsH = PERSON_NODE_HEIGHT - 62;
  const gid = `n-${node.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const texts: TextRun[] = [];

  if (!photo) {
    texts.push({
      x: avatarCx,
      y: avatarCy + 4,
      text: initialsOf(person.name),
      size: 11,
      weight: 700,
      fill: accent,
      align: "center",
      rtl,
      opacity,
    });
  }
  texts.push({
    x: rtl ? nameRight : nameLeft,
    y: oy + 32,
    text: name,
    size: 13.5,
    weight: 700,
    fill: theme.foreground,
    align: rtl ? "right" : "left",
    rtl,
    maxWidth: Math.max(24, nameRight - nameLeft),
    opacity,
  });
  if (ageText) {
    texts.push({
      x: ageX + ageW / 2,
      y: ageY + 16,
      text: ageText,
      size: 11,
      weight: 700,
      fill: accent,
      align: "center",
      rtl: false,
      opacity,
    });
  }

  /** Extra shapes that belong inside the facts panel, such as the gender pill. */
  const decorations: string[] = [];

  const fact = (
    y: number,
    label: string,
    value: string,
    options: { empty?: boolean; death?: boolean; pill?: string } = {},
  ) => {
    // `.deathFact .factValue` and `.factEmpty`, resolved against the surface.
    const color = options.death
      ? tint(dangerFor(theme), 72, theme.muted)
      : theme.inkSoft;
    const valueColor = options.empty ? tint(theme.muted, 70, surface) : color;
    const labelX = rtl ? factsX + factsW - 8 : factsX + 8;
    const valueX = rtl ? factsX + 8 : factsX + factsW - 8;
    texts.push({
      x: labelX,
      y,
      text: label,
      size: 10,
      weight: 600,
      fill: theme.muted,
      align: rtl ? "right" : "left",
      rtl,
      maxWidth: 72,
      opacity,
    });

    if (options.pill) {
      // `.genderBadge`: a rounded chip carrying the value in its own colour.
      const pillW = 46;
      const pillH = 15;
      const pillX = rtl ? valueX : valueX - pillW;
      decorations.push(
        `<rect x="${pillX}" y="${y - 11}" width="${pillW}" height="${pillH}" rx="7.5" fill="${tint(options.pill, 14, surface)}"/>`,
      );
      texts.push({
        x: pillX + pillW / 2,
        y,
        text: value,
        size: 10,
        weight: 700,
        fill: options.pill,
        align: "center",
        rtl,
        maxWidth: pillW - 8,
        opacity,
      });
      return;
    }

    texts.push({
      x: valueX,
      y,
      text: value,
      size: 10,
      weight: 600,
      fill: valueColor,
      align: rtl ? "left" : "right",
      rtl,
      maxWidth: factsW - 88,
      opacity,
    });
  };

  // The folded-branch chip, so a trimmed export still admits what it left out.
  const collapsedCount = d.collapsedCount ?? 0;
  if (collapsedCount > 0) {
    const chipW = 58;
    const chipH = 19;
    const chipX = ox + PERSON_NODE_WIDTH / 2 - chipW / 2;
    const chipY = oy + PERSON_NODE_HEIGHT - 28;
    decorations.push(
      `<rect x="${chipX}" y="${chipY}" width="${chipW}" height="${chipH}" rx="9.5" fill="${tint(accent, 14, surface)}" stroke="${tint(accent, 40, theme.border)}" stroke-dasharray="4 3"/>`,
    );
    texts.push({
      x: chipX + chipW / 2,
      y: chipY + 13,
      text: `+${formatLocaleDigits(collapsedCount, locale)}`,
      size: 10,
      weight: 800,
      fill: accent,
      align: "center",
      rtl: false,
      opacity,
    });
  }

  fact(factsY + 20, labels.gender, genderLabel, {
    pill: genderAccent(person.gender, theme),
  });
  fact(factsY + 40, labels.born, birthDate, { empty: !person.birth_date });
  fact(factsY + 60, labels.birthPlace, birthPlace, {
    empty: !person.birth_place?.trim(),
  });
  if (deathDate) fact(factsY + 80, labels.died, deathDate, { death: true });

  // `.avatar`: a tinted disc, or the photo clipped into it.
  const avatar = photo
    ? `<image href="${xml(photo)}" x="${avatarCx - avatarR}" y="${avatarCy - avatarR}" width="36" height="36" preserveAspectRatio="xMidYMid slice" clip-path="url(#av-${gid})"/>`
    : `<circle cx="${avatarCx}" cy="${avatarCy}" r="${avatarR}" fill="${tint(accent, 16, surface)}" stroke="${tint(accent, 24, surface)}" stroke-width="1"/>`;

  const svg = `
  <g opacity="${opacity}">
    <defs>
      <clipPath id="av-${gid}"><circle cx="${avatarCx}" cy="${avatarCy}" r="${avatarR}"/></clipPath>
      <linearGradient id="bg-${gid}" x1="0" y1="0" x2="0.18" y2="1">
        <stop offset="0" stop-color="${fillTop}"/>
        <stop offset="0.4" stop-color="${fillMid}"/>
        <stop offset="1" stop-color="${surface}"/>
      </linearGradient>
      <linearGradient id="rule-${gid}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${accent}" stop-opacity="0"/>
        <stop offset="0.5" stop-color="${accent}" stop-opacity="0.78"/>
        <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect x="${ox}" y="${oy}" width="${PERSON_NODE_WIDTH}" height="${PERSON_NODE_HEIGHT}" rx="16.8" fill="url(#bg-${gid})" stroke="${border}" stroke-width="${d.onPath ? 2.2 : 1}"/>
    <rect x="${ox + 14}" y="${oy}" width="${PERSON_NODE_WIDTH - 28}" height="2.5" rx="2" fill="url(#rule-${gid})"/>
    ${avatar}
    ${
      ageText
        ? `<rect x="${ageX}" y="${ageY}" width="${ageW}" height="${ageH}" rx="11" fill="${tint(accent, 18, surface)}" stroke="${tint(accent, 30, surface)}"/>`
        : ""
    }
    <rect x="${factsX}" y="${factsY}" width="${factsW}" height="${factsH}" rx="11" fill="${tint(accent, 7, surface)}" stroke="${tint(accent, 12, theme.border)}"/>
    ${decorations.join("\n    ")}
  </g>`;

  return { svg, texts };
}

function coupleFrame(
  node: Node<CoupleNodeData>,
  ox: number,
  oy: number,
  theme: ExportTheme,
  locale: string,
  labels: PedigreeExportLabels,
  asOfYear: number | null,
): { svg: string; texts: TextRun[] } {
  const d = node.data;
  const rtl = locale === "fa";
  const unmarried =
    asOfYear !== null && !isReachedByYear(d.marriedAt, asOfYear, locale);
  const date = d.marriedAt
    ? formatLocaleDigits(formatDateForLocale(d.marriedAt, locale), locale)
    : "";
  const opacity = d.dimmed ? 0.32 : 1;
  const onPath = d.onPath;
  const boxW = node.width ?? COUPLE_BOX_WIDTH;
  const boxH = node.height ?? COUPLE_BOX_HEIGHT;
  const accent = d.tone === "secondary" ? theme.spouseAlt : theme.accent;
  const accentMuted =
    d.tone === "secondary" ? theme.spouseAltMuted : theme.accentMuted;
  const chromeX =
    typeof d.chromeAt === "number" && Number.isFinite(d.chromeAt)
      ? Math.min(1, Math.max(0, d.chromeAt))
      : 0.5;
  // Mirrors `.frame`, `.divorced`, `.unmarried` and `.onPath` in
  // CoupleNode.module.css.
  const border = onPath
    ? theme.path
    : unmarried
      ? tint(theme.muted, 62, theme.border)
      : d.divorced
        ? tint(theme.muted, 55, theme.border)
        : tint(accent, 30, theme.border);
  const dash = unmarried || d.divorced ? "6 5" : undefined;
  const fillTop = onPath
    ? tint(theme.path, 18, theme.surface)
    : tint(accentMuted, 58, theme.surface);
  const fillMid = onPath
    ? tint(theme.pathSoft, 42, theme.surface)
    : tint(theme.surface, 88, accentMuted);
  const cx = ox + boxW * chromeX;
  const badgeY = oy + boxH - 18;
  const texts: TextRun[] = [];
  if (unmarried) {
    texts.push({
      x: cx,
      y: oy + boxH / 2 + 4,
      text: labels.notYetMarried,
      size: 11,
      weight: 700,
      fill: theme.muted,
      align: "center",
      rtl,
      maxWidth: 110,
      opacity,
    });
  }
  if (date) {
    texts.push({
      x: cx,
      y: badgeY + 3,
      text: date,
      size: 10,
      weight: 700,
      fill: unmarried || d.divorced
        ? theme.muted
        : tint(accent, 72, theme.inkSoft),
      align: "center",
      rtl: false,
      maxWidth: 100,
      opacity,
    });
  }

  const gid = `c-${node.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const dateFill = unmarried || d.divorced
    ? tint(theme.surface, 92, theme.muted)
    : tint(theme.surface, 88, accentMuted);
  const dateStroke = unmarried || d.divorced
    ? tint(theme.muted, 35, theme.border)
    : tint(accent, 22, theme.border);

  const svg = `
  <g opacity="${opacity}">
    <defs>
      <linearGradient id="cf-${gid}" x1="0" y1="0" x2="0.26" y2="1">
        <stop offset="0" stop-color="${fillTop}"/>
        <stop offset="0.55" stop-color="${fillMid}"/>
        <stop offset="1" stop-color="${theme.surface}"/>
      </linearGradient>
    </defs>
    <rect x="${ox}" y="${oy}" width="${boxW}" height="${boxH}" rx="22" fill="${unmarried ? tint(theme.surface, 94, theme.muted) : `url(#cf-${gid})`}" stroke="${border}" stroke-width="${onPath ? 2 : 1.5}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>
    ${
      unmarried
        ? `<line x1="${cx}" y1="${oy + 12}" x2="${cx}" y2="${oy + boxH - 12}" stroke="${tint(theme.muted, 68, theme.border)}" stroke-width="1.5" stroke-dasharray="5 4"/>
           <rect x="${cx - 58}" y="${oy + boxH / 2 - 14}" width="116" height="24" rx="10" fill="${tint(theme.surface, 94, theme.muted)}" stroke="${tint(theme.muted, 55, theme.border)}" stroke-dasharray="4 3"/>`
        : `<circle cx="${cx}" cy="${oy + 33}" r="5.5" fill="${theme.surface}" stroke="${onPath ? theme.path : d.divorced ? theme.muted : tint(accent, 58, theme.border)}" stroke-width="2"/>`
    }
    ${
      date
        ? `<rect x="${cx - 52}" y="${badgeY - 10}" width="104" height="18" rx="9" fill="${dateFill}" stroke="${dateStroke}"/>`
        : ""
    }
  </g>`;

  return { svg, texts };
}

function unionDot(
  node: Node<CoupleNodeData>,
  ox: number,
  oy: number,
  theme: ExportTheme,
  locale: string,
  asOfYear: number | null,
): string {
  const d = node.data;
  const unmarried =
    asOfYear !== null && !isReachedByYear(d.marriedAt, asOfYear, locale);
  const r = UNION_SIZE / 2;
  const cx = ox + r;
  const cy = oy + r;
  const accent = d.tone === "secondary" ? theme.spouseAlt : theme.accent;
  const fill = d.onPath
    ? theme.path
    : unmarried
      ? "none"
      : d.divorced
        ? theme.muted
        : accent;
  // Mirrors `.union` and its variants in UnionNode.module.css.
  const stroke = d.onPath
    ? tint(theme.surface, 70, theme.path)
    : unmarried
      ? tint(theme.muted, 70, theme.border)
      : d.divorced
        ? tint(theme.surface, 70, theme.muted)
        : tint(theme.surface, 80, accent);
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill === "none" ? "transparent" : fill}" stroke="${stroke}" stroke-width="2"${unmarried ? ' stroke-dasharray="3 2"' : ""} opacity="${d.dimmed ? 0.35 : 1}"/>`;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("file-reader"));
    reader.readAsDataURL(blob);
  });
}

async function fetchDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { credentials: "omit", mode: "cors" });
    if (!res.ok) return null;
    return blobToDataUrl(await res.blob());
  } catch {
    return null;
  }
}

async function collectPhotos(nodes: Node[]): Promise<Map<string, string>> {
  const urls = new Set<string>();
  for (const node of nodes) {
    if (node.type !== "person") continue;
    const person = (node.data as PersonNodeData).person;
    const url = resolvePersonPhotoUrl(person.photo_url, person.photo_object_key);
    if (url) urls.add(url);
  }
  await Promise.all(
    [...urls].map(async (url) => {
      // Only successful fetches are cached; a transient failure must not
      // disable a photo for the rest of the session.
      if (photoCache.get(url)) return;
      const data = await fetchDataUrl(url);
      if (data) rememberPhoto(url, data);
    }),
  );
  const out = new Map<string, string>();
  for (const url of urls) {
    const data = photoCache.get(url);
    if (data) out.set(url, data);
  }
  return out;
}

export async function buildPedigreeGraphic(opts: {
  nodes: Node[];
  edges: Edge[];
  pathIds: Set<string>;
  theme: ExportTheme;
  locale: string;
  labels: PedigreeExportLabels;
  asOfYear: number | null;
  includePhotos: boolean;
}): Promise<PedigreeGraphic> {
  const exportNodes = selectExportNodes(opts.nodes, opts.pathIds);
  if (exportNodes.length === 0) throw new Error("nothing-to-export");

  const keep = new Set(exportNodes.map((n) => n.id));
  const exportEdges = opts.edges.filter(
    (e) => !e.hidden && keep.has(e.source) && keep.has(e.target),
  );
  const byId = new Map(opts.nodes.map((n) => [n.id, n]));
  const bounds = graphBounds(exportNodes, byId);
  const photos = opts.includePhotos
    ? await collectPhotos(exportNodes)
    : new Map<string, string>();
  const texts: TextRun[] = [];

  const edgeMarkup = exportEdges
    .map((e) => {
      const source = byId.get(e.source);
      const target = byId.get(e.target);
      if (!source || !target) return "";
      const a = handlePoint(source, e.sourceHandle, byId);
      const t = handlePoint(target, e.targetHandle, byId);
      const x1 = a.x - bounds.minX;
      const y1 = a.y - bounds.minY;
      const x2 = t.x - bounds.minX;
      const y2 = t.y - bounds.minY;
      const d =
        e.type === "straight"
          ? `M ${x1} ${y1} L ${x2} ${y2}`
          : smoothstepPath(x1, y1, x2, y2);
      const stroke = resolveStroke(e.style?.stroke as string | undefined, opts.theme);
      const width = Number(e.style?.strokeWidth ?? 1.7);
      const opacity = Number(e.style?.opacity ?? 1);
      const dash = e.style?.strokeDasharray
        ? ` stroke-dasharray="${e.style.strokeDasharray}"`
        : "";
      return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"${dash}/>`;
    })
    .join("\n");

  // Couple frames sit behind their members; union dots sit between the two.
  const drawOrder = (type?: string) =>
    type === "couple" ? 0 : type === "person" ? 2 : 1;
  const sorted = [...exportNodes].sort(
    (a, z) => drawOrder(a.type) - drawOrder(z.type),
  );

  let personCount = 0;
  const nodeMarkup = sorted
    .map((node) => {
      const p = nodeAbsolutePosition(node, byId);
      const ox = p.x - bounds.minX;
      const oy = p.y - bounds.minY;
      if (node.type === "person") {
        personCount += 1;
        const card = personCard(
          node as Node<PersonNodeData>,
          ox,
          oy,
          opts.theme,
          opts.locale,
          opts.labels,
          opts.asOfYear,
          photos,
        );
        texts.push(...card.texts);
        return card.svg;
      }
      if (node.type === "couple") {
        const frame = coupleFrame(
          node as Node<CoupleNodeData>,
          ox,
          oy,
          opts.theme,
          opts.locale,
          opts.labels,
          opts.asOfYear,
        );
        texts.push(...frame.texts);
        return frame.svg;
      }
      return unionDot(
        node as Node<CoupleNodeData>,
        ox,
        oy,
        opts.theme,
        opts.locale,
        opts.asOfYear,
      );
    })
    .join("\n");

  return {
    body: `<g>${edgeMarkup}</g>\n<g>${nodeMarkup}</g>`,
    width: bounds.width,
    height: bounds.height,
    texts,
    personCount,
  };
}
