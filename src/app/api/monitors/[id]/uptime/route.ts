
import { connection } from "next/server";
import pool from "@/lib/db";

type UptimeRow = {
  total_24h: number;
  up_24h: number;
  down_24h: number;
  total_7d: number;
  up_7d: number;
  down_7d: number;
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

function calculateUptime(
  total: number,
  up: number,
  down: number
) {
  return {
    totalChecks: total,
    upChecks: up,
    downChecks: down,
    uptimePercent:
      total === 0
        ? null
        : Number(((up / total) * 100).toFixed(2)),
  };
}

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  const { id } = await params;

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(id)) {
    return Response.json(
      { error: "Invalid monitor ID" },
      { status: 400 }
    );
  }

  await connection();

  try {
    const monitor = await pool.query(
      "SELECT id FROM monitors WHERE id = $1",
      [id]
    );

    if (monitor.rowCount === 0) {
      return Response.json(
        { error: "Monitor not found" },
        { status: 404 }
      );
    }

    const { rows } = await pool.query<UptimeRow>(
      `
      SELECT
        COUNT(*) FILTER (
          WHERE checked_at >= NOW() - INTERVAL '24 hours'
        )::int AS total_24h,

        COUNT(*) FILTER (
          WHERE checked_at >= NOW() - INTERVAL '24 hours'
            AND status = 'up'
        )::int AS up_24h,

        COUNT(*) FILTER (
          WHERE checked_at >= NOW() - INTERVAL '24 hours'
            AND status = 'down'
        )::int AS down_24h,

        COUNT(*)::int AS total_7d,

        COUNT(*) FILTER (
          WHERE status = 'up'
        )::int AS up_7d,

        COUNT(*) FILTER (
          WHERE status = 'down'
        )::int AS down_7d

      FROM monitor_checks
      WHERE monitor_id = $1
        AND checked_at >= NOW() - INTERVAL '7 days'
      `,
      [id]
    );

    const result = rows[0];

    return Response.json(
      {
        monitorId: id,
        periods: {
          last24Hours: calculateUptime(
            result.total_24h,
            result.up_24h,
            result.down_24h
          ),
          last7Days: calculateUptime(
            result.total_7d,
            result.up_7d,
            result.down_7d
          ),
        },
        checkedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Uptime calculation failed:", error);

    return Response.json(
      { error: "Unable to calculate uptime" },
      { status: 503 }
    );
  }
}
