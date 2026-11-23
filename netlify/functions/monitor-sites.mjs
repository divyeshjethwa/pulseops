
import pg from "pg";

import { safeFetch } from "../../scripts/safe-fetch.mjs";
import {
  saveCheckWithIncident,
} from "../../scripts/incident-tracker.mjs";

const { Pool } = pg;

// Run once every 15 minutes
export const config = {
  schedule: "*/15 * * * *",
};

export default async function handler() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing");
  }

  const allowedHosts = new Set(
    (process.env.PULSEOPS_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean)
  );

  if (allowedHosts.size === 0) {
    throw new Error("No monitoring hosts configured");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 5000,
  });

  try {
    // Keep the initial free-tier demo small
    const { rows: monitors } = await pool.query(`
      SELECT id, url
      FROM monitors
      WHERE is_active = TRUE
      ORDER BY created_at
      LIMIT 2
    `);

    for (const monitor of monitors) {
      const hostname = new URL(monitor.url)
        .hostname.toLowerCase();

      // Only monitor explicitly approved hosts
      if (!allowedHosts.has(hostname)) {
        console.warn("Skipping unapproved host:", hostname);
        continue;
      }

      let check;

      try {
        const result = await safeFetch(monitor.url);

        check = {
          monitorId: monitor.id,
          status: result.status,
          statusCode: result.statusCode,
          responseTimeMs: result.responseTimeMs,
          errorMessage: null,
        };
      } catch (error) {
        check = {
          monitorId: monitor.id,
          status: "down",
          statusCode: null,
          responseTimeMs: null,
          errorMessage: String(error.message).slice(0, 200),
        };
      }

      await saveCheckWithIncident(pool, check);

      console.log("Monitor checked:", {
        monitorId: monitor.id,
        status: check.status,
      });
    }
  } finally {
    await pool.end();
  }
}
