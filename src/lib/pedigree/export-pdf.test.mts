import assert from "node:assert/strict";
import test from "node:test";

import { buildPdf, deflateBytes, type PdfPage } from "./export-pdf.ts";

const decoder = new TextDecoder("latin1");

function fakeImage(seed: number, length = 64) {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) bytes[i] = (seed * 31 + i * 7) % 256;
  return bytes;
}

function page(index: number, overrides: Partial<PdfPage> = {}): PdfPage {
  return {
    widthPt: 841.89,
    heightPt: 595.28,
    xPt: 24,
    yPt: 24,
    drawWidthPt: 793.89,
    drawHeightPt: 547.28,
    image: {
      bytes: fakeImage(index + 1),
      pixelWidth: 200,
      pixelHeight: 140,
      filter: "DCTDecode",
    },
    ...overrides,
  };
}

async function readPdf(pages: PdfPage[], meta?: { title?: string }) {
  const blob = buildPdf(pages, meta);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { blob, bytes, text: decoder.decode(bytes) };
}

/** Offsets from the xref table, keyed by object number. Skips the free entry. */
function xrefOffsets(text: string): Map<number, number> {
  const start = text.lastIndexOf("xref\n0 ");
  assert.ok(start > 0, "xref table present");
  const lines = text.slice(start).split("\n");
  const declared = Number(lines[1]!.split(" ")[1]);
  const offsets = new Map<number, number>();
  // lines[0] is "xref", lines[1] the subsection header, lines[2] the free entry.
  for (let id = 1; id < declared; id += 1) {
    const row = lines[2 + id]!;
    assert.match(row, /^\d{10} \d{5} n $/, `row for object ${id}: "${row}"`);
    offsets.set(id, Number(row.slice(0, 10)));
  }
  return offsets;
}

function assertObjectsResolve(bytes: Uint8Array, text: string) {
  assert.match(text, /^0000000000 65535 f $/m, "free entry present");
  const offsets = xrefOffsets(text);
  const size = Number(text.match(/\/Size (\d+)/)![1]);
  assert.equal(offsets.size, size - 1, "one entry per object");
  for (const [id, offset] of offsets) {
    assert.ok(offset > 0, `object ${id} has a non-zero offset`);
    const expected = `${id} 0 obj`;
    const actual = decoder.decode(bytes.slice(offset, offset + expected.length));
    assert.equal(actual, expected, `xref entry ${id} points at "${actual}"`);
  }
}

test("rejects an empty document", () => {
  assert.throws(() => buildPdf([]), /pdf-empty/);
});

test("produces a well-formed header, trailer, and mime type", async () => {
  const { blob, text } = await readPdf([page(0)]);
  assert.equal(blob.type, "application/pdf");
  assert.ok(text.startsWith("%PDF-1.4\n"), "starts with the version header");
  assert.ok(text.trimEnd().endsWith("%%EOF"), "ends with the EOF marker");
  assert.match(text, /\/Type \/Catalog/);
  assert.match(text, /\/Type \/Pages/);
});

test("the binary marker is written as raw high bytes", async () => {
  const { bytes } = await readPdf([page(0)]);
  const marker = bytes.slice(10, 14);
  assert.deepEqual([...marker], [0xe2, 0xe3, 0xcf, 0xd3]);
});

test("every xref offset points at the object it claims", async () => {
  for (const count of [1, 3, 12]) {
    const pages = Array.from({ length: count }, (_, i) => page(i));
    const { bytes, text } = await readPdf(pages);
    assertObjectsResolve(bytes, text);
  }
});

test("startxref points at the xref keyword", async () => {
  const { bytes, text } = await readPdf([page(0), page(1)]);
  const match = text.match(/startxref\n(\d+)\n%%EOF/);
  assert.ok(match, "startxref present");
  const offset = Number(match![1]);
  assert.equal(decoder.decode(bytes.slice(offset, offset + 4)), "xref");
});

test("page count and page objects match the input", async () => {
  for (const count of [1, 2, 7, 40]) {
    const pages = Array.from({ length: count }, (_, i) => page(i));
    const { text } = await readPdf(pages);
    assert.match(text, new RegExp(`/Count ${count}\\b`), `count for ${count}`);
    const pageObjects = text.match(/\/Type \/Page[^s]/g) ?? [];
    assert.equal(pageObjects.length, count, `page objects for ${count}`);
    const kids = text.match(/\/Kids \[([^\]]*)\]/);
    assert.ok(kids);
    assert.equal(kids![1]!.trim().split(/\s+0 R/).filter(Boolean).length, count);
  }
});

test("image bytes survive verbatim, including bytes that look like markup", async () => {
  const tricky = new Uint8Array([
    ...fakeImage(3, 16),
    ...new TextEncoder().encode("endstream\nendobj\n>>"),
    ...fakeImage(9, 16),
  ]);
  const { bytes, text } = await readPdf([
    page(0, {
      image: {
        bytes: tricky,
        pixelWidth: 10,
        pixelHeight: 10,
        filter: "FlateDecode",
      },
    }),
  ]);
  assert.match(text, new RegExp(`/Length ${tricky.length}\\b`));

  // Locate the stream by its declared length rather than by searching content.
  const marker = `/Length ${tricky.length} >>\nstream\n`;
  const start = text.indexOf(marker) + marker.length;
  const stored = bytes.slice(start, start + tricky.length);
  assert.deepEqual([...stored], [...tricky], "stream bytes are unmodified");
});

test("placement is flipped to PDF's bottom-left origin", async () => {
  const { text } = await readPdf([
    page(0, {
      heightPt: 600,
      yPt: 40,
      drawHeightPt: 500,
      drawWidthPt: 700,
      xPt: 30,
    }),
  ]);
  // 600 - 40 - 500 = 60 up from the bottom edge.
  assert.match(text, /q 700 0 0 500 30 60 cm \/Im0 Do Q/);
});

test("image dictionaries carry the declared pixel size and filter", async () => {
  const { text } = await readPdf([
    page(0, {
      image: {
        bytes: fakeImage(1),
        pixelWidth: 3172,
        pixelHeight: 2205,
        filter: "FlateDecode",
      },
    }),
  ]);
  assert.match(text, /\/Width 3172/);
  assert.match(text, /\/Height 2205/);
  assert.match(text, /\/Filter \/FlateDecode/);
  assert.match(text, /\/ColorSpace \/DeviceRGB/);
  assert.match(text, /\/BitsPerComponent 8/);
});

test("metadata is written and non-ascii is dropped rather than corrupting syntax", async () => {
  const { text } = await readPdf([page(0)], { title: "شجره‌نامه (test) \\ x" });
  const match = text.match(/\/Title \((.*?)\) \/Producer/);
  assert.ok(match, "title present");
  const title = match![1]!;
  assert.ok(!/[^\x20-\x7e]/.test(title), `no raw non-ascii bytes in "${title}"`);
  // Parentheses and backslashes must be escaped to keep the string literal valid.
  assert.equal(title.trim(), "\\(test\\) \\\\ x");
});

test("pages are independent: each gets its own image object", async () => {
  const { text } = await readPdf([page(0), page(1), page(2)]);
  const images = text.match(/\/Subtype \/Image/g) ?? [];
  assert.equal(images.length, 3);
  const xobjects = text.match(/\/XObject << \/Im0 (\d+) 0 R >>/g) ?? [];
  assert.equal(xobjects.length, 3);
  assert.equal(new Set(xobjects).size, 3, "each page references a distinct object");
});

test("deflateBytes output round-trips and is zlib-wrapped for FlateDecode", async () => {
  const input = new Uint8Array(20_000);
  for (let i = 0; i < input.length; i += 1) input[i] = i % 251;
  const packed = await deflateBytes(input);
  assert.ok(packed.length < input.length, "compression actually shrinks the data");
  // zlib header: CM=8 in the low nibble of byte 0, and a valid FCHECK.
  assert.equal(packed[0]! & 0x0f, 8, "deflate compression method");
  assert.equal(((packed[0]! << 8) | packed[1]!) % 31, 0, "valid zlib FCHECK");

  const restored = new Uint8Array(
    await new Response(
      new Blob([packed.slice().buffer as ArrayBuffer])
        .stream()
        .pipeThrough(new DecompressionStream("deflate")),
    ).arrayBuffer(),
  );
  assert.deepEqual([...restored], [...input], "round-trips losslessly");
});

test("a large document stays structurally consistent", async () => {
  const pages = Array.from({ length: 60 }, (_, i) => page(i));
  const { bytes, text } = await readPdf(pages);
  const size = Number(text.match(/\/Size (\d+)/)![1]);
  // free entry + catalog + pages + info + 60 x (page, image, contents)
  assert.equal(size, 1 + 3 + 60 * 3);
  assertObjectsResolve(bytes, text);
});
