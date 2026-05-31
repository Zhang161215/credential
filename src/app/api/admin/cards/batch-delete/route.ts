import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return Response.json({ error: "未授权" }, { status: 401 });
  }

  let body: { ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return Response.json({ error: "请选择要删除的卡密" }, { status: 400 });
  }

  const ids = body.ids.filter(
    (id: unknown): id is number => typeof id === "number" && Number.isFinite(id)
  );

  if (ids.length === 0) {
    return Response.json({ error: "无效的 ID 列表" }, { status: 400 });
  }

  const db = getDb();
  const placeholders = ids.map(() => "?").join(",");

  // For non-superadmin, only delete cards they own
  let sql = `DELETE FROM card_keys WHERE id IN (${placeholders})`;
  const params: number[] = [...ids];

  if (admin.role !== "superadmin") {
    sql += " AND admin_id = ?";
    params.push(admin.id);
  }

  const result = db.prepare(sql).run(...params);

  return Response.json({ success: true, deleted: result.changes });
}
