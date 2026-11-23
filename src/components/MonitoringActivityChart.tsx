
"use client";

import { useEffect, useState } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";

type TimelinePoint = {
    time: string;
    up: number;
    down: number;
};

type TimeRange = "1h" | "6h" | "24h";

export default function MonitoringActivityChart() {
    const [points, setPoints] = useState<TimelinePoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [range, setRange] = useState<TimeRange>("1h");


    useEffect(() => {
        function syncRangeFromUrl() {
            const params = new URLSearchParams(
                window.location.search
            );

            const value = params.get("range");

            const selectedRange: TimeRange =
                value === "6h" || value === "24h"
                    ? value
                    : "1h";

            setRange(selectedRange);
        }

        // Read the URL when the component mounts
        syncRangeFromUrl();

        // Handle browser Back and Forward buttons
        window.addEventListener("popstate", syncRangeFromUrl);

        return () => {
            window.removeEventListener(
                "popstate",
                syncRangeFromUrl
            );
        };
    }, []);


    useEffect(() => {
        let cancelled = false;
        let fetching = false;

        async function loadTimeline() {
            if (fetching) return;
            fetching = true;

            try {
                const response = await fetch(
                    `/api/system/activity/timeline?range=${range}`,
                    { cache: "no-store" }
                );

                if (!response.ok) {
                    throw new Error("Failed to fetch timeline");
                }

                const data = await response.json();

                if (!Array.isArray(data.points)) {
                    throw new Error("Invalid timeline response");
                }

                if (!cancelled) {
                    setPoints(data.points);
                    setError(false);
                }
            } catch {
                if (!cancelled) setError(true);
            } finally {
                fetching = false;
                if (!cancelled) setLoading(false);
            }
        }

        void loadTimeline();

        const interval = setInterval(() => {
            if (document.visibilityState === "visible") {
                void loadTimeline();
            }
        }, 30_000);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [range]);

    const chartData = points.map((point) => ({
        ...point,
        label: new Date(point.time).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        }),
    }));

    return (
        <div className="mt-6 border-t border-zinc-800 pt-6">

            <div className="mb-5 flex items-center justify-between gap-4">
                <h3 className="text-sm font-medium">
                    Check Timeline
                </h3>

                <div className="flex gap-1 rounded-lg bg-zinc-800 p-1">
                    {(["1h", "6h", "24h"] as const).map((option) => (
                        <button
                            key={option}
                            type="button"

                            onClick={() => {
                                if (option === range) return;

                                const url = new URL(window.location.href);

                                // Preserve existing query parameters
                                url.searchParams.set("range", option);

                                // Update the URL without reloading the page
                                window.history.pushState(null, "", url.toString());

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
                    Unable to refresh timeline.
                </p>
            )}

            {loading ? (
                <p className="text-sm text-zinc-400">
                    Loading timeline...
                </p>
            ) : (
                <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid
                                stroke="#27272a"
                                strokeDasharray="3 3"
                                vertical={false}
                            />

                            <XAxis
                                dataKey="label"
                                stroke="#a1a1aa"
                                fontSize={11}
                                interval="preserveStartEnd"
                            />

                            <YAxis
                                stroke="#a1a1aa"
                                fontSize={11}
                                allowDecimals={false}
                            />


                            <Tooltip
                                cursor={{ fill: "rgba(255,255,255,0.05)" }}
                                content={({ active, payload }) => {
                                    if (!active || !payload?.length) {
                                        return null;
                                    }

                                    const point = payload[0].payload as TimelinePoint;

                                    const bucketMinutes =
                                        range === "1h" ? 5 :
                                            range === "6h" ? 30 : 120;

                                    const start = new Date(point.time);

                                    const end = new Date(
                                        start.getTime() + bucketMinutes * 60_000
                                    );

                                    const formatTime = (date: Date) =>
                                        date.toLocaleString(undefined, {
                                            month: "short",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        });

                                    const total = point.up + point.down;

                                    return (
                                        <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4 shadow-xl">
                                            <p className="mb-3 text-xs text-zinc-400">
                                                {formatTime(start)} – {formatTime(end)}
                                            </p>

                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between gap-8">
                                                    <span className="text-emerald-400">
                                                        UP
                                                    </span>
                                                    <span>{point.up}</span>
                                                </div>

                                                <div className="flex justify-between gap-8">
                                                    <span className="text-red-400">
                                                        DOWN
                                                    </span>
                                                    <span>{point.down}</span>
                                                </div>

                                                <div className="border-t border-zinc-700 pt-2">
                                                    <div className="flex justify-between gap-8 font-semibold">
                                                        <span>Total</span>
                                                        <span>{total}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }}
                            />


                            <Legend />

                            <Bar
                                dataKey="up"
                                name="UP"
                                fill="#10b981"
                                radius={[3, 3, 0, 0]}
                            />

                            <Bar
                                dataKey="down"
                                name="DOWN"
                                fill="#ef4444"
                                radius={[3, 3, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
