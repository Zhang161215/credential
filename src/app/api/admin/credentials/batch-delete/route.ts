import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return Response.json({ error: "未授权" }, { status: 401 });
  }

  let body: { ids?: number[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
    return Response.json({ error: "请选择要删除的凭证" }, { status: 400 });
  }

  if (body.ids.length > 500) {
    return Response.json({ error: "单次最多删除 500 个" }, { status: 400 });
  }

  const db = getDb();
  const placeholders = body.ids.map(() => "?").join(",");

  if (admin.role !== "superadmin") {
    // Only delete credentials owned by this admin
    db.prepare(
      `DELETE FROM credentials WHERE id IN (${placeholders}) AND admin_id = ?`
    ).run(...body.ids, admin.id);
  } else {
    db.prepare(
      `DELETE FROM credentials WHERE id IN (${placeholders})`
    ).run(...body.ids);
  }

  return Response.json({ success: true });
}
