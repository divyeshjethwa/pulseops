
import pg from "pg";

import { sendIncidentEmail } from "../../scripts/email-notifier.mjs";

import {
  claimNotification,
  markDeliverySent,
  markDeliveryFailed,
} from "../../scripts/outbox-claim.mjs";

const { Pool } = pg;

// Check for pending emails every 5 minutes
export const config = {
  schedule: "*/5 * * * *",
};

export default async function handler() {
  // Never accidentally send emails in preview mode
  if (process.env.EMAIL_MODE !== "smtp") {
    console.log("Email delivery disabled");
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  // Restrict the initial deployment to Resend's test recipient
  if (process.env.ALERT_EMAIL !== "delivered@resend.dev") {
    throw new Error("Only the test recipient is permitted");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 5000,
  });

  try {
    // Process at most one notification per invocation
    const claim = await claimNotification(pool);

    if (!claim) {
      console.log("No pending notifications");
      return;
    }

    let acceptedBySmtp = false;

    try {
      const { rows } = await pool.query(
        `
        SELECT
          i.started_at,
          i.resolved_at,
          m.url
        FROM incidents i
        JOIN monitors m ON m.id = i.monitor_id
        WHERE i.id = $1
        `,
        [claim.incident_id]
      );

      if (!rows.length) {
        throw new Error("Incident not found");
      }

      const incident = rows[0];

      await sendIncidentEmail({
        to: process.env.ALERT_EMAIL,
        url: incident.url,
        event: claim.event_type,
        startedAt: incident.started_at.toISOString(),
        resolvedAt: incident.resolved_at?.toISOString(),
      });

      acceptedBySmtp = true;

      const marked = await markDeliverySent(pool, claim);

      if (!marked) {
        console.error(
          "Email accepted but delivery state not confirmed:",
          claim.id
        );
        return;
      }

      console.log("Notification sent:", claim.id);
    } catch (error) {
      console.error("Notification processing failed:", error);

      if (!acceptedBySmtp) {
        await markDeliveryFailed(pool, claim, error);
      } else {
        console.error(
          "Email may have been accepted. Manual review required."
        );
      }
    }
  } finally {
    await pool.end();
  }
}
