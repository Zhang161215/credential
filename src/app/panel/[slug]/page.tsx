"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface Stats {
  totalCredentials: number;
  availableCredentials: number;
  redeemedCredentials: number;
  totalCards: number;
  usedCards: number;
  unusedCards: number;
  totalCardValue: number;
  usedCardValue: number;
  totalRedeemed: number;
}

export default function PanelDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((res) => {
        if (res.status === 401) {
          router.push("login");
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
      <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
        <Loader2 className="size-4 animate-spin" />
        加载中...
      </div>
    );
  }

  if (!stats) return null;

  const items = [
    { label: "凭证总数", value: stats.totalCredentials },
    { label: "可用凭证", value: stats.availableCredentials },
    { label: "已兑换", value: stats.redeemedCredentials },
    { label: "卡密总数", value: stats.totalCards },
    { label: "已用卡密", value: stats.usedCards },
    { label: "未用卡密", value: stats.unusedCards },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">仪表盘</h2>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
        {items.map((item) => (
          <Card key={item.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{item.label}</CardTitle>
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
