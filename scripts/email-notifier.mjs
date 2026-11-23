
import nodemailer from "nodemailer";

const mode = process.env.EMAIL_MODE || "preview";

if (!["preview", "smtp"].includes(mode)) {
  throw new Error("Invalid EMAIL_MODE");
}

function createTransport() {
  if (mode === "preview") {
    return nodemailer.createTransport({
      jsonTransport: true,
    });
  }

  const required = [
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_FROM",
    "ALERT_EMAIL",
  ];

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing ${key}`);
    }
  }

  const port = Number(process.env.SMTP_PORT || 465);

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },

    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 8000,
    dnsTimeout: 5000,

  });
}

const transporter = createTransport();

export async function sendIncidentEmail({
  to,
  url,
  event,
  startedAt,
  resolvedAt,
}) {
  if (!["opened", "resolved"].includes(event)) {
    throw new Error("Invalid incident event");
  }

  const isDown = event === "opened";

  const subject = isDown
    ? `[PulseOps] DOWN: ${url}`
    : `[PulseOps] RECOVERED: ${url}`;

  const text = isDown
    ? `PulseOps detected downtime.

Website: ${url}
Incident started: ${startedAt}`
    : `Your website has recovered.

Website: ${url}
Incident started: ${startedAt}
Recovered at: ${resolvedAt}`;

  const info = await transporter.sendMail({
    from: mode === "smtp"
      ? process.env.SMTP_FROM
      : "PulseOps <alerts@pulseops.local>",
    to,
    subject,
    text,
  });

  if (mode === "preview") {
    return {
      mode,
      ...JSON.parse(info.message),
    };
  }

  return {
    mode,
    subject,
    messageId: info.messageId,
    accepted: info.accepted,
  };
}
