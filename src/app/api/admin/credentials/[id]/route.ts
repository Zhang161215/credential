import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch {
    return Response.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();
  const result = db.prepare("DELETE FROM credentials WHERE id = ?").run(id);

  if (result.changes === 0) {
    return Response.json({ error: "凭证不存在" }, { status: 404 });
  }
  return Response.json({ success: true });
}
