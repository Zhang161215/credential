import { getUserSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const session = await getUserSession();
  if (!session) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const db = getDb();
  const row = db
    .prepare("SELECT id, username, balance, created_at, last_login_at FROM users WHERE id = ?")
    .get(session.id) as
    | { id: number; username: string; balance: number; created_at: string; last_login_at: string | null }
    | undefined;

  if (!row) {
    return Response.json({ error: "用户不存在" }, { status: 401 });
  }

  return Response.json(row);
}
