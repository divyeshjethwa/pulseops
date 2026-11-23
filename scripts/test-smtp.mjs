
import nodemailer from "nodemailer";

const required = [
  "SMTP_HOST",
  "SMTP_USER",
  "SMTP_PASSWORD",
];

const missing = required.filter(
  (key) => !process.env[key]
);

if (missing.length > 0) {
  throw new Error(
    `Missing SMTP configuration: ${missing.join(", ")}`
  );
}

const port = Number(process.env.SMTP_PORT || 587);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure: port === 465,
  requireTLS: port !== 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

try {
  await transporter.verify();
  console.log("SMTP connection successful!");
} catch (error) {
  console.error("SMTP connection failed:", error.message);
  process.exitCode = 1;
} finally {
  transporter.close();
}
