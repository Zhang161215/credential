import { getDb } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return Response.json({ error: "请输入用户名和密码" }, { status: 400 });
    }

    const db = getDb();
    const user = db
      .prepare("SELECT id, username, password_hash, role, slug FROM admin WHERE username = ?")
      .get(username) as {
        id: number;
        username: string;
        password_hash: string;
        role: string | null;
        slug: string | null;
      } | undefined;

    if (!user || !verifyPassword(password, user.password_hash)) {
      return Response.json({ error: "用户名或密码错误" }, { status: 401 });
    }

    await createSession({
      id: user.id,
      username: user.username,
      role: (user.role || "superadmin") as "superadmin" | "admin",
      slug: user.slug || null,
    });

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "服务器错误" }, { status: 500 });
  }
}
