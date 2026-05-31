"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  Loader2, Upload, CloudUpload, Trash2, ChevronLeft, ChevronRight,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface Credential {
  id: number;
  filename: string;
  is_redeemed: number;
  redeemed_at: string | null;
  redeemed_by_user_id: number | null;
  redeemed_by_username: string | null;
  created_at: string;
}

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState<"" | "available" | "redeemed">("");
  const [loading, setLoading] = useState(true);

  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const fetchData = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams({ page: page.toString() });
    if (status) qs.set("status", status);

    fetch(`/api/admin/credentials?${qs}`)
      .then((res) => {
        if (res.status === 401) {
          router.push(`/panel/${slug}/login`);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setCredentials(data.data);
          setTotal(data.total);
          setTotalPages(data.totalPages);
        }
      })
      .finally(() => setLoading(false));
  }, [page, status, router, slug]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files?.length) return;
    setUploading(true);
    setUploadMsg("");

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }

    try {
      const res = await fetch("/api/admin/credentials", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        const invalidNote = data.invalid > 0 ? `（跳过 ${data.invalid} 个无效 JSON）` : "";
        setUploadMsg(`成功上传 ${data.count} 个凭证${invalidNote}`);
        setFiles(null);
        const input = document.getElementById("file-input") as HTMLInputElement;
        if (input) input.value = "";
        fetchData();
      } else {
        setUploadMsg(data.error || "上传失败");
      }
    } catch {
      setUploadMsg("网络错误");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确认删除此凭证？")) return;
    const res = await fetch(`/api/admin/credentials/${id}`, { method: "DELETE" });
    if (res.ok) fetchData();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      setFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">凭证管理</h2>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="size-4" />
            批量上传凭证
          </CardTitle>
          <CardDescription>上传 JSON 格式的账号凭证文件</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="space-y-4">
            <div
              className={`rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <CloudUpload className="size-10 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">
                {files ? `已选择 ${files.length} 个文件` : "拖拽 JSON 文件到此处，或点击选择"}
              </p>
              <input
                id="file-input"
                type="file"
                multiple
                accept=".json"
                className="hidden"
                onChange={(e) => setFiles(e.target.files)}
              />
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={uploading || !files?.length}>
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                {uploading ? "上传中..." : "上传"}
              </Button>
              {uploadMsg && (
                <span className={`text-sm ${uploadMsg.includes("成功") ? "text-green-600" : "text-destructive"}`}>
                  {uploadMsg}
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>凭证列表 ({total})</CardTitle>
            <div className="flex gap-2">
              {([
                { key: "", label: "全部" },
                { key: "available", label: "未兑换" },
                { key: "redeemed", label: "已兑换" },
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
                    <TableHead>文件名</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>兑换用户</TableHead>
                    <TableHead>兑换时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {credentials.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.id}</TableCell>
                      <TableCell className="font-mono text-xs">{c.filename}</TableCell>
                      <TableCell>
                        {c.is_redeemed ? (
                          <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">已兑换</Badge>
                        ) : (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">待兑换</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{c.redeemed_by_username || "-"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(c.redeemed_at)}
                      </TableCell>
                      <TableCell>
                        <Button variant="destructive" size="xs" onClick={() => handleDelete(c.id)}>
                          <Trash2 className="size-3" />
                          删除
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {credentials.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
