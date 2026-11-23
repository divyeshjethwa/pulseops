
import { sendIncidentEmail } from "./email-notifier.mjs";

export async function previewIncidentAlert({
  url,
  incidentEvent,
}) {
  // No incident change means no notification
  if (!incidentEvent) return;

  const email = await sendIncidentEmail({
    to: process.env.ALERT_EMAIL || "developer@example.com",
    url,
    event: incidentEvent.type,
    startedAt: incidentEvent.startedAt.toISOString(),
    resolvedAt: incidentEvent.resolvedAt?.toISOString(),
  });

  console.log("Email preview (not sent):", email.subject);

  return email;
}
