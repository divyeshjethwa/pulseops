
import { sendIncidentEmail } from "./email-notifier.mjs";

const email = await sendIncidentEmail({
  to: "developer@example.com",
  url: "https://example.com/",
  event: "opened",
  startedAt: new Date().toISOString(),
});

console.log("Email preview (not sent):");
console.log(JSON.stringify(email, null, 2));
