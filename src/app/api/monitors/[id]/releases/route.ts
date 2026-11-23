
import pool from "@/lib/db";
import { connection } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";


function isValidReleaseToken(
  request: Request,
  expectedToken: string
): boolean {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return false;
  }

  const providedToken = authorization.slice(7);

  if (!providedToken) {
    return false;
  }

  const providedHash = createHash("sha256")
    .update(providedToken)
    .digest();

  const expectedHash = createHash("sha256")
    .update(expectedToken)
    .digest();

  return timingSafeEqual(providedHash, expectedHash);
}


type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  request: Request,
  { params }: RouteContext
) {
  // Internal API until authentication is implemented

  const expectedToken = process.env.PULSEOPS_RELEASE_TOKEN;

  if (!expectedToken || expectedToken.length < 32) {
    return Response.json(
      { error: "Release API is not configured" },
      { status: 503 }
    );
  }

  if (!isValidReleaseToken(request, expectedToken)) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
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

  let version: string;

  try {
    const body = await request.json();

    if (typeof body?.version !== "string") {
      return Response.json(
        { error: "Version is required" },
        { status: 400 }
      );
    }

    version = body.version.trim();

    if (
      version.length < 1 ||
      version.length > 100 ||
      /[\x00-\x1F\x7F]/.test(version)
    ) {
      return Response.json(
        { error: "Invalid release version" },
        { status: 400 }
      );
    }
  } catch {
    return Response.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  try {
    const { rows } = await pool.query(
      `
      INSERT INTO monitor_releases (
        monitor_id,
        version
      )
      SELECT id, $2
      FROM monitors
      WHERE id = $1
      RETURNING id, monitor_id, version, deployed_at
      `,
      [id, version]
    );

    if (rows.length === 0) {
      return Response.json(
        { error: "Monitor not found" },
        { status: 404 }
      );
    }

    return Response.json(
      {
        message: "Release registered",
        release: rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Release registration failed:", error);

    return Response.json(
      { error: "Unable to register release" },
      { status: 503 }
    );
  }
}


export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json(
      { error: "Not found" },
      { status: 404 }
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

  await connection();

  try {
    const { rows } = await pool.query(
      `
      SELECT id, version, deployed_at
      FROM monitor_releases
      WHERE monitor_id = $1
      ORDER BY deployed_at DESC, id DESC
      LIMIT 10
      `,
      [id]
    );

    return Response.json(
      { releases: rows },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Release history failed:", error);

    return Response.json(
      { error: "Unable to retrieve releases" },
      { status: 503 }
    );
  }
}
