import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return Response.json({ error: "未授权" }, { status: 401 });
  }

  const db = getDb();
  const url = request.nextUrl;
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const pageSize = 20;
  const status = url.searchParams.get("status") || ""; // "" | "available" | "redeemed"
  const offset = (page - 1) * pageSize;

  let where = "";
  if (status === "available") {
    where = "WHERE c.is_redeemed = 0";
  } else if (status === "redeemed") {
    where = "WHERE c.is_redeemed = 1";
  }

  const total = (
    db.prepare(`SELECT COUNT(*) as count FROM credentials c ${where}`).get() as {
      count: number;
    }
  ).count;

  const rows = db
    .prepare(
      `SELECT c.id, c.filename, c.is_redeemed, c.redeemed_at, c.created_at,
              c.redeemed_by_user_id, u.username as redeemed_by_username
       FROM credentials c
       LEFT JOIN users u ON u.id = c.redeemed_by_user_id
       ${where}
       ORDER BY c.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(pageSize, offset);

  return Response.json({
    data: rows,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return Response.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const db = getDb();
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return Response.json({ error: "请上传至少一个文件" }, { status: 400 });
    }

    const insert = db.prepare(
      "INSERT INTO credentials (filename, content) VALUES (?, ?)"
    );

    const fileData: { name: string; content: string }[] = [];
    let invalidCount = 0;
    for (const file of files) {
      const content = await file.text();
      try {
        JSON.parse(content);
        fileData.push({ name: file.name, content });
      } catch {
        invalidCount++;
      }
    }

    const insertAll = db.transaction((items: { name: string; content: string }[]) => {
      for (const item of items) {
        insert.run(item.name, item.content);
      }
    });

    insertAll(fileData);

    return Response.json({ success: true, count: fileData.length, invalid: invalidCount });
  } catch {
    return Response.json({ error: "上传失败" }, { status: 500 });
  }
}
