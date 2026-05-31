"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { Loader2, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface RecordRow {
  id: number;
  user_id: number;
  username: string | null;
  amount: number;
  count: number;
  balance_after: number;
  related_credential_id: number | null;
  related_credential_ids: string | null;
  created_at: string;
}

export default function RecordsPage() {
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/records?page=${page}`)
      .then((res) => {
        if (res.status === 401) {
          router.push("/admin/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setRecords(data.data);
          setTotal(data.total);
          setTotalPages(data.totalPages);
        }
      })
      .finally(() => setLoading(false));
  }, [page, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const hasCredentials = (r: RecordRow) =>
    !!(r.related_credential_ids || r.related_credential_id);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">提取记录</h2>

      <Card>
        <CardHeader>
          <CardTitle>所有兑换记录 ({total})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="size-4 animate-spin" />
              加载中...
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>用户名</TableHead>
                    <TableHead>数量</TableHead>
                    <TableHead>消耗点数</TableHead>
                    <TableHead>余额</TableHead>
                    <TableHead>时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.id}</TableCell>
                      <TableCell className="font-medium">{r.username || "-"}</TableCell>
                      <TableCell>{r.count}</TableCell>
                      <TableCell className="text-orange-600 font-medium">
                        {Math.abs(r.amount)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.balance_after}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(r.created_at)}
                      </TableCell>
                      <TableCell>
                        {hasCredentials(r) ? (
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() =>
                              window.open(`/api/admin/records/download/${r.id}`, "_blank")
                            }
                          >
                            <Download className="size-3" />
                            下载
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {records.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="size-4" />
                    上一页
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                  >
                    下一页
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
