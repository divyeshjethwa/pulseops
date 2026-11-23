
import { Queue } from "bullmq";
import { connection } from "next/server";
import { getRedisConnection } from "@/lib/redis-config";

export async function GET() {
  // Restrict internal diagnostics to development
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
    // Retrieve the 10 most recent failed jobs
    const jobs = await queue.getJobs(
      ["failed"],
      0,
      9,
      false
    );

    const failedJobs = jobs.map((job) => ({
      id: job.id,
      name: job.name,
      monitorId:
        typeof job.data?.monitorId === "string"
          ? job.data.monitorId
          : null,
      error: (job.failedReason || "Unknown error").slice(0, 200),
      attemptsMade: job.attemptsMade,
      failedAt: job.finishedOn
        ? new Date(job.finishedOn).toISOString()
        : null,
    }));

    return Response.json(
      {
        queue: "pulseops-test",
        failedJobs,
        count: failedJobs.length,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Failed to retrieve jobs:", error);

    return Response.json(
      { error: "Unable to retrieve failed jobs" },
      { status: 503 }
    );
  } finally {
    await queue.close();
  }
}
