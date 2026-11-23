
export async function saveCheckWithIncident(pool, check) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock this monitor to avoid conflicting updates
    const monitor = await client.query(
      "SELECT id FROM monitors WHERE id = $1 FOR UPDATE",
      [check.monitorId]
    );

    if (monitor.rows.length === 0) {
      throw new Error("Monitor not found");
    }

    // Find the previous health check
    const previous = await client.query(
      `SELECT status, checked_at
       FROM monitor_checks
       WHERE monitor_id = $1
       ORDER BY id DESC
       LIMIT 1`,
      [check.monitorId]
    );

    // Save the current health check
    const result = await client.query(
      `INSERT INTO monitor_checks
       (monitor_id, status, status_code,
        response_time_ms, error_message)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, checked_at`,
      [
        check.monitorId,
        check.status,
        check.statusCode,
        check.responseTimeMs,
        check.errorMessage,
      ]
    );

    const saved = result.rows[0];


    await client.query(
      `
      UPDATE monitor_checks AS c
      SET
        threshold_ms_at_check = m.response_time_threshold_ms,

        is_slow = CASE
          WHEN c.status = 'up'
            AND c.response_time_ms IS NOT NULL
          THEN c.response_time_ms > m.response_time_threshold_ms
          ELSE NULL
        END

      FROM monitors AS m
      WHERE c.id = $1
        AND m.id = c.monitor_id
      `,
      [saved.id]
    );


    let incidentEvent = null;

    // Two consecutive failures: open incident

    if (
      check.status === "down" &&
      previous.rows[0]?.status === "down"
    ) {
      const opened = await client.query(
        `INSERT INTO incidents (monitor_id, started_at)
     VALUES ($1, $2)
     ON CONFLICT (monitor_id)
     WHERE resolved_at IS NULL
     DO NOTHING
     RETURNING id, started_at`,
        [check.monitorId, previous.rows[0].checked_at]
      );

      if (opened.rows.length > 0) {

        await client.query(
          `INSERT INTO notification_outbox
          (incident_id, event_type)
          VALUES ($1, 'opened')
          ON CONFLICT (incident_id, event_type)
          DO NOTHING`,
          [opened.rows[0].id]
        );

        incidentEvent = {
          type: "opened",
          incidentId: opened.rows[0].id,
          startedAt: opened.rows[0].started_at,
          resolvedAt: null,
        };
      }
    }


    // Successful check: resolve any open incident

    if (check.status === "up") {
      const resolved = await client.query(
        `UPDATE incidents
     SET resolved_at = $2
     WHERE monitor_id = $1
       AND resolved_at IS NULL
       AND started_at <= $2
     RETURNING id, started_at, resolved_at`,
        [check.monitorId, saved.checked_at]
      );

      if (resolved.rows.length > 0) {

        await client.query(
          `INSERT INTO notification_outbox
          (incident_id, event_type)
          VALUES ($1, 'resolved')
          ON CONFLICT (incident_id, event_type)
          DO NOTHING`,
          [resolved.rows[0].id]
        );

        incidentEvent = {
          type: "resolved",
          incidentId: resolved.rows[0].id,
          startedAt: resolved.rows[0].started_at,
          resolvedAt: resolved.rows[0].resolved_at,
        };
      }
    }


    await client.query("COMMIT");

    return {
      ...saved,
      incidentEvent,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
