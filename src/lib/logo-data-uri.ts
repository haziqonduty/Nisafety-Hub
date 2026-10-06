import { readFileSync } from "node:fs";
import path from "node:path";

let cached: string | undefined;

export function logoDataUri() {
  if (cached) return cached;
  const buffer = readFileSync(path.join(process.cwd(), "public", "nisafety-consultancy-logo.png"));
  cached = `data:image/png;base64,${buffer.toString("base64")}`;
  return cached;
}
