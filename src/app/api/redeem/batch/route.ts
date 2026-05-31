import { NextRequest } from "next/server";
import JSZip from "jszip";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";

interface CredentialRow {
  id: number;
  filename: string;
  content: string;
}

const MAX_BATCH = 50;

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

  let body: { count?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  const count = parseInt(String(body.count));
  if (!count || count < 1) {
    return Response.json({ error: "兑换数量必须 ≥ 1" }, { status: 400 });
  }
  if (count > MAX_BATCH) {
    return Response.json({ error: `单次最多兑换 ${MAX_BATCH} 个` }, { status: 400 });
  }

  const db = getDb();
  const now = new Date().toISOString().replace("T", " ").substring(0, 19);
  const slug = request.nextUrl.searchParams.get("slug");
  const adminId = resolveAdminId(db, slug);

  const result = db.transaction(() => {
    const priceRow = db
      .prepare("SELECT value FROM settings WHERE key = 'account_price'")
      .get() as { value: string } | undefined;
    const price = parseInt(priceRow?.value || "100");
    if (!price || price <= 0) {
      return { ok: false as const, status: 500, error: "兑换价格未配置" };
    }

    const totalCost = price * count;

    const userRow = db
      .prepare("SELECT balance FROM users WHERE id = ?")
      .get(session.id) as { balance: number } | undefined;
    if (!userRow) {
      return { ok: false as const, status: 401, error: "用户不存在" };
    }
    if (userRow.balance < totalCost) {
      return {
        ok: false as const,
        status: 400,
        error: `余额不足，当前 ${userRow.balance} 点，需 ${totalCost} 点（${count} × ${price}）`,
      };
    }

    const adminFilter = adminId ? "AND admin_id = ?" : "";
    const adminParams = adminId ? [adminId] : [];

    const credentials = db
      .prepare(
        `SELECT id, filename, content FROM credentials WHERE is_redeemed = 0 ${adminFilter} ORDER BY id ASC LIMIT ?`
      )
      .all(...adminParams, count) as CredentialRow[];

    if (credentials.length < count) {
      return {
        ok: false as const,
        status: 400,
        error: `库存不足，当前可兑 ${credentials.length} 个，请求 ${count} 个`,
      };
    }

    const updateCred = db.prepare(
      "UPDATE credentials SET is_redeemed = 1, redeemed_by_user_id = ?, redeemed_at = ? WHERE id = ?"
    );

    for (const c of credentials) {
      updateCred.run(session.id, now, c.id);
    }

    const newBalance = userRow.balance - totalCost;

    db.prepare("UPDATE users SET balance = ? WHERE id = ?").run(
      newBalance,
      session.id
    );

    const credentialIds = credentials.map((c) => c.id);

    db.prepare(
      `INSERT INTO user_transactions
       (user_id, type, amount, count, balance_after, related_credential_id, related_credential_ids, created_at)
       VALUES (?, 'redeem', ?, ?, ?, NULL, ?, ?)`
    ).run(session.id, -totalCost, count, newBalance, JSON.stringify(credentialIds), now);

    return {
      ok: true as const,
      balance: newBalance,
      price,
      totalCost,
      credentials,
    };
  })();

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  // Build zip
  const zip = new JSZip();
  const usedNames = new Map<string, number>();
  for (const c of result.credentials) {
    let name = c.filename;
    const seen = usedNames.get(name);
    if (seen !== undefined) {
      const dot = name.lastIndexOf(".");
      const base = dot > 0 ? name.substring(0, dot) : name;
      const ext = dot > 0 ? name.substring(dot) : "";
      name = `${base}_${seen + 1}${ext}`;
      usedNames.set(c.filename, seen + 1);
    } else {
      usedNames.set(c.filename, 0);
    }
    zip.file(name, c.content);
  }

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const ts = now.replace(/[: ]/g, "-");
  const zipName = `accounts-${result.credentials.length}-${ts}.zip`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"`,
      "Content-Length": String(buffer.length),
      "X-Balance-After": String(result.balance),
      "X-Price": String(result.price),
      "X-Total-Cost": String(result.totalCost),
      "X-Count": String(result.credentials.length),
      "X-Filename": encodeURIComponent(zipName),
      "Access-Control-Expose-Headers":
        "X-Balance-After, X-Price, X-Total-Cost, X-Count, X-Filename, Content-Disposition",
      "Cache-Control": "no-store",
    },
  });
}
