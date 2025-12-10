#!/usr/bin/env node
// small helper: encode arb params (example)
const fs = require("fs");
const { ethers } = require("ethers");

if (process.argv.length < 3) {
  console.error("Usage: node arb_params_helper.js params.json");
  process.exit(1);
}
const json = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const abi = new ethers.AbiCoder();
const encoded = abi.encode(
  ["address", "uint256", "bytes"],
  [json.pool || ethers.ZeroAddress, json.amount || 0, json.commands || "0x"],
);
console.log(encoded);
