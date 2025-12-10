#!/usr/bin/env node
// Minimal gelato manager (skeleton). Fill .env and run with Node 18+
const { GelatoRelay } = require("@gelatonetwork/relay-sdk");
const ethers = require("ethers");
const axios = require("axios");
require("dotenv").config();

const {
  RPC_URL,
  GELATO_API_KEY,
  SPONSOR_PRIVATE_KEY,
  CONTRACT_ADDRESS,
  FORWARDER_ADDRESS,
  CHAIN_ID = "1",
} = process.env;

if (!RPC_URL || !GELATO_API_KEY || !SPONSOR_PRIVATE_KEY || !CONTRACT_ADDRESS) {
  console.error(
    "Missing required env vars: RPC_URL,GELATO_API_KEY,SPONSOR_PRIVATE_KEY,CONTRACT_ADDRESS",
  );
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const sponsor = new ethers.Wallet(SPONSOR_PRIVATE_KEY, provider);
const relay = new GelatoRelay({ chainId: Number(CHAIN_ID) });

async function sponsoredCall(user, data) {
  const request = {
    chainId: Number(CHAIN_ID),
    target: CONTRACT_ADDRESS,
    data,
    user,
    gasLimit: 1200000,
  };
  try {
    const resp = await relay.sponsoredCallERC2771(
      request,
      sponsor,
      GELATO_API_KEY,
    );
    console.log("OK", resp);
    return resp;
  } catch (err) {
    console.error("sponsor error", err?.response?.data || err?.message || err);
    throw err;
  }
}

module.exports = { sponsoredCall };
