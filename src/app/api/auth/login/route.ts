import { getDb } from "@/lib/db";
import { createUserSession, verifyPassword, getClientIp } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
      return Response.json({ error: "请输入用户名和密码" }, { status: 400 });
    }

    const u = username.trim();
    const db = getDb();
    const user = db
      .prepare("SELECT id, username, password_hash, balance FROM users WHERE username = ?")
      .get(u) as
      | { id: number; username: string; password_hash: string; balance: number }
      | undefined;

    if (!user || !verifyPassword(password, user.password_hash)) {
      return Response.json({ error: "用户名或密码错误" }, { status: 401 });
    }

    const ip = getClientIp(request);
    const now = new Date().toISOString().replace("T", " ").substring(0, 19);
    db.prepare("UPDATE users SET last_login_at = ?, last_login_ip = ? WHERE id = ?")
      .run(now, ip, user.id);

    await createUserSession({ id: user.id, username: user.username });

    return Response.json({
      success: true,
      username: user.username,
      balance: user.balance,
    });
  } catch {
    return Response.json({ error: "服务器错误" }, { status: 500 });
  }
}
