import type Database from "better-sqlite3";

export interface HealthCheckResult {
  credentialId: number;
  status: "healthy" | "unhealthy" | "expired" | "unknown";
  fiveHourPercent: number | null;
  weeklyPercent: number | null;
  fiveHourResetAt: string | null;
  weeklyResetAt: string | null;
  errorMessage: string | null;
}

interface RateLimit {
  percent_left: number;
  reset_time_ms: number;
  limit_window_seconds: number;
}

interface UsageResponse {
  rate_limits: RateLimit[];
}

interface CredentialRow {
  id: number;
  content: string;
  admin_id: number | null;
}

/**
 * Check a single credential's health by calling the OpenAI Codex quota API.
 */
export async function checkCredentialHealth(
  credential: CredentialRow
): Promise<HealthCheckResult> {
  const base: HealthCheckResult = {
    credentialId: credential.id,
    status: "unknown",
    fiveHourPercent: null,
    weeklyPercent: null,
    fiveHourResetAt: null,
    weeklyResetAt: null,
    errorMessage: null,
  };

  try {
    const parsed = JSON.parse(credential.content);
    const tokens = parsed.tokens || parsed;
    const accessToken = tokens.access_token;
    const accountId = tokens.account_id;

    if (!accessToken) {
      base.status = "unhealthy";
      base.errorMessage = "缺少 access_token";
      return base;
    }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Origin: "https://chatgpt.com",
      Referer: "https://chatgpt.com/",
    };
    if (accountId) {
      headers["Chatgpt-Account-Id"] = accountId;
    }

    const res = await fetch("https://chatgpt.com/backend-api/wham/usage", {
      headers,
    });

    if (res.status === 401) {
      base.status = "expired";
      base.errorMessage = "Token 已过期或无效 (401)";
      return base;
    }

    if (res.status === 403) {
      base.status = "unhealthy";
      base.errorMessage = "账号异常 (403)";
      return base;
    }

    if (!res.ok) {
      base.status = "unhealthy";
      base.errorMessage = `HTTP ${res.status}`;
      return base;
    }

    const data = (await res.json()) as UsageResponse;
    const rateLimits = data.rate_limits || [];

    // Parse rate limits: 5h window (18000s) and weekly window (604800s)
    for (const rl of rateLimits) {
      const resetAt = rl.reset_time_ms
        ? new Date(rl.reset_time_ms).toISOString()
        : null;

      if (rl.limit_window_seconds === 18000) {
        base.fiveHourPercent = rl.percent_left;
        base.fiveHourResetAt = resetAt;
      } else if (rl.limit_window_seconds === 604800) {
        base.weeklyPercent = rl.percent_left;
        base.weeklyResetAt = resetAt;
      }
    }

    // Determine status based on percent_left
    const allPercents = rateLimits.map((r) => r.percent_left);
    if (allPercents.length === 0) {
      base.status = "healthy";
    } else if (allPercents.some((p) => p <= 0)) {
      base.status = "unhealthy";
      base.errorMessage = "配额已耗尽";
    } else {
      base.status = "healthy";
    }

    return base;
  } catch (err) {
    base.status = "unknown";
    base.errorMessage =
      err instanceof Error ? err.message : "未知错误";
    return base;
  }
}

/**
 * Sample unredeemed credentials, prioritizing those least recently checked.
 */
export function sampleCredentials(
  db: Database.Database,
  adminId?: number,
  size: number = 10
): CredentialRow[] {
  const adminFilter = adminId ? "AND c.admin_id = ?" : "";
  const params: (number | string)[] = adminId ? [adminId] : [];

  const sql = `
    SELECT c.id, c.content, c.admin_id
    FROM credentials c
    LEFT JOIN (
      SELECT credential_id, MAX(checked_at) as last_check
      FROM credential_health
      GROUP BY credential_id
    ) h ON h.credential_id = c.id
    WHERE c.is_redeemed = 0 ${adminFilter}
    ORDER BY h.last_check ASC NULLS FIRST, c.id ASC
    LIMIT ?
  `;
  params.push(size);

  return db.prepare(sql).all(...params) as CredentialRow[];
}

/**
 * Run health checks on a batch of credentials with concurrency control.
 */
export async function runHealthCheck(
  db: Database.Database,
  adminId?: number,
  size: number = 10,
  concurrency: number = 3
): Promise<HealthCheckResult[]> {
  const credentials = sampleCredentials(db, adminId, size);
  if (credentials.length === 0) return [];

  const results: HealthCheckResult[] = [];
  const insertStmt = db.prepare(`
    INSERT INTO credential_health
      (credential_id, status, five_hour_percent, weekly_percent, five_hour_reset_at, weekly_reset_at, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Process in batches of `concurrency`
  for (let i = 0; i < credentials.length; i += concurrency) {
    const batch = credentials.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map((cred) => checkCredentialHealth(cred))
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        const r = result.value;
        results.push(r);
        insertStmt.run(
          r.credentialId,
          r.status,
          r.fiveHourPercent,
          r.weeklyPercent,
          r.fiveHourResetAt,
          r.weeklyResetAt,
          r.errorMessage
        );
      }
    }
  }

  return results;
}
