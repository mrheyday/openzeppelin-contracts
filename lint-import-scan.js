#!/usr/bin/env node

// lint-import-scan.js
// Recursively scan .sol / .t.sol files and report plain imports / inline-logic modifiers.

const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] || ".";

const solExts = new Set([".sol", ".t.sol", ".s.sol"]);

const IMPORT_PLAIN_REGEX = /^\s*import\s+['"][^'"]+['"]\s*;/;
const MODIFIER_INLINE_REGEX = /^\s*modifier\s+(\w+)\s*\([^)]*\)\s*\{\s*(?:require|assert)\s*\(/;

function scanFile(filePath) {
  const data = fs.readFileSync(filePath, "utf8");
  const issues = [];
  const lines = data.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (IMPORT_PLAIN_REGEX.test(line)) {
      issues.push({ type: "plain_import", line: i+1, content: line.trim() });
    }
    if (MODIFIER_INLINE_REGEX.test(line)) {
      issues.push({ type: "inline_modifier", line: i+1, content: line.trim() });
    }
  }
  return issues;
}

function walkDir(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "lib" || entry.name === "node_modules") {
        // skip dependencies folders
        continue;
      }
      results.push(...walkDir(full));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (solExts.has(ext)) {
        results.push(full);
      }
    }
  }
  return results;
}

function main() {
  console.log("Scanning Solidity files under:", ROOT);
  const files = walkDir(ROOT);
  let totalIssues = 0;

  for (const file of files) {
    const iss = scanFile(file);
    if (iss.length > 0) {
      console.log(`\nFile: ${file}`);
      for (const i of iss) {
        console.log(`  - [${i.type}] line ${i.line}: ${i.content}`);
        totalIssues++;
      }
    }
  }

  console.log(`\nScanned ${files.length} .sol/.t.sol files.`);
  console.log(`Found ${totalIssues} potential issue${totalIssues === 1 ? "" : "s"}.`);
  if (totalIssues > 0) {
    process.exit(1);
  } else {
    console.log("✅ No obvious import/modifier issues found.");
    process.exit(0);
  }
}

main();