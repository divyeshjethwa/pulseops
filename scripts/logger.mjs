
export function createLogger(service) {
  function write(level, event, details = {}) {
    const log = {
      timestamp: new Date().toISOString(),
      level,
      service,
      event,
      ...details,
    };

    const output = JSON.stringify(log);

    if (level === "error") {
      console.error(output);
    } else {
      console.log(output);
    }
  }

  return {
    info: (event, details) =>
      write("info", event, details),

    warn: (event, details) =>
      write("warn", event, details),

    error: (event, details) =>
      write("error", event, details),
  };
}
