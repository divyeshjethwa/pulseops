
import { connection } from "next/server";
import pool from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type HistoryRow = {
  bucket_start: Date;
  total_checks: number;
  up_checks: number;
  down_checks: number;
};

const ranges = {
  "24h": {
    unit: "hour",
    count: 24,
    intervalMinutes: 60,
  },
  "7d": {
    unit: "day",
    count: 7,
    intervalMinutes: 1440,
  },
  "30d": {
    unit: "day",
    count: 30,
    intervalMinutes: 1440,
  },
} as const;

type TimeRange = keyof typeof ranges;

export async function GET(
  request: Request,
  { params }: RouteContext
) {
  const { id } = await params;

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

  // Use the standard UUID pattern
  const validUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!validUuid.test(id)) {
    return Response.json(
      { error: "Invalid monitor ID" },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") ?? "24h";

  if (!Object.prototype.hasOwnProperty.call(ranges, range)) {
    return Response.json(
      { error: "Invalid time range" },
      { status: 400 }
    );
  }

  const config = ranges[range as TimeRange];

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

    const { rows } = await pool.query<HistoryRow>(
      `
      WITH bounds AS (
        SELECT date_trunc(
          $2::text,
          NOW()
        ) AS current_bucket
      ),

      buckets AS (
        SELECT generate_series(
          current_bucket
            - ($3::int - 1)
              * ($4::int * INTERVAL '1 minute'),

          current_bucket,

          $4::int * INTERVAL '1 minute'
        ) AS bucket_start

        FROM bounds
      )

      SELECT
        b.bucket_start,

        COUNT(c.id)::int AS total_checks,

        COUNT(c.id) FILTER (
          WHERE c.status = 'up'
        )::int AS up_checks,

        COUNT(c.id) FILTER (
          WHERE c.status = 'down'
        )::int AS down_checks

      FROM buckets b

      LEFT JOIN monitor_checks c
        ON c.monitor_id = $1
        AND c.checked_at >= b.bucket_start
        AND c.checked_at < b.bucket_start
          + ($4::int * INTERVAL '1 minute')

      GROUP BY b.bucket_start
      ORDER BY b.bucket_start ASC
      `,
      [
        id,
        config.unit,
        config.count,
        config.intervalMinutes,
      ]
    );

    const history = rows.map((row) => {
      let status: "up" | "mixed" | "down" | "unknown";

      if (row.total_checks === 0) {
        status = "unknown";
      } else if (row.down_checks === 0) {
        status = "up";
      } else if (row.up_checks === 0) {
        status = "down";
      } else {
        status = "mixed";
      }

      return {
        time: row.bucket_start.toISOString(),
        totalChecks: row.total_checks,
        upChecks: row.up_checks,
        downChecks: row.down_checks,
        status,
      };
    });

    return Response.json(
      {
        monitorId: id,
        range,
        intervalMinutes: config.intervalMinutes,
        history,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Uptime history failed:", error);

    return Response.json(
      { error: "Unable to retrieve uptime history" },
      { status: 503 }
    );
  }
}
