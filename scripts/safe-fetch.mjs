
import { lookup } from "node:dns";
import ipaddr from "ipaddr.js";
import { Agent, fetch } from "undici";
import { validateMonitorUrl } from "./url-safety.mjs";


export function isPublicIp(address) {
  if (!ipaddr.isValid(address)) {
    return false;
  }

  const parsed = ipaddr.process(address);

  if (parsed.range() !== "unicast") {
    return false;
  }

  // Only permit IPv6 addresses in global unicast space
  if (parsed.kind() === "ipv6") {
    return parsed.match(
      ipaddr.parse("2000::"),
      3
    );
  }

  return true;
}


export function createSafeLookup(dnsLookup = lookup) {
  return (hostname, options, callback) => {
    dnsLookup(hostname, { all: true }, (error, addresses) => {
      if (error) return callback(error);

      if (
        !addresses?.length ||
        addresses.some((item) => !isPublicIp(item.address))
      ) {
        return callback(
          new Error("Hostname resolves to an unsafe IP")
        );
      }

      const matches = addresses.filter(
        (item) =>
          !options.family || item.family === options.family
      );

      if (!matches.length) {
        return callback(new Error("No matching public IP"));
      }

      if (options.all) {
        return callback(null, matches);
      }

      return callback(
        null,
        matches[0].address,
        matches[0].family
      );
    });
  };
}


export async function safeFetch(input) {
  const url = validateMonitorUrl(input);

  const agent = new Agent({
  connect: {
    lookup: createSafeLookup(),
  },
});

  try {
    const start = performance.now();

    const response = await fetch(url, {
      dispatcher: agent,
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
    });

    const responseTimeMs = Math.round(
      performance.now() - start
    );

    await response.body?.cancel();

    return {
      status: response.ok ? "up" : "down",
      statusCode: response.status,
      responseTimeMs,
    };
  } finally {
    await agent.close();
  }
}
