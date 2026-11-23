
import { connection } from "next/server";
import pool from "@/lib/db";

type RouteContext = {
    params: Promise<{ id: string }>;
};

type PerformanceRow = {
    samples: number;
    average_ms: number | null;
    min_ms: number | null;
    max_ms: number | null;
    p95_ms: number | null;
    slow_checks: number;
    evaluated_samples: number;
};

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

        const { rows } = await pool.query<PerformanceRow>(
            `
      SELECT
        COUNT(*)::int AS samples,
        COUNT(*) FILTER (
        WHERE is_slow = TRUE
        )::int AS slow_checks,

        COUNT(*) FILTER (
        WHERE is_slow IS NOT NULL
        )::int AS evaluated_samples,

        ROUND(
          AVG(response_time_ms)::numeric,
          1
        )::float AS average_ms,

        MIN(response_time_ms)::int AS min_ms,

        MAX(response_time_ms)::int AS max_ms,

        ROUND(
          (
            percentile_cont(0.95)
            WITHIN GROUP (
              ORDER BY response_time_ms
            )
          )::numeric,
          1
        )::float AS p95_ms

      FROM monitor_checks
      WHERE monitor_id = $1
        AND checked_at >= NOW() - INTERVAL '24 hours'
        AND status = 'up'
        AND response_time_ms IS NOT NULL
        AND response_time_ms >= 0
      `,
            [id]
        );

        const result = rows[0];

        return Response.json(
            {
                monitorId: id,
                windowHours: 24,
                samples: result.samples,
                slowChecks: result.slow_checks,
                evaluatedSamples: result.evaluated_samples,
                responseTime: {
                    averageMs: result.average_ms,
                    minMs: result.min_ms,
                    maxMs: result.max_ms,
                    p95Ms: result.p95_ms,
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
        console.error("Performance metrics failed:", error);

        return Response.json(
            { error: "Unable to retrieve performance metrics" },
            { status: 503 }
        );
    }
}
