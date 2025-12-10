#!/usr/bin/env node
// lint-import-scan-report.js
// Recursively scan .sol / .t.sol files; report plain-imports and inline-modifiers in JSON.

const fs = require("fs");
const path = require("path");

const ROOT = process.argv[2] || ".";

const solExts = new Set([".sol", ".t.sol", ".s.sol"]);

const IMPORT_PLAIN_REGEX = /^\s*import\s+['"][^'"]+['"]\s*;/;
const MODIFIER_INLINE_REGEX = /^\s*modifier\s+(\w+)\s*\([^)]*\)\s*\{\s*(?:require|assert)\s*\(/;

function scanFile(filePath) {
  const data = fs.readFileSync(filePath, "utf8");
  const issues = [];
  const lines = data.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (IMPORT_PLAIN_REGEX.test(l)) {
      issues.push({ type: "plain_import", line: i+1, content: l.trim() });
    }
    if (MODIFIER_INLINE_REGEX.test(l)) {
      issues.push({ type: "inline_modifier", line: i+1, content: l.trim() });
    }
  }
  return issues;
}

function walkDir(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "lib" || e.name === "node_modules") continue;
      results = results.concat(walkDir(full));
    } else if (e.isFile()) {
      const ext = path.extname(e.name);
      if (solExts.has(ext)) results.push(full);
    }
  }
  return results;
}

function main() {
  const files = walkDir(ROOT);
  const report = [];

  for (const f of files) {
    const issues = scanFile(f);
    if (issues.length) {
      report.push({ file: f, issues });
    }
  }

  const out = {
    scanned: files.length,
    files_with_issues: report.length,
    details: report
  };

  const outPath = "lint-scan-report.json";
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`Report written to ${outPath} — found issues in ${report.length} file(s).`);
}

main();