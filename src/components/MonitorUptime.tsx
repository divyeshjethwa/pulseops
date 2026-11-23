
"use client";

import { useEffect, useState } from "react";

type UptimePeriod = {
  totalChecks: number;
  upChecks: number;
  downChecks: number;
  uptimePercent: number | null;
};

type UptimeResponse = {
  periods: {
    last24Hours: UptimePeriod;
    last7Days: UptimePeriod;
  };
};

export default function MonitorUptime({
  monitorId,
}: {
  monitorId: string;
}) {
  const [data, setData] = useState<UptimeResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadUptime() {
      try {
        const response = await fetch(
          `/api/monitors/${encodeURIComponent(monitorId)}/uptime`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error("Failed to load uptime");
        }

        const result: UptimeResponse = await response.json();

        if (!cancelled) {
          setData(result);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    void loadUptime();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadUptime();
      }
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [monitorId]);

  const periods = data
    ? [
        {
          label: "Last 24 Hours",
          value: data.periods.last24Hours,
        },
        {
          label: "Last 7 Days",
          value: data.periods.last7Days,
        },
      ]
    : [];

  return (
    <section className="my-6">
      <h2 className="mb-4 text-lg font-semibold">
        Uptime Statistics
      </h2>

      {error && (
        <p role="alert" className="mb-3 text-sm text-red-400">
          Unable to refresh uptime statistics.
        </p>
      )}

      {!data ? (
        <p className="text-sm text-zinc-400">
          Loading uptime statistics...
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {periods.map(({ label, value }) => {
            const percent = value.uptimePercent;

            return (
              <div
                key={label}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"
              >
                <p className="text-sm text-zinc-400">
                  {label}
                </p>

                <p
                  className={`mt-2 text-3xl font-semibold ${
                    percent === null
                      ? "text-zinc-400"
                      : percent >= 99
                        ? "text-emerald-400"
                        : "text-amber-400"
                  }`}
                >
                  {percent === null
                    ? "N/A"
                    : `${percent.toFixed(2)}%`}
                </p>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${percent ?? 0}%` }}
                  />
                </div>

                <div className="mt-4 flex flex-wrap justify-between gap-2 text-xs text-zinc-400">
                  <span>{value.totalChecks} checks</span>
                  <span>{value.upChecks} UP</span>
                  <span>{value.downChecks} DOWN</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-xs text-zinc-500">
        Uptime is estimated from recorded health checks,
        not continuous availability.
      </p>
    </section>
  );
}
