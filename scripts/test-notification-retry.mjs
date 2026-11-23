
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

import {
    markDeliveryFailed,
} from "./outbox-claim.mjs";

const pool = new pg.Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
});

let monitorId;

try {
    // Create an isolated test monitor
    const monitor = await pool.query(
        `INSERT INTO monitors (url, is_active)
     VALUES ($1, FALSE)
     RETURNING id`,
        [`https://retry-${randomUUID()}.example/`]
    );

    monitorId = monitor.rows[0].id;

    // Create an incident
    const incident = await pool.query(
        `INSERT INTO incidents (monitor_id, started_at)
     VALUES ($1, NOW())
     RETURNING id`,
        [monitorId]
    );

    // Create a pending notification
    const notification = await pool.query(
        `INSERT INTO notification_outbox
     (incident_id, event_type)
     VALUES ($1, 'opened')
     RETURNING id`,
        [incident.rows[0].id]
    );

    const notificationId = notification.rows[0].id;

    // Simulate this notification being claimed
    const { rows } = await pool.query(
        `UPDATE notification_outbox
     SET locked_until = NOW() + INTERVAL '5 minutes',
         claim_token = gen_random_uuid()
     WHERE id = $1
     RETURNING id, claim_token, attempts`,
        [notificationId]
    );

    const claim = rows[0];

    // Simulate an SMTP failure (no network request)
    const updated = await markDeliveryFailed(
        pool,
        claim,
        new Error("Simulated SMTP connection failure")
    );

    assert.equal(updated, true);

    // Verify database state
    const result = await pool.query(
        `SELECT status, attempts, last_error,
            locked_until, claim_token,
            EXTRACT(EPOCH FROM (
              next_attempt_at - NOW()
            )) AS retry_in_seconds
     FROM notification_outbox
     WHERE id = $1`,
        [notificationId]
    );

    const record = result.rows[0];

    assert.equal(record.status, "pending");
    assert.equal(record.attempts, 1);
    assert.equal(record.locked_until, null);
    assert.equal(record.claim_token, null);
    assert.match(record.last_error, /Simulated SMTP/);

    const retryIn = Number(record.retry_in_seconds);

    assert.ok(retryIn > 0 && retryIn <= 30);

    console.log("PASS: Failure recorded");
    console.log("PASS: Notification remains pending");
    console.log("PASS: Processing lease released");
    console.log(`PASS: Retry scheduled in ${Math.round(retryIn)}s`);


    const expectedDelays = {
        2: 60,
        3: 120,
        4: 240,
    };

    // Simulate attempts 2 through 5
    for (let attempt = 2; attempt <= 5; attempt++) {
        // Simulate the retry becoming eligible
        const { rows: claims } = await pool.query(
            `UPDATE notification_outbox
     SET locked_until = NOW() + INTERVAL '5 minutes',
         claim_token = gen_random_uuid(),
         next_attempt_at = NOW()
     WHERE id = $1
       AND status = 'pending'
     RETURNING id, claim_token, attempts`,
            [notificationId]
        );

        assert.equal(claims.length, 1);

        const updated = await markDeliveryFailed(
            pool,
            claims[0],
            new Error(`Simulated failure ${attempt}`)
        );

        assert.equal(updated, true);

        const { rows: results } = await pool.query(
            `SELECT
       status,
       attempts,
       locked_until,
       claim_token,
       EXTRACT(EPOCH FROM (
         next_attempt_at - NOW()
       )) AS retry_in_seconds
     FROM notification_outbox
     WHERE id = $1`,
            [notificationId]
        );

        const record = results[0];

        assert.equal(record.attempts, attempt);
        assert.equal(record.locked_until, null);
        assert.equal(record.claim_token, null);

        if (attempt < 5) {
            assert.equal(record.status, "pending");

            const delay = Number(record.retry_in_seconds);
            const expected = expectedDelays[attempt];

            assert.ok(delay > 0 && delay <= expected);

            console.log(
                `PASS: Attempt ${attempt} schedules retry in ${expected}s`
            );
        } else {
            assert.equal(record.status, "failed");

            console.log(
                "PASS: Attempt 5 permanently fails notification"
            );
        }
    }


} finally {
    // Delete temporary test data
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
