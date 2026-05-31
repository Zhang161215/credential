import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return Response.json({ error: "未授权" }, { status: 401 });
  }

  const db = getDb();
  const isSuperadmin = admin.role === "superadmin";

  const credWhere = isSuperadmin ? "" : "WHERE admin_id = ?";
  const credParams = isSuperadmin ? [] : [admin.id];

  const totalCredentials = (
    db.prepare(`SELECT COUNT(*) as count FROM credentials ${credWhere}`).get(...credParams) as { count: number }
  ).count;
  const redeemedCredentials = (
    db.prepare(`SELECT COUNT(*) as count FROM credentials WHERE is_redeemed = 1 ${isSuperadmin ? "" : "AND admin_id = ?"}`).get(...credParams) as {
      count: number;
    }
  ).count;
  const availableCredentials = totalCredentials - redeemedCredentials;

  const cardWhere = isSuperadmin ? "" : "WHERE admin_id = ?";
  const cardParams = isSuperadmin ? [] : [admin.id];

  const totalCards = (
    db.prepare(`SELECT COUNT(*) as count FROM card_keys ${cardWhere}`).get(...cardParams) as { count: number }
  ).count;
  const usedCards = (
    db.prepare(`SELECT COUNT(*) as count FROM card_keys WHERE is_used = 1 ${isSuperadmin ? "" : "AND admin_id = ?"}`).get(...cardParams) as {
      count: number;
    }
  ).count;
  const totalCardValue = (
    db.prepare(`SELECT COALESCE(SUM(value), 0) as v FROM card_keys ${cardWhere}`).get(...cardParams) as { v: number }
  ).v;
  const usedCardValue = (
    db
      .prepare(`SELECT COALESCE(SUM(value), 0) as v FROM card_keys WHERE is_used = 1 ${isSuperadmin ? "" : "AND admin_id = ?"}`)
      .get(...cardParams) as { v: number }
  ).v;

  const totalUsers = (
    db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number }
  ).count;
  const totalRecharged = (
    db
      .prepare(
        "SELECT COALESCE(SUM(amount), 0) as v FROM user_transactions WHERE type = 'recharge'"
      )
      .get() as { v: number }
  ).v;

  // For redeem stats, filter by credential ownership if needed
  let totalRedeemed: number;
  if (isSuperadmin) {
    totalRedeemed = (
      db
        .prepare(
          "SELECT COALESCE(SUM(count), 0) as v FROM user_transactions WHERE type = 'redeem'"
        )
        .get() as { v: number }
    ).v;
  } else {
    // Count redeemed credentials belonging to this admin
    totalRedeemed = (
      db
        .prepare(
          "SELECT COUNT(*) as v FROM credentials WHERE is_redeemed = 1 AND admin_id = ?"
        )
        .get(admin.id) as { v: number }
    ).v;
  }

  const totalBalance = (
    db.prepare("SELECT COALESCE(SUM(balance), 0) as v FROM users").get() as { v: number }
  ).v;

  return Response.json({
    totalCredentials,
    availableCredentials,
    redeemedCredentials,
    totalCards,
    usedCards,
    unusedCards: totalCards - usedCards,
    totalCardValue,
    usedCardValue,
    totalUsers,
    totalRecharged,
    totalRedeemed,
    totalBalance,
  });
}
