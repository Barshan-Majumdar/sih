import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "public", "pdfjs");

await mkdir(output, { recursive: true });
await Promise.all([
  copyFile(join(root, "node_modules", "pdfjs-dist", "build", "pdf.mjs"), join(output, "pdf.mjs")),
  copyFile(
    join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.mjs"),
    join(output, "pdf.worker.mjs")
  ),
  copyFile(
    join(root, "node_modules", "pdfjs-dist", "web", "pdf_viewer.css"),
    join(output, "pdf_viewer.css")
  ),
]);

