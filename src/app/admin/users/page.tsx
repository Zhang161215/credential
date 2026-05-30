"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  Loader2, ChevronLeft, ChevronRight, Search, Wallet, Plus, Minus,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface User {
  id: number;
  username: string;
  balance: number;
  created_at: string;
  last_login_at: string | null;
  last_login_ip: string | null;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [adjusting, setAdjusting] = useState<number | null>(null);

  const router = useRouter();

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: page.toString() });
    if (search) params.set("q", search);

    fetch(`/api/admin/users?${params}`)
      .then((res) => {
        if (res.status === 401) {
          router.push("/admin/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setUsers(data.data);
          setTotal(data.total);
          setTotalPages(data.totalPages);
        }
      })
      .finally(() => setLoading(false));
  }, [page, search, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdjust = async (user: User, sign: 1 | -1) => {
    const input = prompt(
      `${sign > 0 ? "增加" : "扣减"} ${user.username} 的余额（当前 ${user.balance} 点）\n请输入数量：`,
      "100"
    );
    if (!input) return;
    const amount = parseInt(input);
    if (!amount || amount <= 0) {
      alert("请输入正整数");
      return;
    }

    setAdjusting(user.id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, delta: sign * amount }),
      });
      const data = await res.json();
      if (res.ok) {
        fetchData();
      } else {
        alert(data.error || "调整失败");
      }
    } finally {
      setAdjusting(null);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">用户管理</h2>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle>用户列表 ({total})</CardTitle>
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <Input
                placeholder="按用户名搜索"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-48"
              />
              <Button type="submit" variant="outline" size="sm">
                <Search className="size-4" />
                搜索
              </Button>
            </form>
          </div>
          <CardDescription>查看所有注册用户，可手动调整余额</CardDescription>
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
                    <TableHead>余额</TableHead>
                    <TableHead>注册时间</TableHead>
                    <TableHead>最后登录</TableHead>
                    <TableHead>登录 IP</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>{u.id}</TableCell>
                      <TableCell className="font-mono text-xs">{u.username}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <Wallet className="size-3.5 text-cyan-700" />
                          {u.balance}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(u.created_at)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(u.last_login_at)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{u.last_login_ip || "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => handleAdjust(u, 1)}
                            disabled={adjusting === u.id}
                          >
                            <Plus className="size-3" />
                            加点
                          </Button>
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => handleAdjust(u, -1)}
                            disabled={adjusting === u.id}
                          >
                            <Minus className="size-3" />
                            扣点
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        暂无用户
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
