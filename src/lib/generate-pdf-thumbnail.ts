// Browser-only: renders a PDF's first page to a small JPEG thumbnail via
// pdfjs-dist, for the directory grid's preview tile. Mirrors compress-pdf.ts's
// dynamic-import pattern so pdfjs-dist never lands in the main page bundle.
// Best-effort — returns null on any failure rather than throwing, since a
// missing thumbnail should never block a submission.

const THUMBNAIL_SCALE = 0.4;
const THUMBNAIL_QUALITY = 0.7;

export async function generatePdfThumbnail(file: File): Promise<File | null> {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

    const sourceBytes = new Uint8Array(await file.arrayBuffer());
    const sourceDoc = await pdfjsLib.getDocument({ data: sourceBytes }).promise;
    const page = await sourceDoc.getPage(1);
    const viewport = page.getViewport({ scale: THUMBNAIL_SCALE });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext("2d");
    if (!context) return null;

    await page.render({ canvasContext: context, viewport, canvas }).promise;

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", THUMBNAIL_QUALITY));
    if (!blob) return null;

    return new File([blob], "thumbnail.jpg", { type: "image/jpeg" });
  } catch {
    return null;
  }
}
