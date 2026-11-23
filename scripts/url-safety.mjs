
import ipaddr from "ipaddr.js";

export function validateMonitorUrl(input) {
    if (typeof input !== "string" || input.length > 2048) {
        throw new Error("Invalid URL input");
    }

    let url;

    try {
        url = new URL(input);
    } catch {
        throw new Error("Invalid URL format");
    }

    // Only allow HTTP and HTTPS
    if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("Unsupported protocol");
    }

    // Reject credentials in URLs
    if (url.username || url.password) {
        throw new Error("URL credentials are not allowed");
    }

    // Allow only default HTTP/HTTPS ports for now
    if (url.port) {
        throw new Error("Custom ports are not allowed");
    }

    const hostname = url.hostname
        .replace(/^\[|\]$/g, "")
        .replace(/\.$/, "")
        .toLowerCase();

    // Reject local and internal hostnames
    if (
        hostname === "localhost" ||
        hostname.endsWith(".localhost") ||
        hostname.endsWith(".local") ||
        hostname.endsWith(".internal")
    ) {
        throw new Error("Internal hostnames are not allowed");
    }

    // Reject single-label hostnames
    if (!hostname.includes(".") && !ipaddr.isValid(hostname)) {
        throw new Error("Public hostname required");
    }

    // Only permit hostnames, not literal IP addresses.
    if (ipaddr.isValid(hostname)) {
        throw new Error(
            "Direct IP addresses are not supported"
        );
    }

    url.hash = "";

    return url.href;
}
