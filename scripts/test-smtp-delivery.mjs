
import { sendIncidentEmail } from "./email-notifier.mjs";

if (process.env.EMAIL_MODE !== "smtp") {
  throw new Error("SMTP mode required for this test");
}

if (process.env.SMTP_FROM !== "onboarding@resend.dev") {
  throw new Error("Use the Resend test sender");
}

const result = await sendIncidentEmail({
  to: "delivered@resend.dev",
  url: "https://example.com/",
  event: "opened",
  startedAt: new Date().toISOString(),
});

console.log("SMTP test result:");
console.log(result);

