
"use client";

import { useEffect, useState } from "react";

type JobCounts = {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
};

const metrics: {
  label: string;
  key: keyof JobCounts;
}[] = [
  { label: "Waiting", key: "waiting" },
  { label: "Active", key: "active" },
  { label: "Completed", key: "completed" },
  { label: "Failed", key: "failed" },
  { label: "Delayed", key: "delayed" },
];

export default function QueueActivity() {
  const [jobs, setJobs] = useState<JobCounts | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let fetching = false;

    async function loadQueue() {
      if (fetching) return;
      fetching = true;

      try {
        const response = await fetch("/api/system/queue", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch queue statistics");
        }

        const data = await response.json();

        if (!data.jobs) {
          throw new Error("Invalid queue response");
        }

        if (!cancelled) {
          setJobs(data.jobs);
          setError(false);
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      } finally {
        fetching = false;
      }
    }

    void loadQueue();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadQueue();
      }
    }, 30_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Queue Activity
        </h2>

        <span className="text-xs text-zinc-500">
          Updates every 30s
        </span>
      </div>

      {error && (
        <p role="alert" className="mb-3 text-sm text-red-400">
          Unable to refresh queue statistics
        </p>
      )}

      {!jobs ? (
        <p className="text-sm text-zinc-400">
          Loading queue activity...
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {metrics.map((metric) => (
            <div
              key={metric.key}
              className="rounded-lg border border-zinc-800 bg-zinc-950 p-4"
            >
              <p className="text-xs text-zinc-400">
                {metric.label}
              </p>

              <p className={`mt-2 text-2xl font-semibold ${
                metric.key === "failed"
                  ? "text-red-400"
                  : metric.key === "completed"
                    ? "text-emerald-400"
                    : "text-white"
              }`}>
                {jobs[metric.key]}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
