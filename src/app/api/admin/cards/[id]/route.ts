import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function PATCH(
  request: Request,
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

  // Verify ownership for non-superadmin
  if (admin.role !== "superadmin") {
    const card = db
      .prepare("SELECT admin_id FROM card_keys WHERE id = ?")
      .get(id) as { admin_id: number | null } | undefined;
    if (!card || card.admin_id !== admin.id) {
      return Response.json({ error: "无权操作" }, { status: 403 });
    }
  }

  let body: { is_used?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  if (typeof body.is_used !== "boolean") {
    return Response.json({ error: "参数错误" }, { status: 400 });
  }

  if (body.is_used) {
    // Mark as used
    db.prepare(
      "UPDATE card_keys SET is_used = 1, used_at = datetime('now') WHERE id = ?"
    ).run(id);
  } else {
    // Mark as unused - clear usage info
    db.prepare(
      "UPDATE card_keys SET is_used = 0, used_at = NULL, used_by_user_id = NULL, used_ip = NULL WHERE id = ?"
    ).run(id);
  }

  return Response.json({ success: true });
}

export async function DELETE(
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

  // Verify ownership for non-superadmin
  if (admin.role !== "superadmin") {
    const card = db
      .prepare("SELECT admin_id FROM card_keys WHERE id = ?")
      .get(id) as { admin_id: number | null } | undefined;
    if (!card || card.admin_id !== admin.id) {
      return Response.json({ error: "无权操作" }, { status: 403 });
    }
  }

  const result = db.prepare("DELETE FROM card_keys WHERE id = ?").run(id);

  if (result.changes === 0) {
    return Response.json({ error: "卡密不存在" }, { status: 404 });
  }
  return Response.json({ success: true });
}
