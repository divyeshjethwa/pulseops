
import { connection } from "next/server";
import pool from "@/lib/db";

type Context = {
  params: Promise<{
    id: string;
    releaseId: string;
  }>;
};

type Release = {
  id: string;
  version: string;
  deployed_at: Date;
};

type StatsRow = {
  period: "before" | "after";
  total_checks: number;
  up_checks: number;
  down_checks: number;
  average_ms: number | null;
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function formatStats(row: StatsRow) {
  return {
    totalChecks: row.total_checks,
    upChecks: row.up_checks,
    downChecks: row.down_checks,
    uptimePercent: row.total_checks
      ? Number(
        ((row.up_checks / row.total_checks) * 100).toFixed(2)
      )
      : null,
    averageResponseMs: row.average_ms,
  };
}


function detectRegression(
  before: ReturnType<typeof formatStats>,
  after: ReturnType<typeof formatStats>,
  comparisonReady: boolean
) {
  if (!comparisonReady) {
    return {
      status: "insufficient_data",
      reasons: [] as string[],
    };
  }

  const reasons: string[] = [];

  // Rule 1: Observed uptime dropped by at least 5 pp
  if (
    before.uptimePercent !== null &&
    after.uptimePercent !== null &&
    before.uptimePercent - after.uptimePercent >= 5
  ) {
    reasons.push("Observed uptime dropped by at least 5 percentage points");
  }

  // Rule 2: Latency increased by >=25% AND >=100ms
  const beforeMs = before.averageResponseMs;
  const afterMs = after.averageResponseMs;

  if (
    beforeMs !== null &&
    afterMs !== null &&
    beforeMs > 0 &&
    afterMs - beforeMs >= 100 &&
    afterMs >= beforeMs * 1.25
  ) {
    reasons.push("Average response time increased significantly");
  }

  return {
    status:
      reasons.length > 0
        ? "possible_regression"
        : "no_regression",
    reasons,
  };
}


export async function GET(
  _request: Request,
  { params }: Context
) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json(
      { error: "Not found" },
      { status: 404 }
    );
  }

  const { id, releaseId } = await params;

  if (!isUuid(id) || !isUuid(releaseId)) {
    return Response.json(
      { error: "Invalid ID" },
      { status: 400 }
    );
  }

  await connection();

  try {
    // Find this release belonging to this monitor
    const releaseResult = await pool.query<Release>(
      `SELECT id, version, deployed_at
       FROM monitor_releases
       WHERE id = $1 AND monitor_id = $2`,
      [releaseId, id]
    );

    const release = releaseResult.rows[0];

    if (!release) {
      return Response.json(
        { error: "Release not found" },
        { status: 404 }
      );
    }

    // Compare two 30-minute windows
    const { rows } = await pool.query<StatsRow>(
      `
      WITH windows AS (
        SELECT
          'before'::text AS period,
          $2::timestamptz - INTERVAL '30 minutes' AS starts_at,
          $2::timestamptz AS ends_at

        UNION ALL

        SELECT
          'after'::text AS period,
          $2::timestamptz AS starts_at,
          $2::timestamptz + INTERVAL '30 minutes' AS ends_at
      )

      SELECT
        w.period,

        COUNT(c.id)::int AS total_checks,

        COUNT(c.id) FILTER (
          WHERE c.status = 'up'
        )::int AS up_checks,

        COUNT(c.id) FILTER (
          WHERE c.status = 'down'
        )::int AS down_checks,

        ROUND(
          AVG(c.response_time_ms) FILTER (
            WHERE c.status = 'up'
              AND c.response_time_ms >= 0
          )::numeric,
          1
        )::float AS average_ms

      FROM windows w

      LEFT JOIN monitor_checks c
        ON c.monitor_id = $1
        AND c.checked_at >= w.starts_at
        AND c.checked_at < w.ends_at

      GROUP BY w.period, w.starts_at, w.ends_at
      ORDER BY w.starts_at
      `,
      [id, release.deployed_at]
    );

    const beforeRow = rows.find(
      (row) => row.period === "before"
    )!;

    const afterRow = rows.find(
      (row) => row.period === "after"
    )!;

    const before = formatStats(beforeRow);
    const after = formatStats(afterRow);

    const deployedAt = new Date(release.deployed_at);
    const afterWindowComplete =
      Date.now() >= deployedAt.getTime() + 30 * 60_000;

    const comparisonReady =
      afterWindowComplete &&
      before.totalChecks >= 5 &&
      after.totalChecks >= 5;

    const regression = detectRegression(
      before,
      after,
      comparisonReady
    );

    return Response.json(
      {
        release: {
          id: release.id,
          version: release.version,
          deployedAt: release.deployed_at,
        },
        windowMinutes: 30,
        comparisonReady,
        before,
        after,
        changes: {
          uptimePercentagePoints:
            before.uptimePercent !== null &&
              after.uptimePercent !== null
              ? Number(
                (
                  after.uptimePercent - before.uptimePercent
                ).toFixed(2)
              )
              : null,

          averageResponseMs:
            before.averageResponseMs !== null &&
              after.averageResponseMs !== null
              ? Number(
                (
                  after.averageResponseMs -
                  before.averageResponseMs
                ).toFixed(1)
              )
              : null,
            regression,
        },
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("Release comparison failed:", error);

    return Response.json(
      { error: "Unable to compare release" },
      { status: 503 }
    );
  }
}
