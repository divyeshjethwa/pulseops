
import test from "node:test";
import assert from "node:assert/strict";
import {
  createSafeLookup,
  isPublicIp,
} from "./safe-fetch.mjs";

function simulateDns(addresses) {
  const fakeDns = (hostname, options, callback) => {
    callback(null, addresses);
  };

  const safeLookup = createSafeLookup(fakeDns);

  return new Promise((resolve, reject) => {
    safeLookup(
      "example.com",
      { family: 4 },
      (error, address, family) => {
        if (error) return reject(error);
        resolve({ address, family });
      }
    );
  });
}

test("Accepts public DNS records", async () => {
  const result = await simulateDns([
    { address: "8.8.8.8", family: 4 },
  ]);

  assert.equal(result.address, "8.8.8.8");
});

test("Rejects private DNS records", async () => {
  await assert.rejects(
    simulateDns([
      { address: "192.168.1.10", family: 4 },
    ])
  );
});

test("Rejects mixed public and private records", async () => {
  await assert.rejects(
    simulateDns([
      { address: "8.8.8.8", family: 4 },
      { address: "10.0.0.5", family: 4 },
    ])
  );
});

test("Rejects empty DNS responses", async () => {
  await assert.rejects(simulateDns([]));
});


test("Accepts public IPv6", () => {
  assert.equal(
    isPublicIp("2606:4700:4700::1111"),
    true
  );
});

test("Rejects IPv6 loopback", () => {
  assert.equal(isPublicIp("::1"), false);
});

test("Rejects private IPv6", () => {
  assert.equal(isPublicIp("fd00::1"), false);
});

test("Rejects IPv4-mapped private addresses", () => {
  assert.equal(
    isPublicIp("::ffff:192.168.1.10"),
    false
  );
});

test("Rejects IPv6 outside global allocation", () => {
  assert.equal(isPublicIp("4000::1"), false);
});
