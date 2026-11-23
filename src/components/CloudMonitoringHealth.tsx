
import pg from "pg";
import { connection } from "next/server";

const { Pool } = pg;

export default async function CloudMonitoringHealth() {
  await connection();

  if (!process.env.DATABASE_URL) {
    return <p>Cloud monitoring is not configured.</p>;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 5000,
  });

  let lastCheck: Date | null = null;

  try {
    const { rows } = await pool.query(`
      SELECT MAX(c.checked_at) AS last_check
      FROM monitor_checks c
      JOIN monitors m ON m.id = c.monitor_id
      WHERE m.is_active = TRUE
    `);

    lastCheck = rows[0]?.last_check ?? null;
  } catch {
    return <p>Monitoring status unavailable.</p>;
  } finally {
    await pool.end();
  }

  const minutesAgo = lastCheck
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(lastCheck).getTime()) / 60000
        )
      )
    : null;

  const isRecent = minutesAgo !== null && minutesAgo <= 30;

  return (
    <section className="rounded-xl border p-4">
      <h2 className="font-semibold">Cloud Monitoring</h2>

      <p className={isRecent ? "text-green-600" : "text-amber-600"}>
        {isRecent ? "Recent checks detected" : "No recent checks"}
      </p>

      <p className="mt-2 text-sm text-gray-500">
        {minutesAgo === null
          ? "No monitoring checks recorded yet"
          : `Latest check: ${minutesAgo} minute(s) ago`}
      </p>
    </section>
  );
}
