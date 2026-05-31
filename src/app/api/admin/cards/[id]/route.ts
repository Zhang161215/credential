import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

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
