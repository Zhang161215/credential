import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return Response.json({ error: "未授权" }, { status: 401 });
  }

  const db = getDb();

  const totalCredentials = (
    db.prepare("SELECT COUNT(*) as count FROM credentials").get() as { count: number }
  ).count;
  const redeemedCredentials = (
    db.prepare("SELECT COUNT(*) as count FROM credentials WHERE is_redeemed = 1").get() as {
      count: number;
    }
  ).count;
  const availableCredentials = totalCredentials - redeemedCredentials;

  const totalCards = (
    db.prepare("SELECT COUNT(*) as count FROM card_keys").get() as { count: number }
  ).count;
  const usedCards = (
    db.prepare("SELECT COUNT(*) as count FROM card_keys WHERE is_used = 1").get() as {
      count: number;
    }
  ).count;
  const totalCardValue = (
    db.prepare("SELECT COALESCE(SUM(value), 0) as v FROM card_keys").get() as { v: number }
  ).v;
  const usedCardValue = (
    db
      .prepare("SELECT COALESCE(SUM(value), 0) as v FROM card_keys WHERE is_used = 1")
      .get() as { v: number }
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
  const totalRedeemed = (
    db
      .prepare(
        "SELECT COALESCE(SUM(count), 0) as v FROM user_transactions WHERE type = 'redeem'"
      )
      .get() as { v: number }
  ).v;
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
