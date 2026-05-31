"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LayoutDashboard, FileText, KeyRound, Settings, LogOut, History } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PanelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const pathname = usePathname();
  const router = useRouter();
  const [verified, setVerified] = useState(false);

  const basePath = `/panel/${slug}`;

  const navItems = [
    { href: basePath, label: "仪表盘", icon: LayoutDashboard },
    { href: `${basePath}/credentials`, label: "凭证管理", icon: FileText },
    { href: `${basePath}/cards`, label: "卡密管理", icon: KeyRound },
    { href: `${basePath}/records`, label: "提取记录", icon: History },
    { href: `${basePath}/settings`, label: "系统设置", icon: Settings },
  ];

  useEffect(() => {
    if (pathname === `${basePath}/login`) {
      setVerified(true);
      return;
    }
    // Verify auth
    fetch("/api/admin/stats")
      .then((res) => {
        if (res.status === 401) {
          router.push(`${basePath}/login`);
        } else {
          setVerified(true);
        }
      })
      .catch(() => router.push(`${basePath}/login`));
  }, [pathname, basePath, router]);

  if (pathname === `${basePath}/login`) {
    return <>{children}</>;
  }

  if (!verified) return null;

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push(`${basePath}/login`);
  };

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 flex flex-col shrink-0 border-r border-border bg-card">
        <div className="p-5">
          <h1 className="text-lg font-bold">管理面板</h1>
          <p className="text-xs text-muted-foreground mt-1">ID: {slug}</p>
        </div>
        <Separator />

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  className={cn("w-full justify-start gap-3")}
                  size="lg"
                >
                  <Icon className="size-4" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>

        <Separator />
        <div className="p-3">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-destructive hover:text-destructive"
            size="lg"
            onClick={handleLogout}
          >
            <LogOut className="size-4" />
            退出登录
          </Button>
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
