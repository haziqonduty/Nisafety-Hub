// Browser-only PDF compression: renders each page to a canvas via pdfjs-dist,
// re-encodes it as a JPEG at reduced quality, then rebuilds a new, smaller
// PDF from those images via pdf-lib. Dynamically imported so neither library
// (pdfjs-dist especially) ever lands in the main page bundle — only loaded
// when a visitor actually picks an oversized PDF.

const RENDER_SCALE = 1.4;
const QUALITY_STEPS = [0.7, 0.5, 0.35];

async function renderPageToJpeg(page: import("pdfjs-dist").PDFPageProxy, quality: number) {
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context unavailable");

  await page.render({ canvasContext: context, viewport, canvas }).promise;

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("Failed to encode page as JPEG");

  return { bytes: new Uint8Array(await blob.arrayBuffer()), width: viewport.width, height: viewport.height };
}

async function buildPdfAtQuality(file: File, quality: number): Promise<Uint8Array> {
  const [pdfjsLib, { PDFDocument }] = await Promise.all([import("pdfjs-dist"), import("pdf-lib")]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

  const sourceBytes = new Uint8Array(await file.arrayBuffer());
  const sourceDoc = await pdfjsLib.getDocument({ data: sourceBytes }).promise;
  const outDoc = await PDFDocument.create();

  for (let pageNumber = 1; pageNumber <= sourceDoc.numPages; pageNumber += 1) {
    const page = await sourceDoc.getPage(pageNumber);
    const { bytes, width, height } = await renderPageToJpeg(page, quality);
    const jpegImage = await outDoc.embedJpg(bytes);
    const outPage = outDoc.addPage([width, height]);
    outPage.drawImage(jpegImage, { x: 0, y: 0, width, height });
  }

  return outDoc.save();
}

export type CompressPdfResult =
  | { ok: true; file: File; originalSize: number; compressedSize: number }
  | { ok: false; originalSize: number };

/**
 * Attempts to shrink a PDF under `targetBytes` by re-rastering every page at
 * progressively lower JPEG quality. Returns the smallest result it managed,
 * even if that still doesn't fit under the target — the caller decides what
 * counts as success.
 */
export async function compressPdf(file: File, targetBytes: number): Promise<CompressPdfResult> {
  const originalSize = file.size;
  let best: { bytes: Uint8Array; size: number } | null = null;

  for (const quality of QUALITY_STEPS) {
    try {
      const bytes = await buildPdfAtQuality(file, quality);
      if (!best || bytes.byteLength < best.size) best = { bytes, size: bytes.byteLength };
      if (bytes.byteLength <= targetBytes) break;
    } catch {
      // Try the next quality step; if every step fails, `best` stays null.
    }
  }

  if (!best || best.size > targetBytes) return { ok: false, originalSize };

  const compressedFile = new File([best.bytes as BlobPart], file.name, { type: "application/pdf" });
  return { ok: true, file: compressedFile, originalSize, compressedSize: best.size };
}
