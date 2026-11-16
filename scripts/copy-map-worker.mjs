// Copies MapLibre's web worker into public/vendor so it is served from our own
// origin. Bundlers can't resolve MapLibre's default worker location, and a
// same-origin worker needs no extra CSP allowance (no blob: workers).
// Runs automatically before `next dev` and `next build` (predev/prebuild).
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "node_modules/maplibre-gl/package.json"), "utf8"));
const target = join(root, "public/vendor", `maplibre-gl-worker-${pkg.version}.js`);

mkdirSync(dirname(target), { recursive: true });
copyFileSync(join(root, "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs"), target);
console.log(`Map worker ready: public/vendor/maplibre-gl-worker-${pkg.version}.js`);
