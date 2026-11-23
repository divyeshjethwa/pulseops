
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { QueryResultRow } from "pg";
import pool from "@/lib/db";
import ResponseTimeChart from "@/components/ResponseTimeChart";
import MonitorUptime from "@/components/MonitorUptime";
import UptimeHistory from "@/components/UptimeHistory";
import MonitorPerformance from "@/components/MonitorPerformance";
import ResponseTimeThreshold from "@/components/ResponseTimeThreshold";
import ReleaseHistory from "@/components/ReleaseHistory";

interface Check extends QueryResultRow {
  id: string;
  status: "up" | "down";
  status_code: number | null;
  response_time_ms: number | null;
  checked_at: Date;
}

interface Incident extends QueryResultRow {
  id: string;
  started_at: Date;
  resolved_at: Date | null;
  duration_seconds: number;
}

interface MonitorStats extends QueryResultRow {
  total_checks: number;
  failed_checks: number;
  avg_response_ms: number | null;
  success_rate: number;
}

type Props = {
  params: Promise<{ id: string }>;
};


function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}


async function MonitorDetails({ params }: Props) {
  const { id } = await params;

  // Validate the ID before querying PostgreSQL
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;

  if (!uuidPattern.test(id)) {
    notFound();
  }

  const monitor = await pool.query(
    "SELECT id, url FROM monitors WHERE id = $1",
    [id]
  );

  if (monitor.rows.length === 0) {
    notFound();
  }

  const { rows: checks } = await pool.query<Check>(
    `SELECT id, status, status_code,
            response_time_ms, checked_at
     FROM monitor_checks
     WHERE monitor_id = $1
     ORDER BY checked_at DESC, id DESC
     LIMIT 20`,
    [id]
  );


  const { rows } = await pool.query<MonitorStats>(
    `SELECT
    COUNT(*)::integer AS total_checks,

    COUNT(*) FILTER (
      WHERE status = 'down'
    )::integer AS failed_checks,

    ROUND(AVG(response_time_ms) FILTER (
      WHERE status = 'up'
    ))::integer AS avg_response_ms,

    COALESCE(
      ROUND(
        100.0 * COUNT(*) FILTER (
          WHERE status = 'up'
        ) / NULLIF(COUNT(*), 0),
        1
      ),
      0
    )::float8 AS success_rate

  FROM monitor_checks
  WHERE monitor_id = $1`,
    [id]
  );

  const stats = rows[0];


  const chartData = checks
    .filter((check) => check.response_time_ms !== null)
    .map((check) => ({
      time: check.checked_at.toISOString(),
      responseTime: check.response_time_ms!,
    }))
    .reverse();


  const { rows: incidents } = await pool.query<Incident>(
    `SELECT
    id,
    started_at,
    resolved_at,
    ROUND(
      EXTRACT(EPOCH FROM (
        COALESCE(resolved_at, NOW()) - started_at
      ))
    )::integer AS duration_seconds
   FROM incidents
   WHERE monitor_id = $1
   ORDER BY started_at DESC, id DESC
   LIMIT 20`,
    [id]
  );


  return (
    <main className="min-h-screen bg-zinc-950 p-8 text-white">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm text-emerald-400">
          ← Back to monitors
        </Link>

        <h1 className="mt-8 text-2xl font-semibold">
          {monitor.rows[0].url}
        </h1>

        <p className="mt-2 text-zinc-400">
          Latest 20 health checks
        </p>

        <MonitorUptime monitorId={id} />

        <UptimeHistory monitorId={id} />

        <MonitorPerformance monitorId={id} />

        {process.env.NODE_ENV === "development" && (
          <ResponseTimeThreshold monitorId={id} />
        )}

        {process.env.NODE_ENV === "development" && (
          <ReleaseHistory monitorId={id} />
        )}


        <section className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            {
              label: "Check success rate",
              value: `${stats.success_rate}%`,
            },
            {
              label: "Avg. response time",
              value: stats.avg_response_ms === null
                ? "—"
                : `${stats.avg_response_ms} ms`,
            },
            {
              label: "Total checks",
              value: stats.total_checks,
            },
            {
              label: "Failed checks",
              value: stats.failed_checks,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"
            >
              <p className="text-sm text-zinc-400">
                {stat.label}
              </p>

              <p className="mt-3 text-2xl font-semibold">
                {stat.value}
              </p>
            </div>
          ))}
        </section>


        <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-6 text-lg font-semibold">
            Response Time
          </h2>

          <ResponseTimeChart data={chartData} />

          <p className="mt-4 text-xs text-zinc-500">
            Showing the latest {chartData.length} measurements.
            Times on the chart use UTC.
          </p>
        </section>


        <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-6 text-lg font-semibold">
            Incident History
          </h2>

          {incidents.length === 0 ? (
            <p className="text-sm text-zinc-400">
              No incidents detected.
            </p>
          ) : (

            <ol className="ml-2 border-l border-zinc-700">
              {incidents.map((incident) => {
                const ongoing = incident.resolved_at === null;

                return (
                  <li
                    key={incident.id}
                    className="relative mb-8 ml-6 last:mb-0"
                  >
                    {/* Timeline indicator */}
                    <span
                      className={`absolute -left-[31px] top-1.5 h-3 w-3 rounded-full ring-4 ring-zinc-900 ${ongoing ? "bg-red-400" : "bg-emerald-400"
                        }`}
                    />

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="font-medium">
                        {ongoing
                          ? "Website unavailable"
                          : "Downtime incident"}
                      </h3>

                      <span
                        className={`text-xs font-medium ${ongoing ? "text-red-400" : "text-emerald-400"
                          }`}
                      >
                        {ongoing ? "ONGOING" : "RESOLVED"}
                      </span>
                    </div>

                    <div className="mt-3 space-y-2 text-sm text-zinc-400">
                      <p>
                        Started:{" "}
                        {incident.started_at.toLocaleString("en-GB", {
                          timeZone: "UTC",
                        })}{" "}
                        UTC
                      </p>

                      {incident.resolved_at && (
                        <p>
                          Resolved:{" "}
                          {incident.resolved_at.toLocaleString("en-GB", {
                            timeZone: "UTC",
                          })}{" "}
                          UTC
                        </p>
                      )}

                      <p className="font-medium text-white">
                        Duration: {formatDuration(incident.duration_seconds)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>

          )}
        </section>


        <div className="mt-8 space-y-3">
          {checks.length === 0 && (
            <p className="text-zinc-400">
              No health checks recorded yet.
            </p>
          )}

          {checks.map((check) => (
            <div
              key={check.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4"
            >
              <div>
                <p className={
                  check.status === "up"
                    ? "text-emerald-400"
                    : "text-red-400"
                }>
                  {check.status.toUpperCase()}
                </p>

                <p className="mt-1 text-sm text-zinc-500">
                  {check.checked_at.toISOString()}
                </p>
              </div>

              <div className="text-right text-sm">
                <p>
                  {check.response_time_ms ?? "—"} ms
                </p>

                <p className="mt-1 text-zinc-500">
                  HTTP {check.status_code ?? "—"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function MonitorPage({ params }: Props) {
  return (
    <Suspense fallback={<p>Loading monitor history...</p>}>
      <MonitorDetails params={params} />
    </Suspense>
  );
}
