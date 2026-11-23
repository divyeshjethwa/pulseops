
import pool from "@/lib/db";
import type { QueryResultRow } from "pg";
import { Suspense } from "react";
import Link from "next/link";
import MonitorToggleButton from "@/components/MonitorToggleButton";
import AddMonitorForm from "@/components/AddMonitorForm";
import DashboardAutoRefresh from "@/components/DashboardAutoRefresh";
import SystemHealth from "@/components/SystemHealth";
import QueueActivity from "@/components/QueueActivity";
import FailedJobs from "@/components/FailedJobs";
import MonitoringActivity from "@/components/MonitoringActivity";
import ResponseTimeThreshold from "@/components/ResponseTimeThreshold";

interface Monitor extends QueryResultRow {
  id: string;
  url: string;
  is_active: boolean;
  status: "up" | "down" | null;
  response_time_ms: number | null;
  checked_at: Date | null;
}

async function MonitorsDashboard() {
  const canManageMonitors = process.env.NODE_ENV === "development";
  const { rows: monitors } = await pool.query<Monitor>(`
    SELECT
      m.id,
      m.url,
      m.is_active,
      c.status,
      c.response_time_ms,
      c.checked_at
    FROM monitors m
    LEFT JOIN LATERAL (
      SELECT status, response_time_ms, checked_at
      FROM monitor_checks
      WHERE monitor_id = m.id
      ORDER BY checked_at DESC, id DESC
      LIMIT 1
    ) c ON TRUE
    ORDER BY m.created_at DESC
  `);

  const lastUpdatedAt = new Date().toISOString();

  const stats = {
    total: monitors.length,

    operational: monitors.filter(
      (monitor) =>
        monitor.is_active && monitor.status === "up"
    ).length,

    down: monitors.filter(
      (monitor) =>
        monitor.is_active && monitor.status === "down"
    ).length,

    paused: monitors.filter(
      (monitor) => !monitor.is_active
    ).length,
  };


  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mb-6">
        {/* <DashboardAutoRefresh lastUpdatedAt={lastUpdatedAt} /> */}
      </div>
      <div className="mx-auto max-w-5xl">
        <header className="mb-10">
          <p className="mb-3 text-sm font-medium text-emerald-400">
            PULSEOPS / MONITORING
          </p>

          <h1 className="text-3xl font-semibold">
            Your Monitors
          </h1>

          <p className="mt-2 text-zinc-400">
            Monitor availability and response times.
          </p>
        </header>


        <section className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            {
              label: "Total Monitors",
              value: stats.total,
              color: "text-white",
            },
            {
              label: "Operational",
              value: stats.operational,
              color: "text-emerald-400",
            },
            {
              label: "Down",
              value: stats.down,
              color: "text-red-400",
            },
            {
              label: "Paused",
              value: stats.paused,
              color: "text-zinc-400",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"
            >
              <p className="text-sm text-zinc-400">
                {stat.label}
              </p>

              <p className={`mt-3 text-3xl font-semibold ${stat.color}`}>
                {stat.value}
              </p>
            </div>
          ))}
        </section>

        <div className="mb-8">
          <SystemHealth />
        </div>

        {process.env.NODE_ENV === "development" && (
          <div className="mb-8 space-y-6">
            <MonitoringActivity />
            <QueueActivity />
            <FailedJobs />
          </div>
        )}

        <div className="mb-8">
          {canManageMonitors && (
            <AddMonitorForm />
          )}
        </div>

        <section className="space-y-4">
          {monitors.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 p-8">
              <p className="text-zinc-400">
                No monitors registered yet.
              </p>
            </div>
          ) : (
            monitors.map((monitor) => {
              const status = !monitor.is_active
                ? "Paused"
                : monitor.status === "up"
                  ? "Operational"
                  : monitor.status === "down"
                    ? "Down"
                    : "Not checked";

              const statusColor =
                status === "Operational"
                  ? "text-emerald-400"
                  : status === "Down"
                    ? "text-red-400"
                    : "text-zinc-400";


              return (
                <article
                  key={monitor.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <Link
                      href={`/monitors/${monitor.id}`}
                      className="min-w-0 flex-1 hover:text-emerald-400"
                    >
                      <h2 className="break-all font-medium">
                        {monitor.url}
                      </h2>

                      <p className="mt-2 text-sm text-zinc-400">
                        Response:{" "}
                        {monitor.response_time_ms === null
                          ? "—"
                          : `${monitor.response_time_ms} ms`}
                      </p>

                      <p className="mt-1 text-xs text-zinc-500">
                        Last checked:{" "}
                        {monitor.checked_at
                          ? monitor.checked_at.toISOString()
                          : "Never"}
                      </p>
                    </Link>

                    <div className="flex items-center gap-4">
                      <span className={`text-sm font-medium ${statusColor}`}>
                        ● {status}
                      </span>

                      {canManageMonitors && (
                        <MonitorToggleButton
                          monitorId={monitor.id}
                          isActive={monitor.is_active}
                        />
                      )}

                    </div>
                  </div>
                </article>
              );

            })
          )}
        </section>
      </div>
    </main>
  );
}


export default function Home() {
  return (
    <Suspense fallback={<p>Loading monitors...</p>}>
      <MonitorsDashboard />
    </Suspense>
  );
}
