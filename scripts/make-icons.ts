/**
 * Renders the PWA and touch icons from public/icons/favicon.svg.
 *
 *   npm run icons
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const DIR = path.resolve(__dirname, "..", "public", "icons");
const NAVY = "#0b1b2b";

async function main() {
  const svg = readFileSync(path.join(DIR, "favicon.svg"));
  // Square icons keep the rounded tile; the OS applies its own mask.
  for (const [name, size] of [
    ["icon-192.png", 192],
    ["icon-512.png", 512],
    ["apple-touch-icon.png", 180],
  ] as const) {
    await sharp(svg, { density: 512 }).resize(size, size).png().toFile(path.join(DIR, name));
  }
  // Maskable: full-bleed background with the mark inside the 80% safe zone.
  const inner = await sharp(svg, { density: 512 }).resize(360, 360).png().toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: NAVY } })
    .composite([{ input: inner, gravity: "center" }])
    .png()
    .toFile(path.join(DIR, "maskable-512.png"));
  console.log("Icons written to public/icons");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
