
import pool from "@/lib/db";
import {
  scheduleMonitor,
  unscheduleMonitor,
} from "@/lib/monitor-scheduler";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: Request,
  { params }: Context
) {


  if (process.env.NODE_ENV !== "development") {
    return Response.json(
      { error: "Monitor management is disabled in demo mode" },
      { status: 403 }
    );
  }


  const { id } = await params;

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(id)) {
    return Response.json(
      { error: "Invalid monitor ID" },
      { status: 400 }
    );
  }

  let isActive: boolean;

  try {
    const body = await request.json();

    if (typeof body?.isActive !== "boolean") {
      return Response.json(
        { error: "isActive must be a boolean" },
        { status: 400 }
      );
    }

    isActive = body.isActive;
  } catch {
    return Response.json(
      { error: "Invalid JSON request" },
      { status: 400 }
    );
  }

  try {
    const { rows } = await pool.query(
      `UPDATE monitors
       SET is_active = $1
       WHERE id = $2
       RETURNING id, url, is_active`,
      [isActive, id]
    );

    if (rows.length === 0) {
      return Response.json(
        { error: "Monitor not found" },
        { status: 404 }
      );
    }

    let scheduleSynced = true;

    try {
      if (isActive) {
        await scheduleMonitor(id);
      } else {
        await unscheduleMonitor(id);
      }
    } catch (error) {
      console.error("Schedule update failed:", error);
      scheduleSynced = false;
    }

    return Response.json({
      monitor: rows[0],
      scheduleSynced,
    });
  } catch (error) {
    console.error("Monitor update failed:", error);

    return Response.json(
      { error: "Failed to update monitor" },
      { status: 500 }
    );
  }
}
