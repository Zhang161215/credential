import { getDb } from "@/lib/db";

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
        "SELECT COUNT(*) as count FROM user_transactions WHERE type = 'redeem' AND created_at >= datetime('now', '-5 minutes')"
      )
      .get() as { count: number }
  ).count;

  return Response.json({ inventory, recent5min });
}
