/**
 * Minimal multi-page PDF writer for image-per-page documents.
 *
 * Pedigree exports are rasterised one page at a time, so a PDF here is just a
 * sequence of pages that each place a single image inside their margins. That
 * keeps the writer small enough to audit while still producing files that open
 * in Acrobat, Preview, and browser viewers.
 *
 * Coordinates are accepted in points measured from the page's *top-left*, which
 * matches how the page planner thinks, and converted to PDF's bottom-left
 * origin on the way out.
 */

export type PdfImageFilter = "DCTDecode" | "FlateDecode";

export type PdfImage = {
  bytes: Uint8Array;
  pixelWidth: number;
  pixelHeight: number;
  filter: PdfImageFilter;
};

export type PdfPage = {
  widthPt: number;
  heightPt: number;
  image: PdfImage;
  /** Placement in points from the top-left corner of the page. */
  xPt: number;
  yPt: number;
  drawWidthPt: number;
  drawHeightPt: number;
};

export type PdfMetadata = {
  title?: string;
  creator?: string;
};

/** PDF caps any page edge at 200 inches. */
export const PDF_MAX_PAGE_SIDE_PT = 14400;

const encoder = new TextEncoder();

function concatBytes(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Round to two decimals; PDF operators do not need more and it shrinks output. */
function pt(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function pdfText(value: string): string {
  // Keep to printable ASCII; anything else would need a UTF-16BE string.
  const ascii = value.replace(/[^\x20-\x7e]/g, "");
  return ascii.replace(/([\\()])/g, "\\$1");
}

/**
 * Deflate with a zlib wrapper, which is what `/FlateDecode` expects.
 * `CompressionStream("deflate")` emits zlib; `"deflate-raw"` would not.
 */
export async function deflateBytes(input: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([
    input.slice().buffer as ArrayBuffer,
  ]).stream().pipeThrough(new CompressionStream("deflate"));
  const compressed = await new Response(stream).arrayBuffer();
  return new Uint8Array(compressed);
}

export function buildPdf(pages: PdfPage[], meta: PdfMetadata = {}): Blob {
  if (pages.length === 0) throw new Error("pdf-empty");

  // Object ids are handed out in the order objects are appended, so the xref
  // offsets stay aligned with the numbering without any bookkeeping by hand.
  const bodies: { id: number; bytes: Uint8Array }[] = [];
  let nextId = 1;
  const reserve = () => nextId++;
  const emit = (id: number, dict: string, stream?: Uint8Array) => {
    bodies.push({
      id,
      bytes: stream
        ? concatBytes([
            encoder.encode(`${id} 0 obj\n${dict}\nstream\n`),
            stream,
            encoder.encode("\nendstream\nendobj\n"),
          ])
        : encoder.encode(`${id} 0 obj\n${dict}\nendobj\n`),
    });
  };

  const catalogId = reserve();
  const pagesId = reserve();
  const pageIds = pages.map(() => reserve());
  const infoId = reserve();

  emit(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  emit(
    pagesId,
    `<< /Type /Pages /Kids [${pageIds
      .map((id) => `${id} 0 R`)
      .join(" ")}] /Count ${pages.length} >>`,
  );

  pages.forEach((page, index) => {
    const imageId = reserve();
    const contentId = reserve();
    const { image } = page;

    // PDF's y axis points up, so flip the requested top-left placement.
    const y = page.heightPt - page.yPt - page.drawHeightPt;
    const content = encoder.encode(
      `q ${pt(page.drawWidthPt)} 0 0 ${pt(page.drawHeightPt)} ${pt(page.xPt)} ${pt(
        y,
      )} cm /Im0 Do Q\n`,
    );

    emit(
      pageIds[index]!,
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pt(
        page.widthPt,
      )} ${pt(page.heightPt)}] /Resources << /XObject << /Im0 ${imageId} 0 R >> ` +
        `/ProcSet [/PDF /ImageC] >> /Contents ${contentId} 0 R >>`,
    );
    emit(
      imageId,
      `<< /Type /XObject /Subtype /Image /Width ${image.pixelWidth} ` +
        `/Height ${image.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 ` +
        `/Filter /${image.filter} /Length ${image.bytes.length} >>`,
      image.bytes,
    );
    emit(contentId, `<< /Length ${content.length} >>`, content);
  });

  emit(
    infoId,
    `<< /Title (${pdfText(meta.title ?? "Pedigree")}) /Producer (${pdfText(
      meta.creator ?? "Family Tree",
    )}) >>`,
  );

  // "%PDF" then a comment of high bytes, marking the file as binary. These must
  // be raw bytes rather than UTF-8 encoded code points.
  const header = concatBytes([
    encoder.encode("%PDF-1.4\n%"),
    new Uint8Array([0xe2, 0xe3, 0xcf, 0xd3]),
    encoder.encode("\n"),
  ]);

  const ordered = [...bodies].sort((a, b) => a.id - b.id);
  const offsetById = new Map<number, number>();
  let cursor = header.length;
  for (const body of ordered) {
    offsetById.set(body.id, cursor);
    cursor += body.bytes.length;
  }

  const size = nextId;
  let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let id = 1; id < size; id += 1) {
    xref += `${String(offsetById.get(id) ?? 0).padStart(10, "0")} 00000 n \n`;
  }
  const trailer =
    `trailer\n<< /Size ${size} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\n` +
    `startxref\n${cursor}\n%%EOF\n`;

  const bytes = concatBytes([
    header,
    ...ordered.map((body) => body.bytes),
    encoder.encode(xref + trailer),
  ]);
  // Copy into a standalone buffer so the Blob does not alias a larger view.
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: "application/pdf" });
}
