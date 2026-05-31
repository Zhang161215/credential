import JSZip from "jszip";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

interface CredentialRow {
  id: number;
  filename: string;
  content: string;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch {
    return Response.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;
  const txId = parseInt(id);
  if (!txId) {
    return Response.json({ error: "无效的记录 ID" }, { status: 400 });
  }

  const db = getDb();

  const tx = db
    .prepare(
      `SELECT id, related_credential_id, related_credential_ids
       FROM user_transactions
       WHERE id = ? AND type = 'redeem'`
    )
    .get(txId) as {
      id: number;
      related_credential_id: number | null;
      related_credential_ids: string | null;
    } | undefined;

  if (!tx) {
    return Response.json({ error: "记录不存在" }, { status: 404 });
  }

  let credentialIds: number[] = [];
  if (tx.related_credential_ids) {
    try {
      credentialIds = JSON.parse(tx.related_credential_ids);
    } catch {
      // ignore
    }
  }
  if (credentialIds.length === 0 && tx.related_credential_id) {
    credentialIds = [tx.related_credential_id];
  }

  if (credentialIds.length === 0) {
    return Response.json({ error: "该记录无关联凭证" }, { status: 404 });
  }

  const placeholders = credentialIds.map(() => "?").join(",");
  const credentials = db
    .prepare(
      `SELECT id, filename, content FROM credentials WHERE id IN (${placeholders})`
    )
    .all(...credentialIds) as CredentialRow[];

  if (credentials.length === 0) {
    return Response.json({ error: "凭证数据不存在" }, { status: 404 });
  }

  if (credentials.length === 1) {
    const c = credentials[0];
    return new Response(c.content, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(c.filename)}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const zip = new JSZip();
  const usedNames = new Map<string, number>();
  for (const c of credentials) {
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

  const zipName = `accounts-${credentials.length}.zip`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
    },
  });
}
