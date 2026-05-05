import fs from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(scriptDir, "..");
const officeDist = path.resolve(desktopRoot, "../exe-virtual-office/dist/webview");
const officeRepo = path.resolve(desktopRoot, "../exe-virtual-office");
const targetDir = path.resolve(desktopRoot, "public/virtual-office");
const targetFontsDir = path.resolve(targetDir, "fonts");

function safeValue(run) {
  try {
    return run().trim();
  } catch {
    return "unknown";
  }
}

function readSyncMeta() {
  return {
    syncedAt: new Date().toISOString(),
    sourceRoot: officeRepo,
    sourceDist: officeDist,
    sourceCommit: safeValue(() => execSync("git rev-parse HEAD", { cwd: officeRepo, encoding: "utf8" })),
    sourceBranch: safeValue(() => execSync("git rev-parse --abbrev-ref HEAD", { cwd: officeRepo, encoding: "utf8" })),
    sourceDirty: safeValue(
      () => execSync("git status --porcelain", { cwd: officeRepo, encoding: "utf8" }),
    ).length > 0
      ? "dirty"
      : "clean",
  };
}

if (!fs.existsSync(officeDist)) {
  console.error(
    [
      "Missing exe-virtual-office build output.",
      `Expected: ${officeDist}`,
      "Build ../exe-virtual-office/webview-ui first, then run this sync again.",
    ].join("\n"),
  );
  process.exit(1);
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.cpSync(officeDist, targetDir, { recursive: true });
fs.rmSync(targetFontsDir, { recursive: true, force: true });
fs.writeFileSync(
  path.resolve(targetDir, ".sync-manifest.json"),
  `${JSON.stringify(readSyncMeta(), null, 2)}\n`,
);

console.log(`Synced virtual office build into ${targetDir}`);
