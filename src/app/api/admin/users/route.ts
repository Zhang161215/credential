import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return Response.json({ error: "未授权" }, { status: 401 });
  }

  const db = getDb();
  const url = request.nextUrl;
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const pageSize = 20;
  const offset = (page - 1) * pageSize;
  const search = (url.searchParams.get("q") || "").trim();

  let where = "";
  const params: (string | number)[] = [];
  if (search) {
    where = "WHERE username LIKE ?";
    params.push(`%${search}%`);
  }

  const total = (
    db
      .prepare(`SELECT COUNT(*) as count FROM users ${where}`)
      .get(...params) as { count: number }
  ).count;

  const rows = db
    .prepare(
      `SELECT id, username, balance, created_at, last_login_at, last_login_ip
       FROM users ${where}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, offset);

  return Response.json({
    data: rows,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

// Adjust user balance: { user_id, delta, note? }
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return Response.json({ error: "未授权" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  const userId = parseInt(body.user_id);
  const delta = parseInt(body.delta);

  if (!userId) {
    return Response.json({ error: "缺少 user_id" }, { status: 400 });
  }
  if (!Number.isFinite(delta) || delta === 0) {
    return Response.json({ error: "delta 必须为非零整数" }, { status: 400 });
  }

  const db = getDb();
  const now = new Date().toISOString().replace("T", " ").substring(0, 19);

  try {
    const result = db.transaction(() => {
      const user = db
        .prepare("SELECT id, balance FROM users WHERE id = ?")
        .get(userId) as { id: number; balance: number } | undefined;
      if (!user) {
        return { ok: false as const, error: "用户不存在" };
      }
      const newBalance = user.balance + delta;
      if (newBalance < 0) {
        return { ok: false as const, error: "余额扣除后不能小于 0" };
      }
      db.prepare("UPDATE users SET balance = ? WHERE id = ?").run(newBalance, userId);
      db.prepare(
        `INSERT INTO user_transactions (user_id, type, amount, balance_after, created_at)
         VALUES (?, 'admin_adjust', ?, ?, ?)`
      ).run(userId, delta, newBalance, now);
      return { ok: true as const, balance: newBalance };
    })();

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    return Response.json({ success: true, balance: result.balance });
  } catch {
    return Response.json({ error: "服务器错误" }, { status: 500 });
  }
}
