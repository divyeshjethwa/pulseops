
import { Queue } from "bullmq";

const queue = new Queue("pulseops-test", {
  connection: {
    host: "127.0.0.1",
    port: 6379,
  },
});

try {
  await queue.upsertJobScheduler(
    "example-com-60s",
    {
      every: 60_000,
    },
    {
      name: "test-monitor",
      data: {
        url: "https://example.com/",
      },
      opts: {
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    }
  );

  console.log("Monitoring scheduled every 60 seconds");
} finally {
  await queue.close();
}
