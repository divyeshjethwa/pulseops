
"use client";

import { useEffect, useState } from "react";


type PerformanceData = {
    samples: number;
    slowChecks: number;
    evaluatedSamples: number;
    responseTime: {
        averageMs: number | null;
        minMs: number | null;
        maxMs: number | null;
        p95Ms: number | null;
    };
};


export default function MonitorPerformance({
    monitorId,
}: {
    monitorId: string;
}) {
    const [data, setData] = useState<PerformanceData | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function loadPerformance() {
            try {
                const response = await fetch(
                    `/api/monitors/${encodeURIComponent(monitorId)}/performance`,
                    { cache: "no-store" }
                );

                if (!response.ok) {
                    throw new Error("Failed to load performance");
                }

                const result = await response.json();

                if (!cancelled) {
                    setData(result);
                    setError(false);
                }
            } catch {
                if (!cancelled) setError(true);
            }
        }

        void loadPerformance();

        const interval = setInterval(() => {
            if (document.visibilityState === "visible") {
                void loadPerformance();
            }
        }, 60_000);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [monitorId]);

    const formatMs = (value: number | null) =>
        value === null ? "N/A" : `${value.toFixed(1)} ms`;

    const metrics = data
        ? [
            {
                label: "Average",
                value: data.responseTime.averageMs,
                description: "Mean response time",
            },
            {
                label: "Minimum",
                value: data.responseTime.minMs,
                description: "Fastest response",
            },
            {
                label: "Maximum",
                value: data.responseTime.maxMs,
                description: "Slowest response",
            },
            {
                label: "P95 Latency",
                value: data.responseTime.p95Ms,
                description: "95th percentile",
            },
        ]
        : [];

    return (
        <section className="my-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                    Response Time
                </h2>

                <span className="text-xs text-zinc-400">
                    Last 24 hours
                </span>
            </div>

            {error && (
                <p role="alert" className="mb-3 text-sm text-red-400">
                    Unable to refresh performance metrics.
                </p>
            )}

            {!data ? (
                <p className="text-sm text-zinc-400">
                    Loading performance metrics...
                </p>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        {metrics.map((metric) => (
                            <div
                                key={metric.label}
                                className="rounded-lg border border-zinc-800 bg-zinc-950 p-4"
                            >
                                <p className="text-xs text-zinc-400">
                                    {metric.label}
                                </p>

                                <p className="mt-2 text-xl font-semibold">
                                    {formatMs(metric.value)}
                                </p>

                                <p className="mt-2 text-xs text-zinc-500">
                                    {metric.description}
                                </p>
                            </div>
                        ))}
                    </div>


                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                        <div>
                            <p className="text-sm font-medium">
                                Slow Responses
                            </p>

                            <p className="mt-1 text-xs text-zinc-500">
                                Last 24 hours · Based on configured thresholds
                            </p>
                        </div>

                        <span
                            className={`text-sm font-semibold ${data.evaluatedSamples === 0
                                    ? "text-zinc-400"
                                    : data.slowChecks > 0
                                        ? "text-amber-400"
                                        : "text-emerald-400"
                                }`}
                        >
                            {data.evaluatedSamples === 0
                                ? "No evaluated checks"
                                : `${data.slowChecks} / ${data.evaluatedSamples} slow`}
                        </span>
                    </div>


                    <p className="mt-4 text-xs text-zinc-500">
                        Based on {data.samples} successful checks
                        in the last 24 hours.
                    </p>
                </>
            )}
        </section>
    );
}
