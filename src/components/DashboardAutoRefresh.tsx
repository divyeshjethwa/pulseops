
"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  lastUpdatedAt: string;
};

export default function DashboardAutoRefresh({
  lastUpdatedAt,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function refreshDashboard() {
    startTransition(() => {
      router.refresh();
    });
  }

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        startTransition(() => {
          router.refresh();
        });
      }
    }, 30_000);

    return () => clearInterval(interval);
  }, [router, startTransition]);

  const lastUpdated = lastUpdatedAt.slice(11, 19);

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm text-zinc-400">
          Last refreshed: {lastUpdated} UTC
        </p>

        <p className="mt-1 text-xs text-zinc-500">
          Auto-refresh every 30 seconds
        </p>
      </div>

      <button
        type="button"
        onClick={refreshDashboard}
        disabled={isPending}
        className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition-colors hover:bg-zinc-800 disabled:opacity-50"
      >
        {isPending ? "Refreshing..." : "↻ Refresh"}
      </button>
    </div>
  );
}
