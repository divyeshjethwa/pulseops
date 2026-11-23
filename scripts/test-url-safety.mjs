
import { validateMonitorUrl } from "./url-safety.mjs";

const urls = [
  "https://example.com",
  "https://api.github.com",
  "http://localhost:3000",
  "http://127.0.0.1",
  "http://192.168.1.1",
  "http://169.254.169.254",
  "http://[::1]",
];

for (const url of urls) {
  try {
    const validated = validateMonitorUrl(url);
    console.log("ALLOWED:", validated);
  } catch (error) {
    console.log("BLOCKED:", url, "-", error.message);
  }
}
