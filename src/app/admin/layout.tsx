"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LayoutDashboard, FileText, KeyRound, Settings, LogOut, Users, History, Shield, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const baseNavItems = [
  { href: "/admin", label: "仪表盘", icon: LayoutDashboard },
  { href: "/admin/credentials", label: "凭证管理", icon: FileText },
  { href: "/admin/cards", label: "卡密管理", icon: KeyRound },
  { href: "/admin/records", label: "提取记录", icon: History },
  { href: "/admin/users", label: "用户管理", icon: Users },
  { href: "/admin/health", label: "健康检查", icon: Activity },
  { href: "/admin/settings", label: "系统设置", icon: Settings },
];

const superadminNavItems = [
  { href: "/admin/admins", label: "子管理员", icon: Shield },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSuperadmin, setIsSuperadmin] = useState(false);

  useEffect(() => {
    // Check admin role via a lightweight API call
    fetch("/api/admin/stats")
      .then((res) => {
        if (res.status === 401 && pathname !== "/admin/login") {
          router.push("/admin/login");
        }
        return res;
      })
      .catch(() => {});

    // Check if current admin is superadmin
    fetch("/api/admin/admins")
      .then((res) => {
        if (res.ok) setIsSuperadmin(true);
        // 403 means not superadmin, which is fine
      })
      .catch(() => {});
  }, [pathname, router]);

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  };

  const navItems = isSuperadmin
    ? [...baseNavItems, ...superadminNavItems]
    : baseNavItems;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-60 flex flex-col shrink-0 border-r border-border bg-card">
        <div className="p-5">
          <h1 className="text-lg font-bold">管理后台</h1>
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

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
