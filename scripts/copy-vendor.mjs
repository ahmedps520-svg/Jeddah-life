// Copies MapLibre's self-contained web worker into public/ so the browser can
// load it as a plain static module (bundlers don't emit it reliably).
import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync("public/vendor", { recursive: true });
copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/vendor/maplibre-gl-worker.mjs");
