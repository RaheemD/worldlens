// Generates the app's PNG icons from public/app-icon.svg.
// Run with:  node scripts/generate-icons.mjs
// (requires "sharp"; install once with:  npm install sharp --no-save )

import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

// "any" icons + splash use the rounded squircle; maskable/store use full-bleed.
const targets = [
  { file: "pwa-192x192.png", size: 192, src: "app-icon-rounded.svg" },
  { file: "pwa-512x512.png", size: 512, src: "app-icon-rounded.svg" },
  { file: "pwa-maskable-512x512.png", size: 512, src: "app-icon.svg" },
  { file: "apple-touch-icon.png", size: 180, src: "app-icon.svg" },
  { file: "icon-1024.png", size: 1024, src: "app-icon.svg" },
];

for (const t of targets) {
  const svg = readFileSync(join(publicDir, t.src));
  // Render the SVG at a high density first, then resize for crisp edges.
  await sharp(svg, { density: 384 })
    .resize(t.size, t.size, { fit: "cover" })
    .png()
    .toFile(join(publicDir, t.file));
  console.log("generated", t.file, "from", t.src);
}

console.log("Done.");
