
import { connection } from "next/server";
import type { QueryResultRow } from "pg";
import pool from "@/lib/db";

interface ServiceHealth extends QueryResultRow {
  service_name: string;
  last_seen_at: Date | null;
  age_seconds: number | null;
  status: "healthy" | "stale" | "missing";
}

export async function GET() {
  await connection();

  try {
    const { rows } = await pool.query<ServiceHealth>(`
      WITH expected_services(service_name) AS (
        VALUES
          ('monitor-worker'),
          ('notification-worker')
      )
      SELECT
        e.service_name,
        h.last_seen_at,

        EXTRACT(EPOCH FROM (
          NOW() - h.last_seen_at
        ))::integer AS age_seconds,

        CASE
          WHEN h.last_seen_at IS NULL THEN 'missing'
          WHEN h.last_seen_at >= NOW() - INTERVAL '90 seconds'
            THEN 'healthy'
          ELSE 'stale'
        END AS status

      FROM expected_services e
      LEFT JOIN service_heartbeats h
        ON h.service_name = e.service_name
      ORDER BY e.service_name
    `);

    const healthy = rows.every(
      (service) => service.status === "healthy"
    );

    return Response.json(
      {
        status: healthy ? "healthy" : "degraded",
        services: rows,
        checkedAt: new Date().toISOString(),
      },
      {
        status: healthy ? 200 : 503,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("System health check failed:", error);

    return Response.json(
      { status: "unavailable" },
      { status: 503 }
    );
  }
}
