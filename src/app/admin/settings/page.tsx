"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Megaphone, MessageCircle, Coins } from "lucide-react";

export default function SettingsPage() {
  const [announcement, setAnnouncement] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [accountPrice, setAccountPrice] = useState("100");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => {
        if (res.status === 401) {
          router.push("/admin/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setAnnouncement(data.announcement || "");
          setContactInfo(data.contact_info || "");
          setAccountPrice(data.account_price || "100");
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          announcement,
          contact_info: contactInfo,
          account_price: accountPrice,
        }),
      });

      if (res.ok) {
        setMsg("保存成功");
        setTimeout(() => setMsg(""), 3000);
      } else {
        setMsg("保存失败");
      }
    } catch {
      setMsg("网络错误");
    } finally {
      setSaving(false);
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
      <h2 className="text-xl font-bold">系统设置</h2>

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="size-4" />
              兑换价格
            </CardTitle>
            <CardDescription>用户兑换 1 个账号需要消耗的点数</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="price">每个账号消耗点数</Label>
              <Input
                id="price"
                type="number"
                min="1"
                max="1000000"
                value={accountPrice}
                onChange={(e) => setAccountPrice(e.target.value)}
                className="w-40"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="size-4" />
              公告设置
            </CardTitle>
            <CardDescription>显示在前台首页的公告内容，留空则不显示</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              placeholder="输入公告内容..."
              className="min-h-24"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="size-4" />
              联系方式
            </CardTitle>
            <CardDescription>显示在前台侧栏，用户遇到问题时联系</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="contact">联系方式</Label>
              <Input
                id="contact"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder="例如：Telegram @xxx 或 QQ群 123456"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saving ? "保存中..." : "保存设置"}
          </Button>
          {msg && (
            <span className={`text-sm ${msg.includes("成功") ? "text-green-600" : "text-destructive"}`}>
              {msg}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
