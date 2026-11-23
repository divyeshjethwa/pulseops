
import { safeFetch } from "./safe-fetch.mjs";

const urls = [
  "https://example.com",
  "http://localhost:3000",
  "http://192.168.1.1",
];

for (const url of urls) {
  try {
    const result = await safeFetch(url);
    console.log("RESULT:", url, result);
  } catch (error) {
    console.log("REJECTED OR FAILED:", url, error.message);
  }
}
