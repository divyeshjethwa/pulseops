
"use client";

import { useEffect, useState } from "react";

type Service = {
  service_name: string;
  status: "healthy" | "stale" | "missing";
  age_seconds: number | null;
};

type HealthResponse = {
  status: "healthy" | "degraded";
  services: Service[];
};

export default function SystemHealth() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let loading = false;

    async function fetchHealth() {
      if (loading) return;

      loading = true;

      try {
        const response = await fetch("/api/system/health", {
          cache: "no-store",
        });

        // HTTP 503 may still contain valid degraded health data
        const data = await response.json();

        if (!Array.isArray(data.services)) {
          throw new Error("Invalid health response");
        }

        if (!cancelled) {
          setHealth(data);
          setError(false);
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      } finally {
        loading = false;
      }
    }

    void fetchHealth();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchHealth();
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
          System Health
        </h2>

        <span className="text-xs text-zinc-500">
          Updates every 30s
        </span>
      </div>

      {error ? (
        <p role="status" className="text-sm text-red-400">
          Unable to retrieve system health
        </p>
      ) : !health ? (
        <p className="text-sm text-zinc-400">
          Checking services...
        </p>
      ) : (
        <div className="space-y-4">
          {health.services.map((service) => {
            const healthy = service.status === "healthy";

            return (
              <div
                key={service.service_name}
                className="flex items-center justify-between gap-4"
              >
                <div>
                  <p className="text-sm font-medium">
                    {service.service_name}
                  </p>

                  <p className="mt-1 text-xs text-zinc-500">
                    {service.age_seconds === null
                      ? "No heartbeat recorded"
                      : `Last heartbeat ${service.age_seconds}s ago`}
                  </p>
                </div>

                <span
                  className={`text-sm font-medium ${
                    healthy
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}
                >
                  ● {service.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
