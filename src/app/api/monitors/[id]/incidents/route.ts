
import pool from "@/lib/db";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: Request,
  { params }: Context
) {
  const { id } = await params;

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(id)) {
    return Response.json(
      { error: "Invalid monitor ID" },
      { status: 400 }
    );
  }

  try {
    // Verify that the monitor exists
    const monitor = await pool.query(
      "SELECT id FROM monitors WHERE id = $1",
      [id]
    );

    if (monitor.rows.length === 0) {
      return Response.json(
        { error: "Monitor not found" },
        { status: 404 }
      );
    }

    // Retrieve incident history
    const { rows } = await pool.query(
      `SELECT
        id,
        started_at,
        resolved_at,

        CASE
          WHEN resolved_at IS NULL THEN 'ongoing'
          ELSE 'resolved'
        END AS status,

        ROUND(
          EXTRACT(EPOCH FROM (
            COALESCE(resolved_at, NOW()) - started_at
          ))
        )::integer AS duration_seconds

       FROM incidents
       WHERE monitor_id = $1
       ORDER BY started_at DESC, id DESC
       LIMIT 20`,
      [id]
    );

    return Response.json({
      monitorId: id,
      incidents: rows,
    });
  } catch (error) {
    console.error("Failed to fetch incidents:", error);

    return Response.json(
      { error: "Failed to fetch incidents" },
      { status: 500 }
    );
  }
}
