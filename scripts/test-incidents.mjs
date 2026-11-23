
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { saveCheckWithIncident } from "./incident-tracker.mjs";

const pool = new pg.Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

let monitorId;

async function simulateCheck(status) {
  const saved = await saveCheckWithIncident(pool, {
    monitorId,
    status,
    statusCode: status === "up" ? 200 : 503,
    responseTimeMs: 150,
    errorMessage: status === "down"
      ? "Simulated failure"
      : null,
  });

}

async function getOpenIncidents() {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM incidents
     WHERE monitor_id = $1
       AND resolved_at IS NULL`,
    [monitorId]
  );

  return rows[0].total;
}

try {
  // Create a temporary, inactive test monitor
  const { rows } = await pool.query(
    `INSERT INTO monitors (url, is_active)
     VALUES ($1, FALSE)
     RETURNING id`,
    [`https://incident-${randomUUID()}.example.com/`]
  );

  monitorId = rows[0].id;

  // Test 1: First failure
  await simulateCheck("down");
  assert.equal(await getOpenIncidents(), 0);
  console.log("PASS: First failure does not open incident");

  // Test 2: Second consecutive failure
  await simulateCheck("down");
  assert.equal(await getOpenIncidents(), 1);
  console.log("PASS: Second failure opens incident");

  // Test 3: Additional failure
  await simulateCheck("down");
  assert.equal(await getOpenIncidents(), 1);
  console.log("PASS: No duplicate incident created");

  // Test 4: Website recovery
  await simulateCheck("up");
  assert.equal(await getOpenIncidents(), 0);

  const { rows: incidents } = await pool.query(
    `SELECT resolved_at
     FROM incidents
     WHERE monitor_id = $1`,
    [monitorId]
  );

  assert.equal(incidents.length, 1);
  assert.ok(incidents[0].resolved_at);

  console.log("PASS: Recovery resolves the incident");
  console.log("All incident tests passed!");


  const { rows: notifications } = await pool.query(
    `SELECT event_type, status
   FROM notification_outbox
   WHERE incident_id = (
     SELECT id FROM incidents
     WHERE monitor_id = $1
   )
   ORDER BY id ASC`,
    [monitorId]
  );

  assert.deepEqual(
    notifications.map((item) => item.event_type),
    ["opened", "resolved"]
  );

  assert.ok(
    notifications.every((item) => item.status === "pending")
  );

  console.log("PASS: Two pending notifications created");


} finally {
  // Remove test monitor and its history
  try {
    if (monitorId) {
      await pool.query(
        "DELETE FROM monitors WHERE id = $1",
        [monitorId]
      );
    }
  } finally {
    await pool.end();
  }
}
