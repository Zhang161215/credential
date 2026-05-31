import { requireSuperAdmin, hashPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
  } catch (e) {
    const msg = (e as Error).message;
    return Response.json(
      { error: msg === "Forbidden" ? "无权操作" : "未授权" },
      { status: msg === "Forbidden" ? 403 : 401 }
    );
  }

  const { id } = await params;
  const adminId = parseInt(id);
  if (!adminId) {
    return Response.json({ error: "无效的 ID" }, { status: 400 });
  }

  let body: {
    password?: string;
    display_name?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  const db = getDb();

  const admin = db
    .prepare("SELECT id, role FROM admin WHERE id = ?")
    .get(adminId) as { id: number; role: string } | undefined;

  if (!admin) {
    return Response.json({ error: "管理员不存在" }, { status: 404 });
  }

  // Cannot edit superadmin through this API
  if (admin.role === "superadmin") {
    return Response.json({ error: "不能通过此接口修改超级管理员" }, { status: 400 });
  }

  const updates: string[] = [];
  const values: (string | number)[] = [];

  if (body.password && body.password.length >= 6) {
    updates.push("password_hash = ?");
    values.push(hashPassword(body.password));
  }
  if (body.display_name !== undefined) {
    updates.push("display_name = ?");
    values.push(body.display_name);
  }

  if (updates.length === 0) {
    return Response.json({ error: "没有要更新的字段" }, { status: 400 });
  }

  values.push(adminId);
  db.prepare(`UPDATE admin SET ${updates.join(", ")} WHERE id = ?`).run(
    ...values
  );

  return Response.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
  } catch (e) {
    const msg = (e as Error).message;
    return Response.json(
      { error: msg === "Forbidden" ? "无权操作" : "未授权" },
      { status: msg === "Forbidden" ? 403 : 401 }
    );
  }

  const { id } = await params;
  const adminId = parseInt(id);
  if (!adminId) {
    return Response.json({ error: "无效的 ID" }, { status: 400 });
  }

  const db = getDb();

  const admin = db
    .prepare("SELECT id, role FROM admin WHERE id = ?")
    .get(adminId) as { id: number; role: string } | undefined;

  if (!admin) {
    return Response.json({ error: "管理员不存在" }, { status: 404 });
  }

  if (admin.role === "superadmin") {
    return Response.json({ error: "不能删除超级管理员" }, { status: 400 });
  }

  db.prepare("DELETE FROM admin WHERE id = ?").run(adminId);

  return Response.json({ success: true });
}
