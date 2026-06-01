import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return Response.json({ error: "未授权" }, { status: 401 });
  }

  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM settings").all() as {
    key: string;
    value: string;
  }[];
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return Response.json(result);
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return Response.json({ error: "未授权" }, { status: 401 });
  }

  const body = await request.json();
  const db = getDb();
  const upsert = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );

  const allowedKeys = ["announcement", "contact_info", "contact_icon", "account_price", "health_check_interval"];
  const transaction = db.transaction((entries: [string, string][]) => {
    for (const [k, v] of entries) {
      if (!allowedKeys.includes(k)) continue;
      let value = v;
      if (k === "account_price") {
        const n = parseInt(v);
        if (!n || n < 1) value = "100";
        else value = String(n);
      }
      if (k === "health_check_interval") {
        const n = parseInt(v);
        if (!n || n < 0) value = "0";
        else value = String(n);
      }
      upsert.run(k, value);
    }
  });

  transaction(Object.entries(body) as [string, string][]);

  return Response.json({ success: true });
}
