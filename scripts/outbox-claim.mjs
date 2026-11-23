
export async function claimNotification(pool) {
  const { rows } = await pool.query(`
    WITH next_notification AS (
      SELECT id
      FROM notification_outbox
      WHERE status = 'pending'
        AND next_attempt_at <= NOW()
        AND (
          locked_until IS NULL
          OR locked_until <= NOW()
        )
      ORDER BY next_attempt_at, id
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE notification_outbox AS o
    SET
      locked_until = NOW() + INTERVAL '5 minutes',
      claim_token = gen_random_uuid()
    FROM next_notification
    WHERE o.id = next_notification.id
    RETURNING
      o.id,
      o.incident_id,
      o.event_type,
      o.claim_token,
      o.attempts
  `);

  return rows[0] ?? null;
}

export async function releaseNotification(pool, claim) {
  await pool.query(
    `UPDATE notification_outbox
     SET locked_until = NULL,
         claim_token = NULL
     WHERE id = $1
       AND claim_token = $2`,
    [claim.id, claim.claim_token]
  );
}


export async function markDeliverySent(pool, claim) {
  const result = await pool.query(
    `UPDATE notification_outbox
     SET status = 'sent',
         attempts = attempts + 1,
         sent_at = NOW(),
         last_error = NULL,
         locked_until = NULL,
         claim_token = NULL
     WHERE id = $1
       AND claim_token = $2
       AND status = 'pending'
       AND locked_until > NOW()
     RETURNING id`,
    [claim.id, claim.claim_token]
  );

  return result.rowCount === 1;
}


export function retryDelaySeconds(attempt) {
  return Math.min(3600, 30 * 2 ** (attempt - 1));
}

export async function markDeliveryFailed(
  pool,
  claim,
  error
) {
  const attemptNumber = claim.attempts + 1;
  const permanentlyFailed = attemptNumber >= 5;

  const retryDelay = retryDelaySeconds(attemptNumber);

  const errorMessage = (
    error instanceof Error ? error.message : String(error)
  ).slice(0, 1000);

  const result = await pool.query(
    `UPDATE notification_outbox
     SET status = CASE
           WHEN $3::boolean THEN 'failed'
           ELSE 'pending'
         END,
         attempts = attempts + 1,
         next_attempt_at = CASE
           WHEN $3::boolean THEN next_attempt_at
           ELSE NOW() + ($4::integer * INTERVAL '1 second')
         END,
         last_error = $5,
         locked_until = NULL,
         claim_token = NULL
     WHERE id = $1
       AND claim_token = $2
       AND status = 'pending'
       AND locked_until > NOW()
     RETURNING id`,
    [
      claim.id,
      claim.claim_token,
      permanentlyFailed,
      retryDelay,
      errorMessage,
    ]
  );

  return result.rowCount === 1;
}
