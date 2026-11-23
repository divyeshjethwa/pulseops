
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

const inputUrl = process.argv[2];

if (!inputUrl) {
  throw new Error(
    "Please provide a website URL"
  );
}

const url = new URL(inputUrl).href;

const result = await pool.query(
  `SELECT id FROM monitors
   WHERE url = $1 AND is_active = TRUE`,
  [url]
);


  if (result.rows.length === 0) {
    throw new Error("Register example.com first");
  }

  const monitorId = result.rows[0].id;

  const job = await queue.add("check-monitor", {
    monitorId,
  });

  console.log("Job created:", job.id);
  console.log("Monitor ID:", monitorId);
} finally {
  await queue.close();
  await pool.end();
}
