import { getDb } from "@/lib/db";
import { createUserSession, hashPassword, getClientIp } from "@/lib/auth";

const USERNAME_RE = /^[A-Za-z0-9_]{3,32}$/;

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (typeof username !== "string" || typeof password !== "string") {
      return Response.json({ error: "请输入用户名和密码" }, { status: 400 });
    }

    const u = username.trim();
    if (!USERNAME_RE.test(u)) {
      return Response.json(
        { error: "用户名需 3-32 字符，仅支持字母/数字/下划线" },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return Response.json({ error: "密码至少 6 位" }, { status: 400 });
    }

    const db = getDb();
    const exists = db.prepare("SELECT id FROM users WHERE username = ?").get(u);
    if (exists) {
      return Response.json({ error: "用户名已被占用" }, { status: 409 });
    }

    const hash = hashPassword(password);
    const ip = getClientIp(request);
    const now = new Date().toISOString().replace("T", " ").substring(0, 19);

    const result = db
      .prepare(
        "INSERT INTO users (username, password_hash, balance, last_login_at, last_login_ip) VALUES (?, ?, 0, ?, ?)"
      )
      .run(u, hash, now, ip);

    const id = result.lastInsertRowid as number;
    await createUserSession({ id, username: u });

    return Response.json({ success: true, username: u, balance: 0 });
  } catch {
    return Response.json({ error: "服务器错误" }, { status: 500 });
  }
}
