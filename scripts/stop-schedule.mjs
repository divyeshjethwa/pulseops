import { Queue } from "bullmq";

const queue = new Queue("pulseops-test", {
  connection: { host: "127.0.0.1", port: 6379 },
});

try {
  await queue.removeJobScheduler("example-com-60s");
  console.log("Monitoring schedule removed");
} finally {
  await queue.close();
}