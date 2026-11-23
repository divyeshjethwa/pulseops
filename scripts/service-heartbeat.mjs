
export async function recordHeartbeat(pool, serviceName) {
  await pool.query(
    `INSERT INTO service_heartbeats
       (service_name, last_seen_at)
     VALUES ($1, NOW())
     ON CONFLICT (service_name)
     DO UPDATE SET last_seen_at = NOW()`,
    [serviceName]
  );
}
