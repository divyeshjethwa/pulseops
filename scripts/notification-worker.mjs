
import pg from "pg";
import { sendIncidentEmail } from "./email-notifier.mjs";
import {
    claimNotification,
    releaseNotification,
    markDeliverySent,
    markDeliveryFailed,
} from "./outbox-claim.mjs";
import { createLogger } from "./logger.mjs";
import { recordHeartbeat } from "./service-heartbeat.mjs";



const logger = createLogger("notification-worker");


let heartbeatTimer = null;

async function sendHeartbeat() {
    try {
        await recordHeartbeat(pool, "notification-worker");
    } catch (error) {
        logger.error("heartbeat.failed", {
            message:
                error instanceof Error
                    ? error.message
                    : String(error),
        });
    }
}


const mode = process.env.EMAIL_MODE || "preview";

if (!["preview", "smtp"].includes(mode)) {
    throw new Error("Invalid EMAIL_MODE");
}

// During development, only permit Resend's test recipient.
if (
    mode === "smtp" &&
    process.env.ALERT_EMAIL !== "delivered@resend.dev"
) {
    throw new Error("SMTP testing requires the Resend test recipient");
}

const pool = new pg.Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
});

async function processNextNotification() {
    const claim = await claimNotification(pool);

    if (!claim) {
        console.log("No pending notifications");
        return false;
    }

    logger.info("notification.started", {
        notificationId: claim.id,
        eventType: claim.event_type,
        attempt: claim.attempts + 1,
    });

    let acceptedBySmtp = false;

    try {
        const { rows } = await pool.query(
            `SELECT i.started_at, i.resolved_at, m.url
       FROM incidents i
       JOIN monitors m ON m.id = i.monitor_id
       WHERE i.id = $1`,
            [claim.incident_id]
        );

        if (!rows.length) {
            throw new Error("Incident not found");
        }

        const incident = rows[0];

        const result = await sendIncidentEmail({
            to: process.env.ALERT_EMAIL || "developer@example.com",
            url: incident.url,
            event: claim.event_type,
            startedAt: incident.started_at.toISOString(),
            resolvedAt: incident.resolved_at?.toISOString(),
        });

        if (mode === "preview") {
            console.log("Email preview:", result.subject);
            await releaseNotification(pool, claim);
            return;
        }

        acceptedBySmtp = true;

        const updated = await markDeliverySent(pool, claim);

        if (!updated) {
            throw new Error("SMTP accepted, but notification claim expired");
        }

        logger.info("notification.sent", {
            notificationId: claim.id,
            eventType: claim.event_type,
            attempts: claim.attempts + 1,
        });

    } catch (error) {
        logger.error("notification.error", {
            notificationId: claim.id,
            message: error instanceof Error
                ? error.message
                : "Unknown error",
        });

        if (acceptedBySmtp) {
            console.error(
                "SMTP may have accepted this email. Manual review required."
            );
        } else if (mode === "smtp") {
            const updated = await markDeliveryFailed(
                pool,
                claim,
                error
            );


            if (!updated) {
                logger.error("notification.retry_update_failed", {
                    notificationId: claim.id,
                });
            } else {
                const attempt = claim.attempts + 1;

                logger.warn(
                    attempt >= 5
                        ? "notification.permanently_failed"
                        : "notification.retry_scheduled",
                    {
                        notificationId: claim.id,
                        attempt,
                        maxAttempts: 5,
                    }
                );
            }

        } else {
            await releaseNotification(pool, claim);
        }

    }
    return true;
}



const watchMode = process.argv.includes("--watch");
const POLL_INTERVAL = 60_000;

let stopping = false;
let processing = false;
let wake = null;

if (watchMode && mode !== "smtp") {
    throw new Error("Watch mode requires EMAIL_MODE=smtp");
}

// Prevent overlapping notification processing

async function processSafely() {
    if (processing || stopping) return;

    processing = true;

    try {
        // Preview mode processes only one notification
        if (!watchMode) {
            await processNextNotification();
            return;
        }

        // SMTP mode processes all available notifications
        while (!stopping) {
            const processed = await processNextNotification();

            if (!processed) {
                break;
            }
        }
    } catch (error) {
        console.error("Processing error:", error);
    } finally {
        processing = false;
    }
}


// Sleep until the next fallback check or shutdown
function sleep(ms) {
    return new Promise((resolve) => {
        const timer = setTimeout(finish, ms);

        function finish() {
            clearTimeout(timer);
            wake = null;
            resolve();
        }

        wake = finish;

        if (stopping) finish();
    });
}

function shutdown() {
    console.log("Stopping notification worker...");
    stopping = true;
    wake?.();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function main() {
    let listener = null;

    try {
        if (watchMode) {
            try {
                // Dedicated PostgreSQL connection for LISTEN
                listener = new pg.Client({
                    host: process.env.PGHOST,
                    port: Number(process.env.PGPORT || 5432),
                    user: process.env.PGUSER,
                    password: process.env.PGPASSWORD,
                    database: process.env.PGDATABASE,
                });

                listener.on("error", (error) => {
                    console.error("Database listener error:", error);
                });

                listener.on("notification", (message) => {
                    if (message.channel === "pulseops_outbox") {
                        console.log("Outbox event received:", message.payload);
                        void processSafely();
                    }
                });

                await listener.connect();
                await listener.query("LISTEN pulseops_outbox");

                console.log("Listening for outbox events...");
            } catch (error) {
                console.error("LISTEN unavailable; using fallback polling:", error);
                await listener?.end().catch(() => { });
                listener = null;
            }
        }

        console.log("Notification worker started");


        if (watchMode) {
            // Record the first heartbeat immediately
            await sendHeartbeat();

            // Update every 30 seconds
            heartbeatTimer = setInterval(() => {
                void sendHeartbeat();
            }, 30_000);
        }


        do {
            await processSafely();

            if (!watchMode || stopping) break;

            await sleep(POLL_INTERVAL);
        } while (!stopping);
    } finally {
        await listener?.end().catch(() => { });
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
        }
        await pool.end();

        console.log("Notification worker stopped");
    }
}

main().catch((error) => {
    console.error("Fatal worker error:", error);
    process.exitCode = 1;
});
