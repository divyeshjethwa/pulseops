
import { Queue } from "bullmq";
import pg from "pg";

const pool = new pg.Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

const queue = new Queue("pulseops-test", {
  connection: {
    host: "127.0.0.1",
    port: 6379,
  },
});

try {
  // 1. Get active monitors
  const { rows: monitors } = await pool.query(
    "SELECT id, url FROM monitors WHERE is_active = TRUE"
  );

  console.log(`Found ${monitors.length} active monitors`);

  // 2. Create a recurring schedule for each monitor
  for (const monitor of monitors) {
    await queue.upsertJobScheduler(
      `monitor-${monitor.id}`,
      { every: 60_000 },
      {
        name: "check-monitor",
        data: {
          monitorId: monitor.id,
        },
        opts: {
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      }
    );

    console.log(`Scheduled: ${monitor.url}`);
  }

  console.log("All active monitors scheduled!");
} catch (error) {
  console.error("Scheduling failed:", error);
  process.exitCode = 1;
} finally {
  await queue.close();
  await pool.end();
}
