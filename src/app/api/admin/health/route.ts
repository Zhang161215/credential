import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { runHealthCheck } from "@/lib/health-checker";

export async function GET() {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return Response.json({ error: "未授权" }, { status: 401 });
  }

  const db = getDb();
  const adminId = session.role === "superadmin" ? undefined : session.id;
  const adminFilter = adminId
    ? "AND c.admin_id = ?"
    : "";
  const params: number[] = adminId ? [adminId] : [];

  // Get latest health status for each unredeemed credential
  const stats = db
    .prepare(
      `
      SELECT
        COALESCE(h.status, 'unknown') as status,
        COUNT(*) as count
      FROM credentials c
      LEFT JOIN (
        SELECT credential_id, status,
          ROW_NUMBER() OVER (PARTITION BY credential_id ORDER BY checked_at DESC) as rn
        FROM credential_health
      ) h ON h.credential_id = c.id AND h.rn = 1
      WHERE c.is_redeemed = 0 ${adminFilter}
      GROUP BY COALESCE(h.status, 'unknown')
    `
    )
    .all(...params) as { status: string; count: number }[];

  const summary = { healthy: 0, unhealthy: 0, expired: 0, unknown: 0 };
  for (const row of stats) {
    if (row.status in summary) {
      summary[row.status as keyof typeof summary] = row.count;
    }
  }

  return Response.json(summary);
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return Response.json({ error: "未授权" }, { status: 401 });
  }

  const db = getDb();
  const adminId = session.role === "superadmin" ? undefined : session.id;

  // Read optional size from body
  let size = 10;
  try {
    const body = await request.json();
    if (body.size && typeof body.size === "number" && body.size > 0) {
      size = Math.min(body.size, 50);
    }
  } catch {
    // Use default size
  }

  const results = await runHealthCheck(db, adminId, size);

  return Response.json({
    checked: results.length,
    results: results.map((r) => ({
      credentialId: r.credentialId,
      status: r.status,
      fiveHourPercent: r.fiveHourPercent,
      weeklyPercent: r.weeklyPercent,
      errorMessage: r.errorMessage,
    })),
  });
}
