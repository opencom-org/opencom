/**
 * Screenshot manifest utility.
 *
 * Writes captured screenshot metadata to a JSON manifest file
 * alongside the images in the output directory.
 */

import * as fs from "fs";
import * as path from "path";

export const SCREENSHOTS_DIR = path.resolve(__dirname, "../../artifacts/screenshots");

export interface ScreenshotEntry {
  app: string;
  screen: string;
  filePath: string;
  timestamp: string;
}

export interface Manifest {
  generatedAt: string;
  screenshots: ScreenshotEntry[];
}

function assertWithinScreenshotsDir(candidatePath: string, label: string): string {
  const resolvedRoot = path.resolve(SCREENSHOTS_DIR);
  const resolvedCandidate = path.resolve(candidatePath);
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      `${label} must stay within SCREENSHOTS_DIR (${SCREENSHOTS_DIR}). Received: ${candidatePath}`
    );
  }
  return resolvedCandidate;
}

/**
 * Ensures the output directory exists and returns the absolute path.
 */
export function ensureOutputDir(subDir: string): string {
  const dir = assertWithinScreenshotsDir(
    path.resolve(SCREENSHOTS_DIR, subDir),
    "Screenshot output directory"
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Writes (or overwrites) a manifest JSON file in the given directory.
 */
export function writeManifest(dir: string, entries: ScreenshotEntry[]): string {
  const manifest: Manifest = {
    generatedAt: new Date().toISOString(),
    screenshots: entries,
  };
  const safeDir = assertWithinScreenshotsDir(dir, "Manifest directory");
  const manifestPath = path.join(safeDir, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return manifestPath;
}

/**
 * Helper: build a ScreenshotEntry after saving a file.
 */
export function entry(app: string, screen: string, filePath: string): ScreenshotEntry {
  return { app, screen, filePath, timestamp: new Date().toISOString() };
}
