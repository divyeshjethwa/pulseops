
"use client";

import { useEffect, useState } from "react";

type HistoryEntry = {
    time: string;
    totalChecks: number;
    upChecks: number;
    downChecks: number;
    status: "up" | "mixed" | "down" | "unknown";
};

type TimeRange = "24h" | "7d" | "30d";

const colors = {
    up: "bg-emerald-500",
    mixed: "bg-amber-500",
    down: "bg-red-500",
    unknown: "bg-zinc-700",
};

export default function UptimeHistory({
    monitorId,
}: {
    monitorId: string;
}) {
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [range, setRange] = useState<TimeRange>("24h");
    const [intervalMinutes, setIntervalMinutes] = useState(60);

    useEffect(() => {
        let cancelled = false;

        async function loadHistory() {
            try {
                const response = await fetch(
                    `/api/monitors/${encodeURIComponent(monitorId)}/uptime/history?range=${range}`,
                    { cache: "no-store" }
                );

                if (!response.ok) {
                    throw new Error("Failed to load history");
                }

                const data = await response.json();

                if (!Array.isArray(data.history)) {
                    throw new Error("Invalid history response");
                }

                if (!cancelled) {
                    setHistory(data.history);
                    setIntervalMinutes(data.intervalMinutes);
                    setError(false);
                }
            } catch {
                if (!cancelled) setError(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        void loadHistory();

        const interval = setInterval(() => {
            if (document.visibilityState === "visible") {
                void loadHistory();
            }
        }, 60_000);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [monitorId, range]);


    const summary = history.reduce(
        (counts, entry) => {
            counts[entry.status]++;
            return counts;
        },
        {
            up: 0,
            mixed: 0,
            down: 0,
            unknown: 0,
        }
    );

    const summaryMetrics = [
        { label: "All UP", value: summary.up, color: "text-emerald-400" },
        { label: "Mixed", value: summary.mixed, color: "text-amber-400" },
        { label: "All DOWN", value: summary.down, color: "text-red-400" },
        { label: "No Data", value: summary.unknown, color: "text-zinc-400" },
    ];


    return (
        <section className="my-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">

            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">
                    Uptime History
                </h2>

                <div className="flex gap-1 rounded-lg bg-zinc-800 p-1">
                    {(["24h", "7d", "30d"] as const).map((option) => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => {
                                if (option === range) return;

                                setLoading(true);
                                setError(false);
                                setRange(option);
                            }}
                            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${range === option
                                ? "bg-zinc-600 text-white"
                                : "text-zinc-400 hover:text-white"
                                }`}
                        >
                            {option.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>


            {error && (
                <p role="alert" className="mb-3 text-sm text-red-400">
                    Unable to refresh uptime history.
                </p>
            )}

            {loading ? (
                <p className="text-sm text-zinc-400">
                    Loading history...
                </p>
            ) : (
                <>

                    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {summaryMetrics.map((metric) => (
                            <div
                                key={metric.label}
                                className="rounded-lg border border-zinc-800 bg-zinc-950 p-4"
                            >
                                <p className="text-xs text-zinc-400">
                                    {metric.label}
                                </p>

                                <p
                                    className={`mt-2 text-2xl font-semibold ${metric.color}`}
                                >
                                    {metric.value}
                                </p>

                                <p className="mt-1 text-xs text-zinc-500">
                                    {range === "24h" ? "hours" : "days"}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div
                        className={`grid gap-1.5 ${range === "24h"
                            ? "grid-cols-12 md:grid-cols-24"
                            : range === "7d"
                                ? "grid-cols-7"
                                : "grid-cols-10"
                            }`}
                    >
                        {history.map((entry, index) => {
                            const start = new Date(entry.time);
                            const end = new Date(
                                start.getTime() + intervalMinutes * 60_000
                            );

                            const uptimePercent =
                                entry.totalChecks === 0
                                    ? null
                                    : (entry.upChecks / entry.totalChecks) * 100;

                            const uptimeLabel =
                                uptimePercent === null
                                    ? "N/A"
                                    : `${uptimePercent.toFixed(2)}%`;


                            const tooltip = [
                                `${start.toLocaleString()} – ${end.toLocaleString()}`,
                                `Status: ${entry.status.toUpperCase()}`,
                                `Observed uptime: ${uptimeLabel}`,
                                `UP checks: ${entry.upChecks}`,
                                `DOWN checks: ${entry.downChecks}`,
                                `Total checks: ${entry.totalChecks}`,
                            ].join("\n");


                            return (

                                <div
                                    key={entry.time}
                                    tabIndex={0}
                                    aria-label={tooltip.replaceAll("\n", ", ")}
                                    className={`group relative h-8 rounded-sm
                                    focus-visible:outline-2 focus-visible:outline-white
                                    ${colors[entry.status]}`}
                                >
                                    <div
                                        role="tooltip"
                                        className={`pointer-events-none absolute bottom-full z-50 mb-2
                                        hidden w-60 rounded-lg border border-zinc-700
                                        bg-zinc-950 p-3 text-white shadow-xl
                                        group-hover:block group-focus:block
                                        ${index >= history.length / 2 ? "right-0" : "left-0"}`}
                                    >
                                        <p className="mb-3 text-xs text-zinc-400">
                                            {start.toLocaleString()} –
                                            {" "}{end.toLocaleString()}
                                        </p>

                                        <div className="space-y-2 text-xs">
                                            <div className="flex justify-between">
                                                <span>Status</span>
                                                <span className="uppercase">{entry.status}</span>
                                            </div>

                                            <div className="flex justify-between">
                                                <span>Observed uptime</span>
                                                <span className="font-semibold">
                                                    {uptimeLabel}
                                                </span>
                                            </div>

                                            <div className="flex justify-between">
                                                <span>UP checks</span>
                                                <span>{entry.upChecks}</span>
                                            </div>

                                            <div className="flex justify-between">
                                                <span>DOWN checks</span>
                                                <span>{entry.downChecks}</span>
                                            </div>

                                            <div className="flex justify-between border-t border-zinc-700 pt-2">
                                                <span>Total checks</span>
                                                <span>{entry.totalChecks}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            );
                        })}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-4 text-xs text-zinc-400">
                        {(
                            [
                                ["up", "All UP"],
                                ["mixed", "Mixed"],
                                ["down", "All DOWN"],
                                ["unknown", "No data"],
                            ] as const
                        ).map(([status, label]) => (
                            <div
                                key={status}
                                className="flex items-center gap-2"
                            >
                                <span
                                    className={`h-3 w-3 rounded-sm ${colors[status]}`}
                                />
                                <span>{label}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}

            <p className="mt-4 text-xs text-zinc-500">
                Each block represents {range === "24h" ? "one hour" : "one day"}
                {" "}of recorded checks. No data does not mean downtime.
            </p>
        </section>
    );
}
