import { getDb } from "@/lib/db";

interface RecentRow {
  id: number;
  count: number;
  created_at: string;
  username: string | null;
}

function maskUsername(name: string | null | undefined): string {
  if (!name) return "匿名用户";
  const len = name.length;
  if (len <= 2) return name[0] + "*";
  if (len <= 4) return name[0] + "**" + name[len - 1];
  return name[0] + "***" + name[len - 1];
}

export async function GET() {
  const db = getDb();

  const inventory = (
    db
      .prepare("SELECT COUNT(*) as count FROM credentials WHERE is_redeemed = 0")
      .get() as { count: number }
  ).count;

  const recent5min = (
    db
      .prepare(
        "SELECT COALESCE(SUM(count), 0) as v FROM user_transactions WHERE type = 'redeem' AND created_at >= datetime('now', '-5 minutes')"
      )
      .get() as { v: number }
  ).v;

  const recentRows = db
    .prepare(
      `SELECT t.id, t.count, t.created_at, u.username
       FROM user_transactions t
       LEFT JOIN users u ON u.id = t.user_id
       WHERE t.type = 'redeem' AND t.created_at >= datetime('now', '-5 minutes')
       ORDER BY t.id DESC
       LIMIT 20`
    )
    .all() as RecentRow[];

  const recent_redeems = recentRows.map((r) => ({
    id: r.id,
    username: maskUsername(r.username),
    count: r.count,
    created_at: r.created_at,
  }));

  return Response.json({ inventory, recent5min, recent_redeems });
}
