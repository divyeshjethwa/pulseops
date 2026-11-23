
import { Queue } from "bullmq";
import { getRedisConnection } from "@/lib/redis-config";

export async function scheduleMonitor(monitorId: string) {
  const queue = new Queue("pulseops-test", {
    connection: getRedisConnection(),
  });

  try {
    await queue.upsertJobScheduler(
      `monitor-${monitorId}`,
      { every: 60_000 },
      {
        name: "check-monitor",
        data: { monitorId },
        opts: {
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      }
    );
  } finally {
    await queue.close();
  }
}


export async function unscheduleMonitor(monitorId: string) {
  const queue = new Queue("pulseops-test", {
    connection: {
      host: "127.0.0.1",
      port: 6379,
    },
  });

  try {
    await queue.removeJobScheduler(`monitor-${monitorId}`);
  } finally {
    await queue.close();
  }
}
