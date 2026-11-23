
import { Worker } from "bullmq";
import pg from "pg";
import { safeFetch } from "./safe-fetch.mjs";
import { saveCheckWithIncident } from "./incident-tracker.mjs";
import { createLogger } from "./logger.mjs";
import { recordHeartbeat } from "./service-heartbeat.mjs";

const logger = createLogger("monitor-worker");
const { Pool } = pg;

// Connect to PostgreSQL
const pool = new Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
});


const redisUrl = new URL(
    process.env.REDIS_URL ?? "redis://127.0.0.1:6379"
);

if (!["redis:", "rediss:"].includes(redisUrl.protocol)) {
    throw new Error("Invalid Redis URL");
}

const redisConnection = {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
    username: decodeURIComponent(redisUrl.username) || undefined,
    password: decodeURIComponent(redisUrl.password) || undefined,
    ...(redisUrl.protocol === "rediss:" ? { tls: {} } : {}),
};


const worker = new Worker(
    "pulseops-test",

    async (job) => {
        logger.info("job.started", {
            jobId: job.id,
            monitorId: job.data?.monitorId,
        });


        const monitorId = job.data?.monitorId;

        // 1. Validate the monitor ID
        const uuidPattern =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        if (typeof monitorId !== "string" ||
            !uuidPattern.test(monitorId)) {
            throw new Error("Invalid monitor ID");
        }

        // 2. Find the registered monitor
        const monitor = await pool.query(
            `SELECT id, url FROM monitors
            WHERE id = $1 AND is_active = TRUE`,
            [monitorId]
        );

        if (monitor.rows.length === 0) {
            throw new Error("Active monitor not found");
        }

        const url = monitor.rows[0].url;

        // 2. Perform the health check
        const startTime = performance.now();

        let status = "down";
        let statusCode = null;
        let errorMessage = null;
        let responseTimeMs;

        try {
            const result = await safeFetch(url);

            status = result.status;
            statusCode = result.statusCode;
            responseTimeMs = result.responseTimeMs;

            if (status === "down") {
                errorMessage = `HTTP ${statusCode}`;
            }
        } catch (error) {
            responseTimeMs = Math.round(
                performance.now() - startTime
            );

            errorMessage =
                error instanceof Error
                    ? error.message
                    : "Request failed";
        }



        // 3. Save check and update incidents atomically
        const saved = await saveCheckWithIncident(pool, {
            monitorId,
            status,
            statusCode,
            responseTimeMs,
            errorMessage,
        });

        return {
            checkId: saved.id,
            url,
            status,
            statusCode,
            responseTimeMs,
            checkedAt: saved.checked_at,
        };

    },

    {
        connection: redisConnection,
    }
);


worker.on("completed", (job) => {
    logger.info("job.completed", {
        jobId: job.id,
        status: job.returnvalue?.status,
        responseTimeMs: job.returnvalue?.responseTimeMs,
    });
});

worker.on("failed", (job, error) => {
    logger.error("job.failed", {
        jobId: job?.id,
        error: error.message,
    });
});

worker.on("error", (error) => {
    logger.error("worker.error", {
        error: error.message,
    });
});


async function sendHeartbeat() {
    try {
        await recordHeartbeat(pool, "monitor-worker");
    } catch (error) {
        logger.error("heartbeat.failed", {
            message: error.message,
        });
    }
}

// Send one immediately
await sendHeartbeat();

// Continue every 30 seconds
const heartbeatTimer = setInterval(sendHeartbeat, 30_000);


process.on("SIGINT", async () => {
    console.log("Stopping worker...");
    clearInterval(heartbeatTimer);
    await worker.close();
    await pool.end();
    process.exit(0);
});

console.log("PulseOps worker started.");

