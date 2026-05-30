"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  Loader2, Copy, Check, Download, Trash2, ChevronLeft, ChevronRight, KeyRound,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface CardKey {
  id: number;
  key: string;
  value: number;
  is_used: number;
  used_at: string | null;
  used_ip: string | null;
  used_by_user_id: number | null;
  used_by_username: string | null;
  created_at: string;
}

export default function CardsPage() {
  const [cards, setCards] = useState<CardKey[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState<"" | "used" | "unused">("");
  const [loading, setLoading] = useState(true);

  const [genCount, setGenCount] = useState(10);
  const [genValue, setGenValue] = useState(100);
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState("");
  const [generatedKeys, setGeneratedKeys] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const router = useRouter();

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: page.toString() });
    if (status) params.set("status", status);

    fetch(`/api/admin/cards?${params}`)
      .then((res) => {
        if (res.status === 401) {
          router.push("/admin/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setCards(data.data);
          setTotal(data.total);
          setTotalPages(data.totalPages);
        }
      })
      .finally(() => setLoading(false));
  }, [page, status, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setGenMsg("");
    setGeneratedKeys([]);

    try {
      const res = await fetch("/api/admin/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: genCount, value: genValue }),
      });
      const data = await res.json();
      if (res.ok) {
        setGenMsg(`成功生成 ${data.count} 个卡密（每张面值 ${data.value} 点）`);
        setGeneratedKeys(data.keys);
        fetchData();
      } else {
        setGenMsg(data.error || "生成失败");
      }
    } catch {
      setGenMsg("网络错误");
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确认删除此卡密？")) return;
    const res = await fetch(`/api/admin/cards/${id}`, { method: "DELETE" });
    if (res.ok) fetchData();
  };

  const copyKeys = () => {
    navigator.clipboard.writeText(generatedKeys.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportKeys = () => {
    const blob = new Blob([generatedKeys.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `keys-${genValue}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">卡密管理</h2>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4" />
            生成卡密
          </CardTitle>
          <CardDescription>每张卡密充值时为用户增加对应面值的点数</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="flex gap-4 items-end flex-wrap">
              <div>
                <Label htmlFor="gen-value">面值（点数）</Label>
                <Input
                  id="gen-value"
                  type="number"
                  min="1"
                  max="1000000"
                  value={genValue}
                  onChange={(e) => setGenValue(parseInt(e.target.value) || 1)}
                  className="w-32 mt-2"
                />
              </div>
              <div>
                <Label htmlFor="gen-count">数量</Label>
                <Input
                  id="gen-count"
                  type="number"
                  min="1"
                  max="500"
                  value={genCount}
                  onChange={(e) => setGenCount(parseInt(e.target.value) || 1)}
                  className="w-24 mt-2"
                />
              </div>
              <Button type="submit" disabled={generating}>
                {generating ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                {generating ? "生成中..." : "生成"}
              </Button>
              {genMsg && (
                <span className={`text-sm ${genMsg.includes("成功") ? "text-green-600" : "text-destructive"}`}>
                  {genMsg}
                </span>
              )}
            </div>
          </form>

          {generatedKeys.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">生成结果</span>
                <Button variant="secondary" size="xs" onClick={copyKeys}>
                  {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                  {copied ? "已复制" : "复制全部"}
                </Button>
                <Button variant="secondary" size="xs" onClick={exportKeys}>
                  <Download className="size-3" />
                  导出 TXT
                </Button>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3 max-h-48 overflow-y-auto font-mono text-xs">
                {generatedKeys.map((k, i) => (
                  <div key={i} className="py-0.5">{k}</div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>卡密列表 ({total})</CardTitle>
            <div className="flex gap-2">
              {([
                { key: "", label: "全部" },
                { key: "unused", label: "未使用" },
                { key: "used", label: "已使用" },
              ] as const).map((s) => (
                <Button
                  key={s.key}
                  variant={status === s.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setStatus(s.key); setPage(1); }}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </div>
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
                    <TableHead>卡密</TableHead>
                    <TableHead>面值</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>使用用户</TableHead>
                    <TableHead>使用时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cards.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.id}</TableCell>
                      <TableCell className="font-mono text-xs">{c.key}</TableCell>
                      <TableCell className="font-semibold">{c.value}</TableCell>
                      <TableCell>
                        {c.is_used ? (
                          <Badge variant="destructive">已使用</Badge>
                        ) : (
                          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">未使用</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{c.used_by_username || "-"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(c.used_at)}
                      </TableCell>
                      <TableCell>
                        <Button variant="destructive" size="xs" onClick={() => handleDelete(c.id)}>
                          <Trash2 className="size-3" />
                          删除
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {cards.length === 0 && (
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
                  <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
                    <ChevronLeft className="size-4" />
                    上一页
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">{page} / {totalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
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
