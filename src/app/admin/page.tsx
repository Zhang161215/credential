"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2, FileText, KeyRound, CheckCircle2, Boxes, Users, Wallet, ShoppingCart, Coins,
  HeartPulse, AlertTriangle, XCircle, HelpCircle,
} from "lucide-react";

interface Stats {
  totalCredentials: number;
  availableCredentials: number;
  redeemedCredentials: number;
  totalCards: number;
  usedCards: number;
  unusedCards: number;
  totalCardValue: number;
  usedCardValue: number;
  totalUsers: number;
  totalRecharged: number;
  totalRedeemed: number;
  totalBalance: number;
  health: {
    healthy: number;
    unhealthy: number;
    expired: number;
    unknown: number;
  };
}

const statConfig = [
  { key: "availableCredentials", label: "待兑换库存", icon: Boxes, color: "text-emerald-600" },
  { key: "redeemedCredentials", label: "已兑换账号", icon: CheckCircle2, color: "text-blue-600" },
  { key: "totalCredentials", label: "凭证总数", icon: FileText, color: "text-neutral-700" },
  { key: "totalUsers", label: "用户总数", icon: Users, color: "text-purple-600" },
  { key: "totalRecharged", label: "总充值点数", icon: Coins, color: "text-amber-600" },
  { key: "totalRedeemed", label: "总兑换次数", icon: ShoppingCart, color: "text-orange-600" },
  { key: "totalBalance", label: "用户余额合计", icon: Wallet, color: "text-cyan-700" },
  { key: "totalCards", label: "卡密总数", icon: KeyRound, color: "text-rose-600" },
] as const;

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((res) => {
        if (res.status === 401) {
          router.push("/admin/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setStats(data);
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        加载中...
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">仪表盘</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statConfig.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Icon className={`size-4 ${item.color}`} />
                  {item.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${item.color}`}>
                  {stats[item.key]}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <h3 className="text-lg font-semibold">凭证健康状态</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "健康", value: stats.health.healthy, icon: HeartPulse, color: "text-green-600" },
          { label: "异常", value: stats.health.unhealthy, icon: AlertTriangle, color: "text-orange-600" },
          { label: "过期", value: stats.health.expired, icon: XCircle, color: "text-red-600" },
          { label: "未检测", value: stats.health.unknown, icon: HelpCircle, color: "text-gray-500" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Icon className={`size-4 ${item.color}`} />
                  {item.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <h3 className="text-lg font-semibold">卡密资金流</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "卡密面值合计", value: stats.totalCardValue },
          { label: "已使用卡密面值", value: stats.usedCardValue },
          { label: "未使用卡密", value: stats.unusedCards },
          { label: "已使用卡密", value: stats.usedCards },
        ].map((item) => (
          <Card key={item.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {item.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
