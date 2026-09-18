import sharp from "sharp";
import { mkdir } from "node:fs/promises";

// Agira icon: three offset horizontal bars on a #101720 rounded square,
// abstracting a Gantt row. No text initials.
function iconSvg({ maskable = false } = {}) {
  // Maskable icons need ~10% safe-zone padding all around.
  const pad = maskable ? 56 : 0;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${maskable ? 0 : 96}" fill="#101720"/>
  <g transform="translate(${pad}, ${pad}) scale(${(512 - 2 * pad) / 512})">
    <!-- three Gantt-row bars, each a different length and horizontal offset -->
    <rect x="96" y="176" width="240" height="36" rx="18" fill="#ffffff"/>
    <rect x="140" y="238" width="276" height="36" rx="18" fill="#ffffff"/>
    <rect x="96" y="300" width="180" height="36" rx="18" fill="#ffffff"/>
  </g>
</svg>`;
}

await mkdir("public/icons", { recursive: true });

await sharp(Buffer.from(iconSvg())).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(Buffer.from(iconSvg())).resize(512, 512).png().toFile("public/icons/icon-512.png");
await sharp(Buffer.from(iconSvg({ maskable: true }))).resize(512, 512).png().toFile("public/icons/icon-512-maskable.png");
await sharp(Buffer.from(iconSvg())).resize(180, 180).png().toFile("public/icons/apple-touch-icon.png");

console.log("Icons generated: icon-192, icon-512, icon-512-maskable, apple-touch-icon");
