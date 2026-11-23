
"use client";

import { useEffect, useState } from "react";
import ReleaseComparison from "./ReleaseComparison";

type Release = {
  id: string;
  version: string;
  deployed_at: string;
};

export default function ReleaseHistory({
  monitorId,
}: {
  monitorId: string;
}) {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedReleaseId, setSelectedReleaseId] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadReleases() {
      setLoading(true);
      setError(false);

      try {
        const response = await fetch(
          `/api/monitors/${encodeURIComponent(monitorId)}/releases`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error("Unable to retrieve releases");
        }

        const data = await response.json();

        if (!Array.isArray(data.releases)) {
          throw new Error("Invalid response");
        }

        if (!cancelled) {
          setReleases(data.releases);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadReleases();

    return () => {
      cancelled = true;
    };
  }, [monitorId]);

  return (
    <section className="my-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Deployment History
        </h2>
        <span className="text-xs text-zinc-500">
          Latest 10 releases
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-400">
          Loading releases...
        </p>
      ) : error ? (
        <p role="alert" className="text-sm text-red-400">
          Unable to load deployment history.
        </p>
      ) : releases.length === 0 ? (
        <p className="text-sm text-zinc-400">
          No deployments recorded yet.
        </p>
      ) : (
        <div className="space-y-3">
          {releases.map((release) => (
            <div
              key={release.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4"
            >
              <div>
                <p className="font-medium text-emerald-400">
                  {release.version}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Registered deployment
                </p>
              </div>

              <time
                dateTime={release.deployed_at}
                className="text-sm text-zinc-400"
              >
                {new Date(
                  release.deployed_at
                ).toLocaleString()}
              </time>

              <button
                type="button"
                onClick={() =>
                  setSelectedReleaseId(
                    selectedReleaseId === release.id ? null : release.id
                  )
                }
                className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-white hover:bg-zinc-800"
              >
                {selectedReleaseId === release.id
                  ? "Hide Comparison"
                  : "Compare"}
              </button>

            </div>
          ))}
        </div>
      )}

      {selectedReleaseId && (
        <div className="mt-6">
          <ReleaseComparison
            key={selectedReleaseId}
            monitorId={monitorId}
            releaseId={selectedReleaseId}
          />
        </div>
      )}

    </section>
  );
}
