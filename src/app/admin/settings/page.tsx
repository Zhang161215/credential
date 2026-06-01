"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Megaphone, MessageCircle, Coins, Activity } from "lucide-react";

const ICON_OPTIONS = [
  { value: "qq", label: "QQ" },
  { value: "telegram", label: "Telegram" },
  { value: "wechat", label: "微信" },
];

export default function SettingsPage() {
  const [announcement, setAnnouncement] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [contactIcon, setContactIcon] = useState("qq");
  const [accountPrice, setAccountPrice] = useState("100");
  const [healthCheckInterval, setHealthCheckInterval] = useState("30");
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
          setContactIcon(data.contact_icon || "qq");
          setAccountPrice(data.account_price || "100");
          setHealthCheckInterval(data.health_check_interval || "30");
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
          contact_icon: contactIcon,
          account_price: accountPrice,
          health_check_interval: healthCheckInterval,
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
              <Activity className="size-4" />
              自动健康检测
            </CardTitle>
            <CardDescription>定时自动检测凭证健康状态，设为 0 则关闭自动检测</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="health-interval">检测间隔（分钟）</Label>
              <Input
                id="health-interval"
                type="number"
                min="0"
                max="1440"
                value={healthCheckInterval}
                onChange={(e) => setHealthCheckInterval(e.target.value)}
                className="w-40"
              />
              <p className="text-xs text-muted-foreground">
                建议 30-60 分钟，设为 0 关闭自动检测。每次自动检测最多抽样 10 个凭证。
              </p>
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
            <CardDescription>显示在前台侧栏，用户遇到问题时联系。以 @ 开头自动生成 Telegram 链接，以 http 开头自动生成可点击链接</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>图标样式</Label>
              <div className="flex gap-2">
                {ICON_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setContactIcon(opt.value)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      contactIcon === opt.value
                        ? "bg-neutral-900 text-white border-neutral-900"
                        : "bg-white text-neutral-600 border-border hover:border-neutral-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact">联系方式内容</Label>
              <Input
                id="contact"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder="例如：@username 或 QQ群 123456 或 https://..."
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
