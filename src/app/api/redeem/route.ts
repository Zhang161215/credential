import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";

interface CredentialRow {
  id: number;
  filename: string;
  content: string;
}

function resolveAdminId(db: ReturnType<typeof getDb>, slug: string | null): number | null {
  if (!slug) return null;
  const row = db
    .prepare("SELECT id FROM admin WHERE slug = ?")
    .get(slug) as { id: number } | undefined;
  return row?.id ?? null;
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireUser();
  } catch {
    return Response.json({ error: "请先登录" }, { status: 401 });
  }

  const db = getDb();
  const now = new Date().toISOString().replace("T", " ").substring(0, 19);
  const slug = request.nextUrl.searchParams.get("slug");
  const adminId = resolveAdminId(db, slug);

  try {
    const result = db.transaction(() => {
      const priceRow = db
        .prepare("SELECT value FROM settings WHERE key = 'account_price'")
        .get() as { value: string } | undefined;
      const price = parseInt(priceRow?.value || "100");
      if (!price || price <= 0) {
        return { ok: false as const, status: 500, error: "兑换价格未配置" };
      }

      const userRow = db
        .prepare("SELECT balance FROM users WHERE id = ?")
        .get(session.id) as { balance: number } | undefined;
      if (!userRow) {
        return { ok: false as const, status: 401, error: "用户不存在" };
      }

      if (userRow.balance < price) {
        return { ok: false as const, status: 400, error: `余额不足，当前 ${userRow.balance} 点，需 ${price} 点` };
      }

      // Filter by admin_id if slug provided
      const adminFilter = adminId ? "AND admin_id = ?" : "";
      const adminParams = adminId ? [adminId] : [];

      const credential = db
        .prepare(
          `SELECT id, filename, content FROM credentials WHERE is_redeemed = 0 ${adminFilter} ORDER BY id ASC LIMIT 1`
        )
        .get(...adminParams) as CredentialRow | undefined;

      if (!credential) {
        return { ok: false as const, status: 400, error: "暂无可用账号，请联系管理员" };
      }

      const newBalance = userRow.balance - price;

      db.prepare(
        "UPDATE credentials SET is_redeemed = 1, redeemed_by_user_id = ?, redeemed_at = ? WHERE id = ?"
      ).run(session.id, now, credential.id);

      db.prepare("UPDATE users SET balance = ? WHERE id = ?").run(newBalance, session.id);

      db.prepare(
        `INSERT INTO user_transactions
         (user_id, type, amount, count, balance_after, related_credential_id, related_credential_ids, created_at)
         VALUES (?, 'redeem', ?, 1, ?, ?, ?, ?)`
      ).run(session.id, -price, newBalance, credential.id, JSON.stringify([credential.id]), now);

      return {
        ok: true as const,
        balance: newBalance,
        price,
        filename: credential.filename,
        content: credential.content,
      };
    })();

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({
      success: true,
      balance: result.balance,
      price: result.price,
      filename: result.filename,
      content: result.content,
    });
  } catch {
    return Response.json({ error: "服务器错误" }, { status: 500 });
  }
}
