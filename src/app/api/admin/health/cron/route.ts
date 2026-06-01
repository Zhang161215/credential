import { getDb } from "@/lib/db";
import { runHealthCheck } from "@/lib/health-checker";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Verify cron secret for security
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET || "";

  if (!expectedSecret || secret !== expectedSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  // Check if health check is enabled via interval setting
  const intervalRow = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get("health_check_interval") as { value: string } | undefined;

  const interval = parseInt(intervalRow?.value || "0");
  if (interval <= 0) {
    return Response.json({ message: "Health check disabled (interval = 0)" });
  }

  // Check last run time to respect interval
  const lastCheck = db
    .prepare(
      "SELECT checked_at FROM credential_health ORDER BY checked_at DESC LIMIT 1"
    )
    .get() as { checked_at: string } | undefined;

  if (lastCheck) {
    const lastTime = new Date(lastCheck.checked_at + "Z").getTime();
    const now = Date.now();
    const elapsed = (now - lastTime) / 1000 / 60; // minutes
    if (elapsed < interval) {
      return Response.json({
        message: `Skipped: last check was ${Math.round(elapsed)} min ago, interval is ${interval} min`,
      });
    }
  }

  const results = await runHealthCheck(db, undefined, 10);

  return Response.json({
    checked: results.length,
    healthy: results.filter((r) => r.status === "healthy").length,
    unhealthy: results.filter((r) => r.status === "unhealthy").length,
    expired: results.filter((r) => r.status === "expired").length,
  });
}
