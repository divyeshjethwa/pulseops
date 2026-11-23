
import test from "node:test";
import assert from "node:assert/strict";

import { validateMonitorUrl } from "./url-safety.mjs";
import { isPublicIp } from "./safe-fetch.mjs";

test("accepts valid public hostnames", () => {
  assert.equal(
    validateMonitorUrl("https://example.com"),
    "https://example.com/"
  );
});

test("rejects unsafe URLs", () => {
  const unsafeUrls = [
    "http://localhost:3000",
    "http://127.0.0.1",
    "http://192.168.1.1",
    "http://169.254.169.254",
    "http://[::1]",
    "https://8.8.8.8",
    "https://user:pass@example.com",
    "https://example.com:8080",
  ];

  for (const url of unsafeUrls) {
    assert.throws(() => validateMonitorUrl(url));
  }
});

test("rejects non-public resolved IPs", () => {
  const unsafeIps = [
    "127.0.0.1",
    "10.0.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.100.100.100",
    "::1",
    "fc00::1",
    "::ffff:127.0.0.1",
  ];

  for (const ip of unsafeIps) {
    assert.equal(isPublicIp(ip), false, ip);
  }

  assert.equal(isPublicIp("8.8.8.8"), true);
});
