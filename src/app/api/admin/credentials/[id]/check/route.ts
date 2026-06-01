import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { checkCredentialHealth } from "@/lib/health-checker";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return Response.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const cred = db
    .prepare("SELECT id, content, admin_id FROM credentials WHERE id = ?")
    .get(id) as { id: number; content: string; admin_id: number | null } | undefined;

  if (!cred) {
    return Response.json({ error: "凭证不存在" }, { status: 404 });
  }

  if (admin.role !== "superadmin" && cred.admin_id !== admin.id) {
    return Response.json({ error: "无权操作" }, { status: 403 });
  }

  const result = await checkCredentialHealth(cred);

  // Save to health table
  db.prepare(
    `INSERT INTO credential_health
      (credential_id, status, five_hour_percent, weekly_percent, five_hour_reset_at, weekly_reset_at, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    result.credentialId,
    result.status,
    result.fiveHourPercent,
    result.weeklyPercent,
    result.fiveHourResetAt,
    result.weeklyResetAt,
    result.errorMessage
  );

  return Response.json(result);
}
