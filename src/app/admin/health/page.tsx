"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  HeartPulse,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RefreshCw,
} from "lucide-react";

interface HealthSummary {
  healthy: number;
  unhealthy: number;
  expired: number;
  unknown: number;
}

interface HealthRecord {
  id: number;
  credential_id: number;
  filename: string;
  status: string;
  five_hour_percent: number | null;
  weekly_percent: number | null;
  error_message: string | null;
  checked_at: string;
}

interface HistoryResponse {
  data: HealthRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  healthy: { label: "健康", color: "text-green-600 bg-green-50" },
  unhealthy: { label: "异常", color: "text-orange-600 bg-orange-50" },
  expired: { label: "过期", color: "text-red-600 bg-red-50" },
  unknown: { label: "未检测", color: "text-gray-500 bg-gray-50" },
};

export default function HealthPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");

  const fetchSummary = useCallback(async () => {
    const res = await fetch("/api/admin/health");
    if (res.status === 401) {
      router.push("/admin/login");
      return;
    }
    if (res.ok) setSummary(await res.json());
  }, [router]);

  const fetchHistory = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: "15" });
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/admin/health/history?${params}`);
    if (res.ok) setHistory(await res.json());
  }, [page, statusFilter]);

  useEffect(() => {
    Promise.all([fetchSummary(), fetchHistory()]).finally(() =>
      setLoading(false)
    );
  }, [fetchSummary, fetchHistory]);

  const handleCheck = async () => {
    setChecking(true);
    try {
      await fetch("/api/admin/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size: 10 }),
      });
      await Promise.all([fetchSummary(), fetchHistory()]);
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        加载中...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">凭证健康检测</h2>
        <Button onClick={handleCheck} disabled={checking}>
          {checking ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {checking ? "检测中..." : "立即检测"}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <HeartPulse className="size-4 text-green-600" />
              健康
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {summary?.healthy ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="size-4 text-orange-600" />
              异常
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">
              {summary?.unhealthy ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <XCircle className="size-4 text-red-600" />
              过期
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {summary?.expired ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <HelpCircle className="size-4 text-gray-500" />
              未检测
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-500">
              {summary?.unknown ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {["", "healthy", "unhealthy", "expired"].map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setStatusFilter(s);
              setPage(1);
            }}
          >
            {s ? STATUS_MAP[s]?.label : "全部"}
          </Button>
        ))}
      </div>

      {/* History Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">凭证ID</th>
              <th className="text-left p-3 font-medium">文件名</th>
              <th className="text-left p-3 font-medium">状态</th>
              <th className="text-left p-3 font-medium">5h 剩余</th>
              <th className="text-left p-3 font-medium">周 剩余</th>
              <th className="text-left p-3 font-medium">错误信息</th>
              <th className="text-left p-3 font-medium">检测时间</th>
            </tr>
          </thead>
          <tbody>
            {history?.data.map((row) => {
              const st = STATUS_MAP[row.status] || STATUS_MAP.unknown;
              return (
                <tr key={row.id} className="border-t">
                  <td className="p-3">{row.credential_id}</td>
                  <td className="p-3 max-w-32 truncate" title={row.filename}>
                    {row.filename}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${st.color}`}
                    >
                      {st.label}
                    </span>
                  </td>
                  <td className="p-3">
                    {row.five_hour_percent != null
                      ? `${row.five_hour_percent.toFixed(1)}%`
                      : "-"}
                  </td>
                  <td className="p-3">
                    {row.weekly_percent != null
                      ? `${row.weekly_percent.toFixed(1)}%`
                      : "-"}
                  </td>
                  <td className="p-3 text-muted-foreground max-w-40 truncate" title={row.error_message || ""}>
                    {row.error_message || "-"}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {row.checked_at ? new Date(row.checked_at + "Z").toLocaleString("zh-CN") : "-"}
                  </td>
                </tr>
              );
            })}
            {(!history || history.data.length === 0) && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  暂无检测记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {history && history.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {history.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= history.totalPages}
            onClick={() => setPage(page + 1)}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  );
}
