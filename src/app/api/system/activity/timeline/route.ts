
import { connection } from "next/server";
import pool from "@/lib/db";

type TimelineRow = {
  time: Date;
  up: number;
  down: number;
};

const ranges = {
  "1h": 5,
  "6h": 30,
  "24h": 120,
} as const;

type TimeRange = keyof typeof ranges;

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json(
      { error: "Not found" },
      { status: 404 }
    );
  }

  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") ?? "1h";

  if (!(range in ranges)) {
    return Response.json(
      { error: "Invalid time range" },
      { status: 400 }
    );
  }

  const bucketMinutes = ranges[range as TimeRange];

  await connection();

  try {
    const { rows } = await pool.query<TimelineRow>(
      `
      WITH current_bucket AS (
        SELECT date_bin(
          $1::integer * INTERVAL '1 minute',
          NOW(),
          TIMESTAMPTZ '2000-01-01 00:00:00+00'
        ) AS start_time
      ),

      buckets AS (
        SELECT generate_series(
          start_time - 11 * (
            $1::integer * INTERVAL '1 minute'
          ),
          start_time,
          $1::integer * INTERVAL '1 minute'
        ) AS bucket_start
        FROM current_bucket
      )

      SELECT
        b.bucket_start AS time,

        COUNT(c.id) FILTER (
          WHERE c.status = 'up'
        )::int AS up,

        COUNT(c.id) FILTER (
          WHERE c.status = 'down'
        )::int AS down

      FROM buckets b

      LEFT JOIN monitor_checks c
        ON c.checked_at >= b.bucket_start
        AND c.checked_at < b.bucket_start
          + ($1::integer * INTERVAL '1 minute')

      GROUP BY b.bucket_start
      ORDER BY b.bucket_start ASC
      `,
      [bucketMinutes]
    );

    return Response.json(
      {
        range,
        bucketMinutes,
        points: rows.map((row) => ({
          time: row.time.toISOString(),
          up: row.up,
          down: row.down,
        })),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Timeline query failed:", error);

    return Response.json(
      { error: "Unable to retrieve timeline" },
      { status: 503 }
    );
  }
}
