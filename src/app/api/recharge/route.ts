import { getDb } from "@/lib/db";
import { requireUser, getClientIp } from "@/lib/auth";

interface CardRow {
  id: number;
  key: string;
  value: number;
  is_used: number;
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireUser();
  } catch {
    return Response.json({ error: "请先登录" }, { status: 401 });
  }

  let body: { key?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  if (typeof body.key !== "string" || !body.key.trim()) {
    return Response.json({ error: "请输入卡密" }, { status: 400 });
  }

  const trimmedKey = body.key.trim().toUpperCase();
  const ip = getClientIp(request);
  const now = new Date().toISOString().replace("T", " ").substring(0, 19);
  const db = getDb();

  try {
    const result = db.transaction(() => {
      const card = db
        .prepare("SELECT id, key, value, is_used FROM card_keys WHERE key = ?")
        .get(trimmedKey) as CardRow | undefined;

      if (!card) {
        return { ok: false as const, error: "卡密无效" };
      }
      if (card.is_used) {
        return { ok: false as const, error: "卡密已使用" };
      }

      const userRow = db
        .prepare("SELECT balance FROM users WHERE id = ?")
        .get(session.id) as { balance: number } | undefined;
      if (!userRow) {
        return { ok: false as const, error: "用户不存在" };
      }
      const newBalance = userRow.balance + card.value;

      db.prepare(
        "UPDATE card_keys SET is_used = 1, used_by_user_id = ?, used_at = ?, used_ip = ? WHERE id = ?"
      ).run(session.id, now, ip, card.id);

      db.prepare("UPDATE users SET balance = ? WHERE id = ?").run(newBalance, session.id);

      db.prepare(
        `INSERT INTO user_transactions
         (user_id, type, amount, count, balance_after, related_card_key, created_at)
         VALUES (?, 'recharge', ?, 1, ?, ?, ?)`
      ).run(session.id, card.value, newBalance, card.key, now);

      return { ok: true as const, value: card.value, balance: newBalance };
    })();

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    return Response.json({ success: true, value: result.value, balance: result.balance });
  } catch {
    return Response.json({ error: "服务器错误" }, { status: 500 });
  }
}
