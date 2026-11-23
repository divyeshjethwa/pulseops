
import { Queue } from "bullmq";
import { connection } from "next/server";
import pool from "@/lib/db";
import { getRedisConnection } from "@/lib/redis-config";

export async function POST(request: Request) {
  // Only allow retries during local development
  if (process.env.NODE_ENV !== "development") {
    return Response.json(
      { error: "Not found" },
      { status: 404 }
    );
  }

  await connection();

  let jobId: string;

  try {
    const body = await request.json();

    if (
      typeof body?.jobId !== "string" ||
      !body.jobId.trim() ||
      body.jobId.length > 512
    ) {
      return Response.json(
        { error: "Valid job ID required" },
        { status: 400 }
      );
    }

    jobId = body.jobId;
  } catch {
    return Response.json(
      { error: "Invalid JSON request" },
      { status: 400 }
    );
  }

  const queue = new Queue("pulseops-test", {
    connection: getRedisConnection(),
  });

  try {
    const job = await queue.getJob(jobId);

    if (!job) {
      return Response.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    // Only retry monitoring jobs
    if (job.name !== "check-monitor") {
      return Response.json(
        { error: "Job type cannot be retried" },
        { status: 400 }
      );
    }

    const state = await job.getState();

    if (state !== "failed") {
      return Response.json(
        { error: "Only failed jobs can be retried" },
        { status: 409 }
      );
    }

    const monitorId = job.data?.monitorId;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (
      typeof monitorId !== "string" ||
      !uuidPattern.test(monitorId)
    ) {
      return Response.json(
        { error: "Job has an invalid monitor ID" },
        { status: 400 }
      );
    }

    // Ensure the monitor still exists and is active
    const monitor = await pool.query(
      `SELECT id FROM monitors
       WHERE id = $1 AND is_active = TRUE`,
      [monitorId]
    );

    if (monitor.rows.length === 0) {
      return Response.json(
        { error: "Monitor is missing or paused" },
        { status: 409 }
      );
    }

    await job.retry();

    return Response.json({
      message: "Job queued for retry",
      jobId,
      monitorId,
    });

  } catch (error) {
    console.error("Job retry failed:", error);

    return Response.json(
      { error: "Unable to retry job" },
      { status: 503 }
    );
  } finally {
    await queue.close();
  }
}
