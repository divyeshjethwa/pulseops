
"use client";

import { useEffect, useState } from "react";
import MonitoringActivityChart from "./MonitoringActivityChart";

type Activity = {
  total: number;
  lastFiveMinutes: number;
  up: number;
  down: number;
  downRatePercent: number | null;
};

export default function MonitoringActivity() {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let fetching = false;

    async function loadActivity() {
      if (fetching) return;
      fetching = true;

      try {
        const response = await fetch("/api/system/activity", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load activity");
        }

        const data = await response.json();

        if (!data.checks) {
          throw new Error("Invalid activity response");
        }

        if (!cancelled) {
          setActivity(data.checks);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        fetching = false;
      }
    }

    void loadActivity();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadActivity();
      }
    }, 30_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const metrics = activity
    ? [
        { label: "Checks (1h)", value: activity.total },
        { label: "Checks (5m)", value: activity.lastFiveMinutes },
        { label: "UP Checks", value: activity.up },
        { label: "DOWN Checks", value: activity.down },
      ]
    : [];

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Monitoring Activity
        </h2>

        <span className="text-xs text-zinc-500">
          Last 60 minutes
        </span>
      </div>

      {error && (
        <p role="alert" className="mb-3 text-sm text-red-400">
          Unable to refresh activity metrics.
        </p>
      )}

      {!activity ? (
        <p className="text-sm text-zinc-400">
          Loading activity...
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-lg border border-zinc-800 bg-zinc-950 p-4"
              >
                <p className="text-xs text-zinc-400">
                  {metric.label}
                </p>

                <p className="mt-2 text-2xl font-semibold">
                  {metric.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-zinc-400">
                Down check rate
              </span>

              <span>
                {activity.downRatePercent === null
                  ? "N/A"
                  : `${activity.downRatePercent}%`}
              </span>
            </div>

            
            <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-red-500 transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(0, activity.downRatePercent ?? 0)
                  )}%`,
                }}
              />
            </div>
          </div>

        <MonitoringActivityChart />

        </>
      )}
    </section>
  );
}
