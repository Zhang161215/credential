import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return Response.json({ error: "未授权" }, { status: 401 });
  }

  const db = getDb();
  const adminId = session.role === "superadmin" ? undefined : session.id;
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get("pageSize") || "20")));
  const statusFilter = url.searchParams.get("status") || "";

  const offset = (page - 1) * pageSize;
  const adminFilter = adminId ? "AND c.admin_id = ?" : "";
  const statusWhere = statusFilter ? "AND h.status = ?" : "";

  const baseParams: (number | string)[] = adminId ? [adminId] : [];
  const filterParams: (number | string)[] = statusFilter ? [statusFilter] : [];

  const countSql = `
    SELECT COUNT(*) as total
    FROM credential_health h
    JOIN credentials c ON c.id = h.credential_id
    WHERE 1=1 ${adminFilter} ${statusWhere}
  `;
  const { total } = db
    .prepare(countSql)
    .get(...baseParams, ...filterParams) as { total: number };

  const dataSql = `
    SELECT h.id, h.credential_id, h.status, h.five_hour_percent, h.weekly_percent,
           h.five_hour_reset_at, h.weekly_reset_at, h.error_message, h.checked_at,
           c.filename
    FROM credential_health h
    JOIN credentials c ON c.id = h.credential_id
    WHERE 1=1 ${adminFilter} ${statusWhere}
    ORDER BY h.checked_at DESC
    LIMIT ? OFFSET ?
  `;
  const rows = db
    .prepare(dataSql)
    .all(...baseParams, ...filterParams, pageSize, offset);

  return Response.json({
    data: rows,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
