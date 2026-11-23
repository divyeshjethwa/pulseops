
"use client";

import { useEffect, useState } from "react";

type FailedJob = {
    id: string;
    name: string;
    monitorId: string | null;
    error: string;
    attemptsMade: number;
    failedAt: string | null;
};

export default function FailedJobs() {
    const [jobs, setJobs] = useState<FailedJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [retryingId, setRetryingId] = useState<string | null>(null);
    const [retryError, setRetryError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        let fetching = false;

        async function loadFailedJobs() {
            if (fetching) return;
            fetching = true;

            try {
                const response = await fetch(
                    "/api/system/queue/failed",
                    { cache: "no-store" }
                );

                if (!response.ok) {
                    throw new Error("Failed to retrieve jobs");
                }

                const data = await response.json();

                if (!Array.isArray(data.failedJobs)) {
                    throw new Error("Invalid API response");
                }

                if (!cancelled) {
                    setJobs(data.failedJobs);
                    setError(false);
                }
            } catch {
                if (!cancelled) setError(true);
            } finally {
                fetching = false;
                if (!cancelled) setLoading(false);
            }
        }

        void loadFailedJobs();

        const interval = setInterval(() => {
            if (document.visibilityState === "visible") {
                void loadFailedJobs();
            }
        }, 30_000);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);


    async function handleRetry(jobId: string) {
        if (retryingId !== null) return;

        setRetryingId(jobId);
        setRetryError(null);

        try {
            const response = await fetch(
                "/api/system/queue/retry",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ jobId }),
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.error || "Failed to retry job"
                );
            }

            // Remove the requeued job from the failed list
            setJobs((current) =>
                current.filter((job) => job.id !== jobId)
            );
        } catch (error) {
            setRetryError(
                error instanceof Error
                    ? error.message
                    : "Something went wrong"
            );
        } finally {
            setRetryingId(null);
        }
    }


    return (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-6 flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                    Failed Jobs
                </h2>

                <span className="text-xs text-zinc-500">
                    Latest 10
                </span>
            </div>

            {retryError && (
                <p role="alert" className="mb-4 text-sm text-red-400">
                    {retryError}
                </p>
            )}

            {loading ? (
                <p className="text-sm text-zinc-400">
                    Loading failed jobs...
                </p>
            ) : error ? (
                <p role="alert" className="text-sm text-red-400">
                    Unable to retrieve failed jobs.
                </p>
            ) : jobs.length === 0 ? (
                <p className="text-sm text-emerald-400">
                    No failed jobs recorded.
                </p>
            ) : (
                <div className="space-y-3">
                    {jobs.map((job) => (
                        <div
                            key={job.id}
                            className="rounded-lg border border-zinc-800 bg-zinc-950 p-4"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-medium">
                                    {job.name} #{job.id}
                                </p>


                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-red-400">
                                        Failed
                                    </span>

                                    {job.name === "check-monitor" &&
                                        job.monitorId && (
                                            <button
                                                type="button"
                                                onClick={() => handleRetry(job.id)}
                                                disabled={retryingId !== null}
                                                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
                                            >
                                                {retryingId === job.id
                                                    ? "Retrying..."
                                                    : "Retry"}
                                            </button>
                                        )}
                                </div>

                            </div>

                            <p className="mt-2 break-words text-sm text-zinc-400">
                                {job.error}
                            </p>

                            <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-500">
                                <span>
                                    Attempts: {job.attemptsMade}
                                </span>

                                <span>
                                    {job.failedAt
                                        ? new Date(job.failedAt).toLocaleString()
                                        : "Unknown time"}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
