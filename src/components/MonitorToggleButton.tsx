
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  monitorId: string;
  isActive: boolean;
};

export default function MonitorToggleButton({
  monitorId,
  isActive,
}: Props) {
  const router = useRouter();

  const [active, setActive] = useState(isActive);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Synchronize local state when server data changes
  useEffect(() => {
    setActive(isActive);
  }, [isActive]);

  async function handleToggle() {
    if (loading) return;

    const nextActive = !active;

    // Immediately update the UI
    setActive(nextActive);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/monitors/${monitorId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            isActive: nextActive,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ?? "Failed to update monitor"
        );
      }

      if (!result.scheduleSynced) {
        setError("Saved, but scheduling failed.");
      }

      router.refresh();
    } catch (error) {
      // Restore the previous state if the request fails
      setActive(!nextActive);

      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        aria-busy={loading}
        className="min-w-24 rounded-lg border border-zinc-700 px-4 py-2 text-sm transition-colors hover:bg-zinc-700 disabled:opacity-60"
      >
        {active ? "Pause" : "Resume"}
      </button>

      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
