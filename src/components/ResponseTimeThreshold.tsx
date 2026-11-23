
"use client";

import { useEffect, useState } from "react";

export default function ResponseTimeThreshold({
  monitorId,
}: {
  monitorId: string;
}) {
  const [threshold, setThreshold] = useState("");
  const [savedThreshold, setSavedThreshold] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadThreshold() {
      setLoading(true);
      setError("");
      setSavedThreshold(null);

      try {
        const response = await fetch(
          `/api/monitors/${encodeURIComponent(monitorId)}/threshold`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error("Unable to load threshold");
        }

        const data = await response.json();

        if (!cancelled) {
          setThreshold(String(data.thresholdMs));
          setSavedThreshold(data.thresholdMs);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Something went wrong"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadThreshold();

    return () => {
      cancelled = true;
    };
  }, [monitorId]);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = Number(threshold);

    if (
      threshold.trim() === "" ||
      !Number.isInteger(value) ||
      value < 100 ||
      value > 30000
    ) {
      setError("Enter a whole number between 100 and 30000.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/monitors/${encodeURIComponent(monitorId)}/threshold`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ thresholdMs: value }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to save threshold");
      }

      setSavedThreshold(data.thresholdMs);
      setThreshold(String(data.thresholdMs));
      setMessage("Threshold saved successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="my-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-lg font-semibold">
        Performance Settings
      </h2>

      <p className="mt-2 text-sm text-zinc-400">
        Configure when a response should be considered slow.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-zinc-400">
          Loading settings...
        </p>
      ) : savedThreshold === null ? (
        <p className="mt-4 text-sm text-red-400">
          {error || "Unable to load settings."}
        </p>
      ) : (
        <form onSubmit={handleSave} className="mt-5 max-w-md">
          <label
            htmlFor="response-threshold"
            className="mb-2 block text-sm font-medium"
          >
            Response-time threshold (ms)
          </label>

          <div className="flex gap-3">
            <input
              id="response-threshold"
              type="number"
              min={100}
              max={30000}
              step={1}
              required
              value={threshold}
              onChange={(event) => {
                setThreshold(event.target.value);
                setMessage("");
                setError("");
              }}
              disabled={saving}
              className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
            />

            <button
              type="submit"
              disabled={saving || threshold === String(savedThreshold)}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>

          <p className="mt-2 text-xs text-zinc-500">
            Allowed range: 100–30,000 ms.
          </p>

          {message && (
            <p role="status" className="mt-3 text-sm text-emerald-400">
              {message}
            </p>
          )}

          {error && (
            <p role="alert" className="mt-3 text-sm text-red-400">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
