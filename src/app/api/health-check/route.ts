
import pool from "@/lib/db";

export async function POST() {
  const url = "https://example.com/";

  // 1. Find the registered monitor
  try {
    const monitorResult = await pool.query(
      "SELECT id FROM monitors WHERE url = $1",
      [url]
    );

    if (monitorResult.rows.length === 0) {
      return Response.json(
        { error: "Register example.com first" },
        { status: 404 }
      );
    }

    const monitorId = monitorResult.rows[0].id;

    // 2. Perform the health check
    const startTime = performance.now();

    let status = "down";
    let statusCode: number | null = null;
    let errorMessage: string | null = null;

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
        redirect: "manual",
      });

      statusCode = response.status;
      status = response.ok ? "up" : "down";

      if (!response.ok) {
        errorMessage = `HTTP ${response.status}`;
      }
    } catch {
      errorMessage = "Request failed or timed out";
    }

    const responseTime = Math.round(
      performance.now() - startTime
    );

    // 3. Save the check result
    const result = await pool.query(
      `INSERT INTO monitor_checks
       (monitor_id, status, status_code,
        response_time_ms, error_message)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        monitorId,
        status,
        statusCode,
        responseTime,
        errorMessage,
      ]
    );

    return Response.json(
      { check: result.rows[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error("Health check failed:", error);

    return Response.json(
      { error: "Failed to save health check" },
      { status: 500 }
    );
  }
}
