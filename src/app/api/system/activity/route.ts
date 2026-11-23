
import { connection } from "next/server";
import pool from "@/lib/db";

type ActivityRow = {
  total_checks: number;
  recent_checks: number;
  up_checks: number;
  down_checks: number;
  down_rate: number | null;
};

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return Response.json(
      { error: "Not found" },
      { status: 404 }
    );
  }

  await connection();

  try {
    const { rows } = await pool.query<ActivityRow>(`
      SELECT
        COUNT(*)::int AS total_checks,

        COUNT(*) FILTER (
          WHERE checked_at >= NOW() - INTERVAL '5 minutes'
        )::int AS recent_checks,

        COUNT(*) FILTER (
          WHERE status = 'up'
        )::int AS up_checks,

        COUNT(*) FILTER (
          WHERE status = 'down'
        )::int AS down_checks,

        ROUND(
          100.0 * COUNT(*) FILTER (
            WHERE status = 'down'
          ) / NULLIF(COUNT(*), 0),
          1
        )::float AS down_rate

      FROM monitor_checks
      WHERE checked_at >= NOW() - INTERVAL '60 minutes'
    `);

    const result = rows[0];

    return Response.json(
      {
        windowMinutes: 60,
        checks: {
          total: result.total_checks,
          lastFiveMinutes: result.recent_checks,
          up: result.up_checks,
          down: result.down_checks,
          downRatePercent: result.down_rate,
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
    console.error("Activity metrics failed:", error);

    return Response.json(
      { error: "Unable to retrieve activity metrics" },
      { status: 503 }
    );
  }
}
