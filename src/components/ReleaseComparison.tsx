
"use client";

import { useEffect, useState } from "react";

type Stats = {
  totalChecks: number;
  upChecks: number;
  downChecks: number;
  uptimePercent: number | null;
  averageResponseMs: number | null;
};

type Comparison = {
  release: {
    id: string;
    version: string;
    deployedAt: string;
  };
  windowMinutes: number;
  comparisonReady: boolean;
  before: Stats;
  after: Stats;
  changes: {
    uptimePercentagePoints: number | null;
    averageResponseMs: number | null;
  };

  regression: {
    status:
    | "possible_regression"
    | "no_regression"
    | "insufficient_data";
    reasons: string[];
  };

};

export default function ReleaseComparison({
  monitorId,
  releaseId,
}: {
  monitorId: string;
  releaseId: string;
}) {
  const [data, setData] = useState<Comparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadComparison() {
      try {
        const response = await fetch(
          `/api/monitors/${encodeURIComponent(monitorId)}/releases/${encodeURIComponent(releaseId)}/compare`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error("Unable to load comparison");
        }

        const result: Comparison = await response.json();

        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unknown error"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadComparison();

    return () => {
      cancelled = true;
    };
  }, [monitorId, releaseId]);

  const formatUptime = (value: number | null) =>
    value === null ? "N/A" : `${value.toFixed(2)}%`;

  const formatLatency = (value: number | null) =>
    value === null ? "N/A" : `${value.toFixed(1)} ms`;

  if (loading) {
    return <p className="text-sm text-zinc-400">Loading comparison...</p>;
  }

  if (error || !data) {
    return (
      <p role="alert" className="text-sm text-red-400">
        {error || "Comparison unavailable"}
      </p>
    );
  }

  const uptimeChange = data.changes.uptimePercentagePoints;
  const latencyChange = data.changes.averageResponseMs;

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-5">
      <h3 className="text-base font-semibold">
        Release {data.release.version}
      </h3>

      <p className="mt-1 text-xs text-zinc-400">
        Comparing {data.windowMinutes} minutes before and after deployment
      </p>


      <div
        role="status"
        className={`mt-4 rounded-lg border p-4 ${data.regression.status === "possible_regression"
            ? "border-red-900 bg-red-950/30"
            : data.regression.status === "no_regression"
              ? "border-emerald-900 bg-emerald-950/30"
              : "border-amber-900 bg-amber-950/30"
          }`}
      >
        <p className="text-sm font-semibold">
          {data.regression.status === "possible_regression"
            ? "⚠ Possible Regression Detected"
            : data.regression.status === "no_regression"
              ? "✓ No Regression Detected"
              : "◷ Insufficient Monitoring Data"}
        </p>

        {data.regression.status === "possible_regression" && (
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-zinc-300">
            {data.regression.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}

        {data.regression.status === "no_regression" && (
          <p className="mt-2 text-xs text-zinc-400">
            No evaluated metric exceeded our regression thresholds.
          </p>
        )}

        {data.regression.status === "insufficient_data" && (
          <p className="mt-2 text-xs text-zinc-400">
            Waiting for complete comparison windows
            containing at least 5 checks each.
          </p>
        )}
      </div>


      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(
          [
            ["Before Deployment", data.before],
            ["After Deployment", data.after],
          ] as const
        ).map(([label, stats]) => (
          <div
            key={label}
            className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
          >
            <p className="text-xs text-zinc-400">
              {label}
            </p>

            <p className="mt-3 text-2xl font-semibold">
              {formatUptime(stats.uptimePercent)}
            </p>
            <p className="text-xs text-zinc-500">
              Observed uptime
            </p>

            <p className="mt-4 text-lg font-medium">
              {formatLatency(stats.averageResponseMs)}
            </p>
            <p className="text-xs text-zinc-500">
              Average response time
            </p>

            <p className="mt-4 text-xs text-zinc-400">
              {stats.totalChecks} checks · {stats.downChecks} DOWN
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 space-y-3 border-t border-zinc-800 pt-4">
        <div className="flex justify-between gap-3 text-sm">
          <span className="text-zinc-400">Uptime change</span>
          <span
            className={
              uptimeChange === null
                ? "text-zinc-400"
                : uptimeChange < 0
                  ? "text-red-400"
                  : "text-emerald-400"
            }
          >
            {uptimeChange === null
              ? "N/A"
              : `${uptimeChange > 0 ? "+" : ""}${uptimeChange.toFixed(2)} pp`}
          </span>
        </div>

        <div className="flex justify-between gap-3 text-sm">
          <span className="text-zinc-400">Response time change</span>
          <span
            className={
              latencyChange === null
                ? "text-zinc-400"
                : latencyChange > 0
                  ? "text-red-400"
                  : "text-emerald-400"
            }
          >
            {latencyChange === null
              ? "N/A"
              : `${latencyChange > 0 ? "+" : ""}${latencyChange.toFixed(1)} ms`}
          </span>
        </div>
      </div>

      <p className="mt-4 text-xs text-zinc-500">
        Changes are based on recorded checks and do not
        establish that the deployment caused them.
      </p>
    </div>
  );
}
