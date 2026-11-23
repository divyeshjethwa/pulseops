
import { Queue } from "bullmq";
import { connection } from "next/server";
import { getRedisConnection } from "@/lib/redis-config";

export async function GET() {
  // Internal diagnostics only
  if (process.env.NODE_ENV !== "development") {
    return Response.json(
      { error: "Not found" },
      { status: 404 }
    );
  }

  await connection();

  const queue = new Queue("pulseops-test", {
    connection: getRedisConnection(),
  });

  try {
    const counts = await queue.getJobCounts(
      "wait",
      "active",
      "completed",
      "failed",
      "delayed"
    );

    return Response.json(
      {
        queue: "pulseops-test",
        jobs: {
          waiting: counts.wait ?? 0,
          active: counts.active ?? 0,
          completed: counts.completed ?? 0,
          failed: counts.failed ?? 0,
          delayed: counts.delayed ?? 0,
        },
        checkedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Queue statistics failed:", error);

    return Response.json(
      { error: "Unable to retrieve queue statistics" },
      { status: 503 }
    );
  } finally {
    await queue.close();
  }
}
