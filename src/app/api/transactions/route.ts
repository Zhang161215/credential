import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireUser();
  } catch {
    return Response.json({ error: "请先登录" }, { status: 401 });
  }

  const db = getDb();
  const url = request.nextUrl;
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  const total = (
    db
      .prepare("SELECT COUNT(*) as count FROM user_transactions WHERE user_id = ?")
      .get(session.id) as { count: number }
  ).count;

  const rows = db
    .prepare(
      `SELECT t.id, t.type, t.amount, t.balance_after, t.related_card_key,
              t.related_credential_id, t.created_at,
              c.filename as credential_filename
       FROM user_transactions t
       LEFT JOIN credentials c ON c.id = t.related_credential_id
       WHERE t.user_id = ?
       ORDER BY t.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(session.id, pageSize, offset);

  return Response.json({
    data: rows,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
