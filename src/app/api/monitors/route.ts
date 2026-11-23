
import pool from "@/lib/db";
import { validateMonitorUrl } from "../../../../scripts/url-safety.mjs";
import { scheduleMonitor } from "@/lib/monitor-scheduler";

export async function POST(request: Request) {

  if (process.env.NODE_ENV !== "development") {
    return Response.json(
      { error: "Monitor management is disabled in demo mode" },
      { status: 403 }
    );
  }


  let url: string;

  // 1. Validate the request
  try {
    const body = await request.json();

    if (typeof body?.url !== "string" || !body.url.trim()) {
      return Response.json(
        { error: "A website URL is required" },
        { status: 400 }
      );
    }

    url = validateMonitorUrl(body.url.trim());

  } catch {
    return Response.json(
      { error: "Invalid request or URL" },
      { status: 400 }
    );
  }

  // 2. Save the monitor
  try {
    const result = await pool.query(
      `INSERT INTO monitors (url)
       VALUES ($1)
       ON CONFLICT (url) DO NOTHING
       RETURNING *`,
      [url]
    );

    // 3. Handle duplicate URLs
    if (result.rows.length === 0) {
      return Response.json(
        { error: "Website is already registered" },
        { status: 409 }
      );
    }


    const monitor = result.rows[0];

    let monitoringScheduled = false;

    try {
      await scheduleMonitor(monitor.id);
      monitoringScheduled = true;
    } catch (error) {
      console.error("Failed to schedule monitor:", error);
    }

    return Response.json(
      {
        monitor,
        monitoringScheduled,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Failed to create monitor:", error);

    return Response.json(
      { error: "Failed to create monitor" },
      { status: 500 }
    );
  }
}


export async function GET() {
  try {
    const result = await pool.query(
      "SELECT * FROM monitors ORDER BY created_at DESC"
    );

    return Response.json({
      monitors: result.rows,
    });
  } catch (error) {
    console.error("Database query failed:", error);

    return Response.json(
      { error: "Failed to fetch monitors" },
      { status: 500 }
    );
  }
}