import { requireSuperAdmin, hashPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { generateSlug } from "@/lib/utils";

export async function GET() {
  try {
    await requireSuperAdmin();
  } catch (e) {
    const msg = (e as Error).message;
    return Response.json(
      { error: msg === "Forbidden" ? "无权操作" : "未授权" },
      { status: msg === "Forbidden" ? 403 : 401 }
    );
  }

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT a.id, a.username, a.role, a.slug, a.display_name, a.created_at, a.created_by,
              creator.username as created_by_username
       FROM admin a
       LEFT JOIN admin creator ON creator.id = a.created_by
       ORDER BY a.id ASC`
    )
    .all();

  return Response.json({ data: rows });
}

export async function POST(request: Request) {
  let superadmin;
  try {
    superadmin = await requireSuperAdmin();
  } catch (e) {
    const msg = (e as Error).message;
    return Response.json(
      { error: msg === "Forbidden" ? "无权操作" : "未授权" },
      { status: msg === "Forbidden" ? 403 : 401 }
    );
  }

  let body: {
    username?: string;
    password?: string;
    display_name?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  if (!body.username || body.username.length < 3 || body.username.length > 32) {
    return Response.json({ error: "用户名需 3-32 位" }, { status: 400 });
  }
  if (!body.password || body.password.length < 6) {
    return Response.json({ error: "密码至少 6 位" }, { status: 400 });
  }

  const db = getDb();

  // Check duplicate username
  const existing = db
    .prepare("SELECT id FROM admin WHERE username = ?")
    .get(body.username);
  if (existing) {
    return Response.json({ error: "用户名已存在" }, { status: 400 });
  }

  // Generate unique slug
  let slug: string;
  const checkSlug = db.prepare("SELECT id FROM admin WHERE slug = ?");
  do {
    slug = generateSlug();
  } while (checkSlug.get(slug));

  const passwordHash = hashPassword(body.password);

  const result = db
    .prepare(
      `INSERT INTO admin (username, password_hash, role, slug, display_name, created_by)
       VALUES (?, ?, 'admin', ?, ?, ?)`
    )
    .run(
      body.username,
      passwordHash,
      slug,
      body.display_name || body.username,
      superadmin.id
    );

  return Response.json({
    success: true,
    id: result.lastInsertRowid,
    slug,
  });
}
