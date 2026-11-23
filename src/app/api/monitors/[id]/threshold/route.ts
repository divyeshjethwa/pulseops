
import { connection } from "next/server";
import pool from "@/lib/db";

type Context = {
  params: Promise<{ id: string }>;
};

const isValidId = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

export async function GET(
  _request: Request,
  { params }: Context
) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;

  if (!isValidId(id)) {
    return Response.json({ error: "Invalid monitor ID" }, { status: 400 });
  }

  await connection();

  try {
    const { rows } = await pool.query(
      `SELECT response_time_threshold_ms
       FROM monitors WHERE id = $1`,
      [id]
    );

    if (!rows.length) {
      return Response.json({ error: "Monitor not found" }, { status: 404 });
    }

    return Response.json({
      monitorId: id,
      thresholdMs: rows[0].response_time_threshold_ms,
    });
  } catch (error) {
    console.error("Threshold lookup failed:", error);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}

export async function PATCH(
  request: Request,
  { params }: Context
) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;

  if (!isValidId(id)) {
    return Response.json({ error: "Invalid monitor ID" }, { status: 400 });
  }

  let thresholdMs: unknown;

  try {
    const body = await request.json();
    thresholdMs = body?.thresholdMs;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    typeof thresholdMs !== "number" ||
    !Number.isInteger(thresholdMs) ||
    thresholdMs < 100 ||
    thresholdMs > 30000
  ) {
    return Response.json(
      { error: "Threshold must be 100–30000 ms" },
      { status: 400 }
    );
  }

  try {
    const { rows } = await pool.query(
      `UPDATE monitors
       SET response_time_threshold_ms = $1
       WHERE id = $2
       RETURNING response_time_threshold_ms`,
      [thresholdMs, id]
    );

    if (!rows.length) {
      return Response.json({ error: "Monitor not found" }, { status: 404 });
    }

    return Response.json({
      monitorId: id,
      thresholdMs: rows[0].response_time_threshold_ms,
    });
  } catch (error) {
    console.error("Threshold update failed:", error);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
