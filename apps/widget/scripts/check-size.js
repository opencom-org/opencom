import { readFileSync, statSync } from "fs";
import { gzipSync } from "zlib";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distPath = join(__dirname, "../dist/opencom-widget.iife.js");

const MAX_SIZE_KB = 50;

try {
  const file = readFileSync(distPath);
  const gzipped = gzipSync(file);
  const sizeKB = gzipped.length / 1024;

  console.log(`Bundle size: ${sizeKB.toFixed(2)} KB (gzipped)`);
  console.log(`Max allowed: ${MAX_SIZE_KB} KB`);

  if (sizeKB > MAX_SIZE_KB) {
    console.error(`❌ Bundle exceeds size limit by ${(sizeKB - MAX_SIZE_KB).toFixed(2)} KB`);
    process.exit(1);
  } else {
    console.log(
      `✅ Bundle is within size limit (${(MAX_SIZE_KB - sizeKB).toFixed(2)} KB remaining)`
    );
  }
} catch (error) {
  if (error.code === "ENOENT") {
    console.error("Bundle not found. Run `pnpm build` first.");
  } else {
    console.error("Error checking bundle size:", error.message);
  }
  process.exit(1);
}
