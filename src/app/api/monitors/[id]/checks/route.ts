
import pool from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Validate the monitor ID
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(id)) {
    return Response.json(
      { error: "Invalid monitor ID" },
      { status: 400 }
    );
  }

  try {
    const result = await pool.query(
      `SELECT id, status, status_code,
              response_time_ms, error_message, checked_at
       FROM monitor_checks
       WHERE monitor_id = $1
       ORDER BY checked_at DESC, id DESC
       LIMIT 50`,
      [id]
    );

    return Response.json({
      monitorId: id,
      checks: result.rows,
    });
  } catch (error) {
    console.error("Failed to fetch checks:", error);

    return Response.json(
      { error: "Failed to fetch health checks" },
      { status: 500 }
    );
  }
}
