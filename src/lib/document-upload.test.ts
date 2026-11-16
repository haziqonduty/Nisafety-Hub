import { describe, expect, it } from "vitest";
import { hasFileSignature, MAX_FILE_SIZE, validateDocumentFile } from "@/lib/document-upload";

const PDF = "application/pdf";
const DOC = "application/msword";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function file(name: string, type: string, head: number[] | string, padTo = 256) {
  const start = typeof head === "string" ? [...Buffer.from(head)] : head;
  const bytes = new Uint8Array(Math.max(padTo, start.length));
  bytes.set(start);
  return new File([bytes], name, { type });
}

describe("hasFileSignature", () => {
  it("recognises genuine headers", async () => {
    expect(await hasFileSignature(file("a.pdf", PDF, "%PDF-1.7"), "pdf")).toBe(true);
    expect(await hasFileSignature(file("a.docx", DOCX, [0x50, 0x4b, 0x03, 0x04]), "docx")).toBe(true);
    expect(await hasFileSignature(file("a.doc", DOC, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), "doc")).toBe(true);
    expect(await hasFileSignature(file("t.jpg", "image/jpeg", [0xff, 0xd8, 0xff, 0xe0]), "jpg")).toBe(true);
  });
  it("allows bytes before %PDF- within the first 1 KB, like PDF readers do", async () => {
    expect(await hasFileSignature(file("scan.pdf", PDF, [0xef, 0xbb, 0xbf, 0x0a, ...Buffer.from("%PDF-1.4")]), "pdf")).toBe(true);
    const late = [...Array(1100).fill(0x20), ...Buffer.from("%PDF-1.4")];
    expect(await hasFileSignature(file("late.pdf", PDF, late, 1200), "pdf")).toBe(false);
  });
  it("only matches DOC/DOCX/JPEG at the very start", async () => {
    expect(await hasFileSignature(file("a.docx", DOCX, [0x00, 0x50, 0x4b, 0x03, 0x04]), "docx")).toBe(false);
  });
  it("rejects unknown kinds", async () => {
    expect(await hasFileSignature(file("a.exe", "application/octet-stream", "MZ"), "exe")).toBe(false);
  });
});

describe("validateDocumentFile", () => {
  it("accepts genuine reports", async () => {
    expect(await validateDocumentFile(file("Report.PDF", PDF, "%PDF-1.7"))).toEqual({ extension: "pdf" });
    expect(await validateDocumentFile(file("r.docx", DOCX, [0x50, 0x4b, 0x03, 0x04]))).toEqual({ extension: "docx" });
  });
  it("rejects disguised files", async () => {
    expect(await validateDocumentFile(file("evil.pdf", PDF, [0x4d, 0x5a, 0x90, 0x00]))).toEqual({ error: "INVALID_FILE_TYPE" });
    expect(await validateDocumentFile(file("page.pdf", PDF, "<html><script>"))).toEqual({ error: "INVALID_FILE_TYPE" });
    expect(await validateDocumentFile(file("mixed.doc", DOC, "%PDF-1.7"))).toEqual({ error: "INVALID_FILE_TYPE" });
  });
  it("rejects wrong extension/type pairs and unsupported types", async () => {
    expect(await validateDocumentFile(file("r.pdf", DOCX, "%PDF-1.7"))).toEqual({ error: "INVALID_FILE_TYPE" });
    expect(await validateDocumentFile(file("r.exe", "application/octet-stream", "MZ"))).toEqual({ error: "INVALID_FILE_TYPE" });
    expect(await validateDocumentFile(file("noextension", PDF, "%PDF-1.7"))).toEqual({ error: "INVALID_FILE_TYPE" });
  });
  it("rejects empty and oversized files", async () => {
    expect(await validateDocumentFile(new File([], "empty.pdf", { type: PDF }))).toEqual({ error: "FILE_SIZE" });
    expect(await validateDocumentFile(file("big.pdf", PDF, "%PDF-1.7", MAX_FILE_SIZE + 1))).toEqual({ error: "FILE_SIZE" });
  });
});
