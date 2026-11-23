
import test from "node:test";
import assert from "node:assert/strict";

const BASE_URL =
  process.env.PULSEOPS_BASE_URL ?? "http://localhost:3000";

async function request(path, options = {}) {
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    signal: AbortSignal.timeout(5000),
  });
}

test("System health returns worker statuses", async () => {
  const response = await request("/api/system/health");
  const data = await response.json();

  assert.ok([200, 503].includes(response.status));
  assert.ok(Array.isArray(data.services));
  assert.equal(data.services.length, 2);
});

test("Queue API returns job counts", async () => {
  const response = await request("/api/system/queue");
  assert.equal(response.status, 200);

  const data = await response.json();

  for (const key of [
    "waiting",
    "active",
    "completed",
    "failed",
    "delayed",
  ]) {
    assert.equal(typeof data.jobs[key], "number");
    assert.ok(data.jobs[key] >= 0);
  }
});

test("Activity API returns monitoring counts", async () => {
  const response = await request("/api/system/activity");
  assert.equal(response.status, 200);

  const data = await response.json();

  assert.equal(data.windowMinutes, 60);
  assert.equal(typeof data.checks.total, "number");
  assert.equal(
    data.checks.up + data.checks.down,
    data.checks.total
  );
});

test("Timeline returns 12 intervals", async () => {
  const response = await request(
    "/api/system/activity/timeline?range=6h"
  );

  assert.equal(response.status, 200);

  const data = await response.json();

  assert.equal(data.bucketMinutes, 30);
  assert.equal(data.points.length, 12);
});

test("Monitor API rejects localhost URLs", async () => {
  const response = await request("/api/monitors", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: "http://localhost",
    }),
  });

  assert.equal(response.status, 400);
});

test("Release API rejects missing authentication", async () => {
  const monitorId =
    "00000000-0000-4000-8000-000000000000";

  const response = await request(
    `/api/monitors/${monitorId}/releases`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "v1.0.0",
      }),
    }
  );

  assert.equal(response.status, 401);
});
