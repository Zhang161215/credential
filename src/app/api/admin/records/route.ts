import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return Response.json({ error: "未授权" }, { status: 401 });
  }

  const db = getDb();
  const url = request.nextUrl;
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  const isSuperadmin = admin.role === "superadmin";

  // For non-superadmin, filter by credentials they own
  // We join through related_credential_id to check credential ownership
  if (isSuperadmin) {
    const total = (
      db
        .prepare(
          "SELECT COUNT(*) as count FROM user_transactions WHERE type = 'redeem'"
        )
        .get() as { count: number }
    ).count;

    const rows = db
      .prepare(
        `SELECT t.id, t.user_id, t.amount, t.count, t.balance_after,
                t.related_credential_id, t.related_credential_ids, t.created_at,
                u.username
         FROM user_transactions t
         LEFT JOIN users u ON u.id = t.user_id
         WHERE t.type = 'redeem'
         ORDER BY t.id DESC
         LIMIT ? OFFSET ?`
      )
      .all(pageSize, offset);

    return Response.json({
      data: rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } else {
    // Non-superadmin: only show redeems of their credentials
    const total = (
      db
        .prepare(
          `SELECT COUNT(DISTINCT t.id) as count
           FROM user_transactions t
           INNER JOIN credentials c ON c.id = t.related_credential_id
           WHERE t.type = 'redeem' AND c.admin_id = ?`
        )
        .get(admin.id) as { count: number }
    ).count;

    const rows = db
      .prepare(
        `SELECT DISTINCT t.id, t.user_id, t.amount, t.count, t.balance_after,
                t.related_credential_id, t.related_credential_ids, t.created_at,
                u.username
         FROM user_transactions t
         INNER JOIN credentials c ON c.id = t.related_credential_id
         LEFT JOIN users u ON u.id = t.user_id
         WHERE t.type = 'redeem' AND c.admin_id = ?
         ORDER BY t.id DESC
         LIMIT ? OFFSET ?`
      )
      .all(admin.id, pageSize, offset);

    return Response.json({
      data: rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  }
}
