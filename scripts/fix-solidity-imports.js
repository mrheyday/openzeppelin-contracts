#!/usr/bin/env node
/**
 * fix-solidity-imports.js
 *
 * Converts plain Solidity imports like:
 *   import "forge-std/Test.sol";
 *   import "../contracts/SomeContract.sol";
 *
 * into named imports:
 *   import { Test } from "forge-std/Test.sol";
 *   import { SomeContract } from "../contracts/SomeContract.sol";
 *
 * - Skips imports that already use braces, star imports, alias imports, or solidity pragmas.
 * - Creates a per-file backup before modifying: <file>.bak.<TIMESTAMP>
 * - Prints a summary at the end.
 *
 * Usage:
 *  node scripts/fix-solidity-imports.js         # modifies files
 *  node scripts/fix-solidity-imports.js --dry  # shows proposed fixes, does not write
 */

import fs from "fs";
import path from "path";
import glob from "glob";

const DRY = process.argv.includes("--dry") || process.argv.includes("-n");
const ROOT = process.cwd();
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-");
const GLOB = "**/*.sol";

function basenameSymbol(filePath) {
  // strip query/hash if present (not usual), then basename without ext
  const base = path.basename(filePath).replace(/\?.*$/, "");
  return base.replace(/\.sol$/i, "");
}

function shouldTransformImport(line) {
  // Trim
  const t = line.trim();
  if (!t.startsWith("import")) return false;
  // Already a named import, star import, or alias import -> skip
  if (/\bimport\s+{/.test(t)) return false;
  if (/\bimport\s+\*\s+as\b/.test(t)) return false;
  if (/\bimport\s+["'].*["']\s+as\b/.test(t)) return false;
  // require the simple pattern: import "path/to/File.sol";
  if (/^import\s+["'][^"']+\.sol["'];\s*$/.test(t)) return true;
  return false;
}

function makeReplacement(line) {
  // capture the path inside quotes
  const m = line.match(/^(\s*)import\s+["']([^"']+\.sol)["'];(\s*)$/);
  if (!m) return null;
  const indent = m[1] || "";
  const importPath = m[2];
  const trailing = m[3] || "";
  const symbol = basenameSymbol(importPath);
  // If filename starts with a number or contains chars that aren't valid ident start, fallback to safe identifier:
  let ident = symbol;
  if (!/^[A-Za-z_]/.test(ident)) {
    // prefix with _ if starts with digit
    ident = "_" + ident;
  }
  // Replace invalid identifier characters with underscore (very uncommon for solidity filenames)
  ident = ident.replace(/[^A-Za-z0-9_]/g, "_");
  return `${indent}import { ${ident} } from "${importPath}";${trailing}\n`;
}

function processFile(file) {
  const full = path.resolve(file);
  const src = fs.readFileSync(full, "utf8");
  const lines = src.split(/\r?\n/);
  let changed = false;
  const outLines = lines.map((ln) => {
    if (shouldTransformImport(ln)) {
      const rep = makeReplacement(ln);
      if (rep) {
        changed = true;
        return rep.replace(/\n$/, ""); // map later to original newline scheme
      }
    }
    return ln;
  });

  if (!changed) return null;

  // Backup
  const bak = `${full}.bak.${TIMESTAMP}`;
  fs.copyFileSync(full, bak);

  if (!DRY) {
    // Preserve original newline style (use LF)
    fs.writeFileSync(full, outLines.join("\n"), { encoding: "utf8" });
  }

  return { file: full, backup: bak };
}

function main() {
  console.log(`Root: ${ROOT}`);
  console.log(`Dry run: ${DRY ? "yes" : "no"}`);
  const files = glob.sync(GLOB, { nodir: true, ignore: "node_modules/**" });
  let modified = [];
  for (const f of files) {
    // skip lib folders commonly (optionally)
    if (f.includes("lib/") || f.includes("node_modules/")) continue;
    try {
      const res = processFile(f);
      if (res) {
        modified.push(res);
        console.log(`Will modify: ${f} -> backup: ${res.backup}`);
      }
    } catch (err) {
      console.error(`Error processing ${f}: ${err.message}`);
    }
  }

  if (modified.length === 0) {
    console.log("No plain imports found to change.");
    return;
  }

  console.log("\nSummary:");
  modified.forEach((m) => console.log(`  ${m.file}  (backup: ${m.backup})`));

  if (DRY) {
    console.log("\nDry run complete. No files were changed. Re-run without --dry to apply.");
  } else {
    console.log("\nFiles updated. Recommended next steps:");
    console.log("  git add .");
    console.log('  git commit -m "chore: convert plain imports to named imports (forge-lint fixes)"');
    console.log("  node lint-import-scan.js   # re-run scanner");
    console.log("  forge test -v              # run tests");
  }
}

main();