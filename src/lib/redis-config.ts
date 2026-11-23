
export function getRedisConnection() {
  const redisUrl =
    process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

  const url = new URL(redisUrl);

  if (!["redis:", "rediss:"].includes(url.protocol)) {
    throw new Error("Invalid Redis URL protocol");
  }

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: decodeURIComponent(url.username) || undefined,
    password: decodeURIComponent(url.password) || undefined,
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
  };
}
