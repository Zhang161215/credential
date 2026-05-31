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
import { Loader2, Trash2, Pencil, UserPlus, Copy, Check } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface AdminRow {
  id: number;
  username: string;
  role: string;
  slug: string | null;
  display_name: string | null;
  created_at: string | null;
  created_by_username: string | null;
}

export default function AdminsPage() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState("");
  const [createdSlug, setCreatedSlug] = useState("");

  // Edit
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const router = useRouter();

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/admins")
      .then((res) => {
        if (res.status === 401) {
          router.push("/admin/login");
          return null;
        }
        if (res.status === 403) return null;
        return res.json();
      })
      .then((data) => {
        if (data?.data) setAdmins(data.data);
      })
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateMsg("");
    setCreatedSlug("");
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          display_name: newDisplayName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCreateMsg(`创建成功！后台地址后缀: ${data.slug}`);
        setCreatedSlug(data.slug);
        setNewUsername("");
        setNewPassword("");
        setNewDisplayName("");
        fetchData();
      } else {
        setCreateMsg(data.error || "创建失败");
      }
    } catch {
      setCreateMsg("网络错误");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确认删除此管理员？其关联的凭证和卡密不会被删除。")) return;
    const res = await fetch(`/api/admin/admins/${id}`, { method: "DELETE" });
    if (res.ok) fetchData();
  };

  const startEdit = (a: AdminRow) => {
    setEditingId(a.id);
    setEditPassword("");
    setEditDisplayName(a.display_name || "");
  };

  const handleSave = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (editPassword) body.password = editPassword;
      if (editDisplayName !== undefined) body.display_name = editDisplayName;

      const res = await fetch(`/api/admin/admins/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setEditingId(null);
        fetchData();
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const copySlug = (slug: string) => {
    const url = `${window.location.origin}/panel/${slug}/login`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">子管理员管理</h2>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="size-4" />
            创建子管理员
          </CardTitle>
          <CardDescription>
            创建后会生成随机后缀，子管理员通过 /panel/后缀/login 登录独立后台
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="flex gap-4 items-end flex-wrap">
              <div>
                <Label htmlFor="new-username">用户名</Label>
                <Input
                  id="new-username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="3-32 位"
                  className="w-40 mt-2"
                />
              </div>
              <div>
                <Label htmlFor="new-password">密码</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="至少 6 位"
                  className="w-40 mt-2"
                />
              </div>
              <div>
                <Label htmlFor="new-display">显示名</Label>
                <Input
                  id="new-display"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="可选"
                  className="w-32 mt-2"
                />
              </div>
              <Button type="submit" disabled={creating || !newUsername.trim() || !newPassword}>
                {creating ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                {creating ? "创建中..." : "创建"}
              </Button>
            </div>
            {createMsg && (
              <div className={`text-sm ${createdSlug ? "text-green-600" : "text-destructive"}`}>
                {createMsg}
                {createdSlug && (
                  <span className="ml-2">
                    前台地址: /s/{createdSlug} | 后台: /panel/{createdSlug}/login
                  </span>
                )}
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>管理员列表</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="size-4 animate-spin" />
              加载中...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>用户名</TableHead>
                  <TableHead>显示名</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>后缀</TableHead>
                  <TableHead>创建者</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.id}</TableCell>
                    <TableCell className="font-medium">{a.username}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {editingId === a.id ? (
                        <Input
                          value={editDisplayName}
                          onChange={(e) => setEditDisplayName(e.target.value)}
                          className="w-24 h-7 text-xs"
                        />
                      ) : (
                        a.display_name || "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {a.role === "superadmin" ? (
                        <Badge>超级管理员</Badge>
                      ) : (
                        <Badge variant="secondary">子管理员</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {a.slug ? (
                        <span className="flex items-center gap-1">
                          <code className="text-xs bg-muted px-1 py-0.5 rounded">{a.slug}</code>
                          <button
                            type="button"
                            onClick={() => copySlug(a.slug!)}
                            className="text-muted-foreground hover:text-foreground"
                            title="复制面板链接"
                          >
                            {copiedSlug === a.slug ? (
                              <Check className="size-3 text-green-600" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </button>
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {a.created_by_username || "-"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(a.created_at)}
                    </TableCell>
                    <TableCell>
                      {a.role !== "superadmin" && (
                        <div className="flex gap-1">
                          {editingId === a.id ? (
                            <>
                              <Input
                                type="password"
                                placeholder="新密码(可选)"
                                value={editPassword}
                                onChange={(e) => setEditPassword(e.target.value)}
                                className="w-28 h-7 text-xs"
                              />
                              <Button size="xs" onClick={handleSave} disabled={saving}>
                                {saving ? <Loader2 className="size-3 animate-spin" /> : "保存"}
                              </Button>
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => setEditingId(null)}
                              >
                                取消
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => startEdit(a)}
                              >
                                <Pencil className="size-3" />
                                编辑
                              </Button>
                              <Button
                                variant="destructive"
                                size="xs"
                                onClick={() => handleDelete(a.id)}
                              >
                                <Trash2 className="size-3" />
                                删除
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {admins.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      暂无数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
