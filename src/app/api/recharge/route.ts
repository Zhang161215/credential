import { getDb } from "@/lib/db";
import { requireUser, getClientIp } from "@/lib/auth";

interface CardRow {
  id: number;
  key: string;
  value: number;
  is_used: number;
}

interface SingleResult {
  key: string;
  success: boolean;
  value?: number;
  error?: string;
}

const MAX_BATCH = 50;

export async function POST(request: Request) {
  let session;
  try {
    session = await requireUser();
  } catch {
    return Response.json({ error: "请先登录" }, { status: 401 });
  }

  let body: { key?: unknown; keys?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  // Normalize to array of keys
  let rawKeys: string[];
  if (Array.isArray(body.keys)) {
    rawKeys = body.keys
      .filter((k: unknown): k is string => typeof k === "string" && !!k.trim())
      .map((k: string) => k.trim().toUpperCase());
  } else if (typeof body.key === "string" && body.key.trim()) {
    rawKeys = [body.key.trim().toUpperCase()];
  } else {
    return Response.json({ error: "请输入卡密" }, { status: 400 });
  }

  // Deduplicate
  rawKeys = [...new Set(rawKeys)];

  if (rawKeys.length === 0) {
    return Response.json({ error: "请输入卡密" }, { status: 400 });
  }
  if (rawKeys.length > MAX_BATCH) {
    return Response.json({ error: `单次最多 ${MAX_BATCH} 个卡密` }, { status: 400 });
  }

  const ip = getClientIp(request);
  const now = new Date().toISOString().replace("T", " ").substring(0, 19);
  const db = getDb();

  try {
    const results = db.transaction(() => {
      const items: SingleResult[] = [];
      let currentBalance: number | null = null;

      for (const trimmedKey of rawKeys) {
        const card = db
          .prepare("SELECT id, key, value, is_used FROM card_keys WHERE key = ?")
          .get(trimmedKey) as CardRow | undefined;

        if (!card) {
          items.push({ key: trimmedKey, success: false, error: "卡密无效" });
          continue;
        }
        if (card.is_used) {
          items.push({ key: trimmedKey, success: false, error: "卡密已使用" });
          continue;
        }

        // Get latest balance
        if (currentBalance === null) {
          const userRow = db
            .prepare("SELECT balance FROM users WHERE id = ?")
            .get(session.id) as { balance: number } | undefined;
          if (!userRow) {
            items.push({ key: trimmedKey, success: false, error: "用户不存在" });
            continue;
          }
          currentBalance = userRow.balance;
        }

        const newBalance: number = currentBalance + card.value;

        db.prepare(
          "UPDATE card_keys SET is_used = 1, used_by_user_id = ?, used_at = ?, used_ip = ? WHERE id = ?"
        ).run(session.id, now, ip, card.id);

        db.prepare("UPDATE users SET balance = ? WHERE id = ?").run(newBalance, session.id);

        db.prepare(
          `INSERT INTO user_transactions
           (user_id, type, amount, count, balance_after, related_card_key, created_at)
           VALUES (?, 'recharge', ?, 1, ?, ?, ?)`
        ).run(session.id, card.value, newBalance, card.key, now);

        currentBalance = newBalance;
        items.push({ key: trimmedKey, success: true, value: card.value });
      }

      return { items, balance: currentBalance };
    })();

    const successCount = results.items.filter((r) => r.success).length;
    const totalValue = results.items
      .filter((r) => r.success)
      .reduce((sum, r) => sum + (r.value || 0), 0);

    // Single key backward-compatible response
    if (rawKeys.length === 1) {
      const r = results.items[0];
      if (!r.success) {
        return Response.json({ error: r.error }, { status: 400 });
      }
      return Response.json({
        success: true,
        value: r.value,
        balance: results.balance,
      });
    }

    // Batch response
    return Response.json({
      results: results.items,
      successCount,
      totalValue,
      balance: results.balance,
    });
  } catch {
    return Response.json({ error: "服务器错误" }, { status: 500 });
  }
}
