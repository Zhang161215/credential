import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { generateCardKey } from "@/lib/utils";

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
  const status = url.searchParams.get("status") || "";
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  // Admin data isolation
  if (admin.role !== "superadmin") {
    conditions.push("ck.admin_id = ?");
    params.push(admin.id);
  }

  if (status === "used") {
    conditions.push("ck.is_used = 1");
  } else if (status === "unused") {
    conditions.push("ck.is_used = 0");
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const total = (
    db
      .prepare(`SELECT COUNT(*) as count FROM card_keys ck ${where}`)
      .get(...params) as { count: number }
  ).count;

  const rows = db
    .prepare(
      `SELECT ck.id, ck.key, ck.value, ck.is_used, ck.used_at, ck.used_ip,
              ck.created_at, ck.used_by_user_id, u.username as used_by_username
       FROM card_keys ck
       LEFT JOIN users u ON u.id = ck.used_by_user_id
       ${where}
       ORDER BY ck.id DESC
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

export async function POST(request: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return Response.json({ error: "未授权" }, { status: 401 });
  }

  const db = getDb();
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  const count = parseInt(body.count);
  const value = parseInt(body.value);

  if (!count || count < 1 || count > 500) {
    return Response.json({ error: "数量应在 1-500 之间" }, { status: 400 });
  }
  if (!value || value < 1 || value > 1000000) {
    return Response.json({ error: "面值需在 1-1000000 之间" }, { status: 400 });
  }

  const insert = db.prepare("INSERT INTO card_keys (key, value, admin_id) VALUES (?, ?, ?)");
  const checkKey = db.prepare("SELECT id FROM card_keys WHERE key = ?");

  const keys: string[] = [];
  const transaction = db.transaction(() => {
    for (let i = 0; i < count; i++) {
      let key: string;
      do {
        key = generateCardKey();
      } while (checkKey.get(key));
      insert.run(key, value, admin.id);
      keys.push(key);
    }
  });
  transaction();

  return Response.json({ success: true, count: keys.length, keys, value });
}
