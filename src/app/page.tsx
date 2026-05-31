"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  KeyRound, Download, AlertCircle, CheckCircle2, Megaphone, MessageCircle,
  Loader2, LogOut, RefreshCw, Coins, History, BookOpenText,
  Package,
} from "lucide-react";

interface MeData {
  id: number;
  username: string;
  balance: number;
}

interface PublicSettings {
  announcement: string;
  contact_info: string;
  contact_icon: string;
  account_price: string;
}

interface PublicStats {
  inventory: number;
  recent5min: number;
  recent_redeems?: RedeemActivity[];
}

interface RedeemActivity {
  id: number;
  username: string;
  count: number;
  created_at: string;
}

interface Transaction {
  id: number;
  type: "recharge" | "redeem" | "admin_adjust";
  amount: number;
  count: number;
  balance_after: number;
  related_card_key: string | null;
  related_credential_id: number | null;
  related_credential_ids: string | null;
  credential_filename: string | null;
  created_at: string;
}

const CARD_BASE =
  "rounded-[18px] border border-[var(--line)] bg-white/90 backdrop-blur-[14px] shadow-[0_20px_60px_rgba(15,23,42,0.06)]";
const FIELD_CARD =
  "grid gap-2 rounded-[14px] border border-[var(--line)] p-3 bg-gradient-to-b from-neutral-500/[0.035] to-neutral-500/[0.015]";
const SEG_WRAP =
  "inline-flex rounded-[10px] border border-[var(--line)] bg-neutral-100 p-1 gap-1";
const SEG_ACTIVE =
  "bg-white text-neutral-900 shadow-sm";
const SEG_INACTIVE =
  "text-neutral-500 hover:text-neutral-900";
const PRIMARY_BTN =
  "bg-neutral-900 text-white hover:bg-neutral-800 rounded-[12px] h-10 px-4";

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatTime(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso + "Z").toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
}

function fuzzyInventory(n: number): string {
  if (n <= 0) return "暂无库存";
  if (n < 10) return "少于 10";
  if (n < 50) return "少于 50";
  if (n < 100) return "少于 100";
  if (n < 500) return "大于 100";
  if (n < 1000) return "大于 500";
  if (n < 5000) return "大于 1000";
  return "大于 5000";
}

export default function HomePage({ slug }: { slug?: string }) {
  const [me, setMe] = useState<MeData | null>(null);
  const [meLoading, setMeLoading] = useState(true);

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authShowPwd, setAuthShowPwd] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const [workMode, setWorkMode] = useState<"recharge" | "redeem">("recharge");
  const [cardKey, setCardKey] = useState("");
  const [rechargeLoading, setRechargeLoading] = useState(false);
  const [rechargeMsg, setRechargeMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [redeemCount, setRedeemCount] = useState(1);

  const [settings, setSettings] = useState<PublicSettings>({
    announcement: "",
    contact_info: "",
    contact_icon: "qq",
    account_price: "100",
  });
  const [stats, setStats] = useState<PublicStats>({ inventory: 0, recent5min: 0 });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const lastSeenRedeemId = useRef<number | null>(null);
  const isFirstStatsLoad = useRef(true);

  const slugParam = slug ? `?slug=${slug}` : "";

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setMe({ id: data.id, username: data.username, balance: data.balance });
      } else {
        setMe(null);
      }
    } catch {
      setMe(null);
    } finally {
      setMeLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      setSettings({
        announcement: data.announcement || "",
        contact_info: data.contact_info || "",
        contact_icon: data.contact_icon || "qq",
        account_price: data.account_price || "100",
      });
    } catch {}
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/stats${slugParam}`);
      const data = await res.json();
      const recents: RedeemActivity[] = Array.isArray(data.recent_redeems)
        ? data.recent_redeems
        : [];

      setStats({
        inventory: data.inventory ?? 0,
        recent5min: data.recent5min ?? 0,
        recent_redeems: recents,
      });

      // 初次加载只记录 lastSeenId，不弹窗（防止打开页面瞬间刷屏）
      if (isFirstStatsLoad.current) {
        isFirstStatsLoad.current = false;
        if (recents.length > 0) {
          lastSeenRedeemId.current = recents[0].id;
        }
        return;
      }

      // 找出 id > lastSeen 的新条目，按时间正序逐条弹
      const lastId = lastSeenRedeemId.current ?? 0;
      const fresh = recents
        .filter((r) => r.id > lastId)
        .sort((a, b) => a.id - b.id);

      for (const r of fresh) {
        toast.info(`${r.username} 刚刚提取了 ${r.count} 个账号`, {
          description: "实时活动",
          duration: 3500,
        });
      }
      if (recents.length > 0) {
        lastSeenRedeemId.current = recents[0].id;
      }
    } catch {}
  }, [slugParam]);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch("/api/transactions?page=1");
      if (!res.ok) return;
      const data = await res.json();
      setTransactions((data.data || []).slice(0, 10));
    } catch {}
  }, []);

  useEffect(() => {
    fetchMe();
    fetchSettings();
    fetchStats();
    const t = setInterval(fetchStats, 5000);
    return () => clearInterval(t);
  }, [fetchMe, fetchSettings, fetchStats]);

  useEffect(() => {
    if (me) fetchTransactions();
  }, [me, fetchTransactions]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const path = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: authUsername.trim(), password: authPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || "操作失败");
        return;
      }
      setAuthUsername("");
      setAuthPassword("");
      await fetchMe();
    } catch {
      setAuthError("网络错误");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe(null);
    setTransactions([]);
  };

  const handleRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardKey.trim()) return;
    setRechargeMsg(null);
    setRechargeLoading(true);
    try {
      // Parse multiple keys from textarea (one per line)
      const keys = [...new Set(
        cardKey.split("\n").map((k) => k.trim().toUpperCase()).filter(Boolean)
      )];

      if (keys.length === 0) return;

      const isBatch = keys.length > 1;
      const res = await fetch("/api/recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isBatch ? { keys } : { key: keys[0] }),
      });
      const data = await res.json();

      if (isBatch) {
        // Batch response
        if (data.successCount > 0) {
          const failCount = keys.length - data.successCount;
          let text = `成功 ${data.successCount} 个（+${data.totalValue} 点）`;
          if (failCount > 0) text += `，失败 ${failCount} 个`;
          text += `，当前余额 ${data.balance} 点`;
          setRechargeMsg({ type: "ok", text });
          if (me) setMe({ ...me, balance: data.balance });
        } else {
          setRechargeMsg({ type: "err", text: "全部充值失败，请检查卡密" });
        }
      } else {
        // Single key response
        if (!res.ok) {
          setRechargeMsg({ type: "err", text: data.error || "充值失败" });
          return;
        }
        setRechargeMsg({
          type: "ok",
          text: `充值成功 +${data.value} 点，当前余额 ${data.balance} 点`,
        });
        if (me) setMe({ ...me, balance: data.balance });
      }

      setCardKey("");
      fetchTransactions();
      fetchStats();
    } catch {
      setRechargeMsg({ type: "err", text: "网络错误" });
    } finally {
      setRechargeLoading(false);
    }
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setRedeemMsg(null);
    setRedeemLoading(true);
    try {
      const n = Math.max(1, Math.min(50, Math.floor(redeemCount) || 1));

      if (n === 1) {
        const res = await fetch(`/api/redeem${slugParam}`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
          setRedeemMsg({ type: "err", text: data.error || "兑换失败" });
          return;
        }
        downloadFile(data.filename, data.content);
        setRedeemMsg({
          type: "ok",
          text: `兑换成功，已下载 ${data.filename}，余额 ${data.balance} 点`,
        });
        if (me) setMe({ ...me, balance: data.balance });
      } else {
        const res = await fetch(`/api/redeem/batch${slugParam}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ count: n }),
        });
        if (!res.ok) {
          let err = "批量兑换失败";
          try {
            const data = await res.json();
            err = data.error || err;
          } catch {}
          setRedeemMsg({ type: "err", text: err });
          return;
        }
        const blob = await res.blob();
        const headerName = res.headers.get("X-Filename");
        const filename = headerName
          ? decodeURIComponent(headerName)
          : `accounts-${n}.zip`;
        const balanceAfter = res.headers.get("X-Balance-After");
        const totalCost = res.headers.get("X-Total-Cost");
        const count = res.headers.get("X-Count");

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setRedeemMsg({
          type: "ok",
          text: `批量兑换成功 ${count} 个，已打包下载 ${filename}，扣 ${totalCost} 点，余额 ${balanceAfter} 点`,
        });
        if (me && balanceAfter !== null) setMe({ ...me, balance: parseInt(balanceAfter) });
      }

      fetchTransactions();
      fetchStats();
    } catch {
      setRedeemMsg({ type: "err", text: "网络错误" });
    } finally {
      setRedeemLoading(false);
    }
  };

  const accountPrice = parseInt(settings.account_price) || 100;
  const safeCount = Math.max(1, Math.min(50, Math.floor(redeemCount) || 1));
  const totalCost = accountPrice * safeCount;
  const canAfford = !!me && me.balance >= totalCost;
  const enoughStock = stats.inventory >= safeCount;

  return (
    <main className="min-h-screen px-4 py-5 md:px-6 md:py-7">
      <div className="mx-auto w-full max-w-[1120px] space-y-5">
        {/* 顶部 header：logo + 标题 + 副标题 + 库存胶囊 + 用户信息 */}
        <header className={`${CARD_BASE} px-4 md:px-6 py-3.5 flex items-center gap-4 flex-wrap`}>
          {/* 左：logo + 标题块 */}
          <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
            <div className="inline-flex items-center justify-center size-11 rounded-xl overflow-hidden ring-1 ring-white/40 shadow-[0_8px_24px_rgba(124,58,237,0.28)] bg-neutral-900 shrink-0">
              <Image
                src="/logo.png"
                alt="账号兑换工作台"
                width={88}
                height={88}
                priority
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-[17px] font-bold tracking-[-0.01em] leading-tight">
                账号兑换工作台
              </h1>
              <p className="text-[11px] text-neutral-500 leading-tight mt-0.5 hidden md:block whitespace-nowrap">
                卡密充值点数 · 点数兑换 JSON 账号 · 批量打包下载
              </p>
            </div>
          </div>

          {/* 中：库存胶囊（占满中间空间） */}
          <div className="flex-1 min-w-[180px] flex items-center justify-end md:justify-center gap-3 text-[12px]">
            <span className="flex items-center gap-1.5">
              <span
                className={`inline-block size-2 rounded-full ${
                  me && stats.inventory > 0
                    ? "bg-emerald-500 animate-pulse"
                    : "bg-neutral-300"
                }`}
              />
              <span className="text-neutral-500">库存</span>
              <span className="font-medium text-neutral-900">
                {!me ? "登录后可见" : fuzzyInventory(stats.inventory)}
              </span>
            </span>
            <span className="h-3 w-px bg-[var(--line)]" />
            <span className="flex items-center gap-1">
              <span className="text-neutral-500">5 分钟提取</span>
              <span className="font-medium text-blue-600">{stats.recent5min}</span>
              <span className="text-neutral-500">个</span>
            </span>
            <button
              type="button"
              onClick={fetchStats}
              className="inline-flex size-6 items-center justify-center rounded-full text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100"
              title="刷新"
            >
              <RefreshCw className="size-3" />
            </button>
          </div>

          {/* 右：用户信息（仅登录态） */}
          {me && (
            <div className="flex items-center gap-2 shrink-0 pl-3 border-l border-[var(--line)]">
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-neutral-900 text-white text-[12px] font-semibold">
                {me.username.slice(0, 1).toUpperCase()}
              </span>
              <div className="text-right">
                <p className="text-[12px] font-semibold leading-tight max-w-[100px] truncate">
                  {me.username}
                </p>
                <p className="text-[11px] text-neutral-500 leading-tight">
                  余额 <span className="font-bold text-neutral-900">{me.balance}</span> 点
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="退出登录"
                className="inline-flex size-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
              >
                <LogOut className="size-3.5" />
              </button>
            </div>
          )}
        </header>

        {/* 左右分栏 */}
        <div className="grid gap-5 md:grid-cols-[1.6fr_1fr]">
          {/* === 左侧主区 === */}
          <div className="space-y-5">

        {/* 公告横幅 - 始终显示在主卡片上方（如果有公告） */}
        {settings.announcement && (
          <div className="rounded-[16px] border border-purple-200 bg-gradient-to-r from-purple-50 via-purple-50/80 to-fuchsia-50 px-5 py-4 flex items-start gap-3">
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-purple-100 text-purple-600 shrink-0 animate-pulse">
              <Megaphone className="size-4" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] uppercase tracking-[0.16em] text-purple-700 font-semibold">
                公告
              </p>
              <p className="mt-1 text-[14px] text-neutral-700 whitespace-pre-wrap leading-relaxed break-words">
                {settings.announcement}
              </p>
            </div>
          </div>
        )}

        {/* 主卡片 */}
        <section
          className={`${CARD_BASE} space-y-5 ${
            me ? "p-7 md:p-9" : "p-6 md:p-7"
          }`}
        >
          {meLoading ? (
            <div className="flex items-center gap-2 text-neutral-500 py-12 justify-center">
              <Loader2 className="size-4 animate-spin" />
              加载中...
            </div>
          ) : !me ? (
            <>
              <div className={SEG_WRAP + " self-center mx-auto flex"}>
                <button
                  type="button"
                  onClick={() => { setAuthMode("login"); setAuthError(""); }}
                  className={`px-5 h-9 rounded-[8px] text-sm font-medium transition-colors ${
                    authMode === "login" ? SEG_ACTIVE : SEG_INACTIVE
                  }`}
                >
                  已有账号 · 登录
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMode("register"); setAuthError(""); }}
                  className={`px-5 h-9 rounded-[8px] text-sm font-medium transition-colors ${
                    authMode === "register" ? SEG_ACTIVE : SEG_INACTIVE
                  }`}
                >
                  新用户 · 注册
                </button>
              </div>

              <form onSubmit={handleAuth} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-neutral-700">用户名</label>
                  <Input
                    value={authUsername}
                    onChange={(e) => setAuthUsername(e.target.value)}
                    placeholder="3-32 字符 · 字母数字下划线"
                    className="h-11 rounded-[12px]"
                    autoComplete="username"
                    disabled={authLoading}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[12px] font-medium text-neutral-700">密码</label>
                    <label className="inline-flex items-center gap-1 text-[11px] text-neutral-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={authShowPwd}
                        onChange={(e) => setAuthShowPwd(e.target.checked)}
                        className="size-3 accent-neutral-900"
                      />
                      显示密码
                    </label>
                  </div>
                  <Input
                    type={authShowPwd ? "text" : "password"}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder={authMode === "register" ? "至少 6 位" : "请输入密码"}
                    className="h-11 rounded-[12px]"
                    autoComplete={authMode === "register" ? "new-password" : "current-password"}
                    disabled={authLoading}
                  />
                </div>

                {authError && (
                  <div className="flex items-center gap-2 rounded-[10px] border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-700">
                    <AlertCircle className="size-4 shrink-0" />
                    {authError}
                  </div>
                )}

                <Button
                  type="submit"
                  className={`${PRIMARY_BTN} w-full h-11`}
                  disabled={authLoading || !authUsername.trim() || !authPassword}
                >
                  {authLoading ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                  {authLoading
                    ? (authMode === "login" ? "登录中..." : "注册中...")
                    : (authMode === "login" ? "登录" : "立即注册")}
                </Button>
              </form>

              {/* 操作流程引导 - 仅未登录时展示 */}
              <div className="pt-3 border-t border-[var(--line)]">
                <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 text-center mb-3">
                  操作流程
                </p>
                <ol className="grid grid-cols-3 gap-2.5">
                  {[
                    { n: 1, t: "注册账号", d: "几秒钟搞定", icon: KeyRound },
                    { n: 2, t: "卡密充值", d: "兑换为点数", icon: Coins },
                    { n: 3, t: "兑换下载", d: "JSON 直发或 ZIP", icon: Download },
                  ].map((s) => {
                    const Icon = s.icon;
                    return (
                      <li
                        key={s.n}
                        className="rounded-[12px] border border-[var(--line)] bg-neutral-50/50 p-3 text-center"
                      >
                        <div className="inline-flex size-8 items-center justify-center rounded-full bg-white border border-[var(--line)] text-neutral-700 mb-2">
                          <Icon className="size-3.5" />
                        </div>
                        <p className="text-[13px] font-semibold leading-tight">{s.t}</p>
                        <p className="text-[11px] text-neutral-500 mt-0.5">{s.d}</p>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </>
          ) : (
            <>
              {/* 模式切换 - 大按钮形式 */}
              <div className="grid grid-cols-2 gap-2 p-1.5 rounded-[14px] border border-[var(--line)] bg-neutral-50">
                <button
                  type="button"
                  onClick={() => setWorkMode("recharge")}
                  className={`h-14 rounded-[10px] text-[15px] font-medium transition-all flex items-center justify-center gap-2 ${
                    workMode === "recharge"
                      ? "bg-white shadow-sm text-neutral-900"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  <Coins className="size-[18px]" />
                  充值点数
                </button>
                <button
                  type="button"
                  onClick={() => setWorkMode("redeem")}
                  className={`h-14 rounded-[10px] text-[15px] font-medium transition-all flex items-center justify-center gap-2 ${
                    workMode === "redeem"
                      ? "bg-white shadow-sm text-neutral-900"
                      : "text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  <Download className="size-[18px]" />
                  兑换账号
                </button>
              </div>

              {workMode === "recharge" ? (
                <form onSubmit={handleRecharge} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[13px] font-medium text-neutral-700">
                      卡密
                    </label>
                    <Textarea
                      value={cardKey}
                      onChange={(e) => setCardKey(e.target.value.toUpperCase())}
                      placeholder={"TEAM-XXXX-XXXX-XXXX\n支持多个卡密，每行一个"}
                      className="font-mono tracking-wider rounded-[12px] min-h-24 text-[15px]"
                      disabled={rechargeLoading}
                    />
                    <p className="text-[12px] text-neutral-500">
                      输入有效卡密，面值会自动加到余额
                    </p>
                  </div>

                  {rechargeMsg && (
                    <div
                      className={`flex items-center gap-2 rounded-[10px] border px-3 py-2.5 text-[14px] ${
                        rechargeMsg.type === "ok"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-orange-200 bg-orange-50 text-orange-700"
                      }`}
                    >
                      {rechargeMsg.type === "ok" ? (
                        <CheckCircle2 className="size-4 shrink-0" />
                      ) : (
                        <AlertCircle className="size-4 shrink-0" />
                      )}
                      {rechargeMsg.text}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className={`${PRIMARY_BTN} w-full h-12 text-[15px]`}
                    disabled={rechargeLoading || !cardKey.trim()}
                  >
                    {rechargeLoading ? <Loader2 className="size-4 animate-spin" /> : <Coins className="size-[18px]" />}
                    {rechargeLoading ? "充值中..." : "充值到账户"}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleRedeem} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[13px] font-medium text-neutral-700">
                      兑换数量
                      <span className="ml-1.5 text-neutral-400">最多 50</span>
                    </label>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        value={redeemCount}
                        onChange={(e) => {
                          const v = parseInt(e.target.value);
                          setRedeemCount(Number.isFinite(v) ? v : 1);
                        }}
                        className="h-12 rounded-[12px] w-28 text-center text-[15px]"
                        disabled={redeemLoading}
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {[1, 5, 10, 20, 50].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setRedeemCount(n)}
                            disabled={redeemLoading}
                            className={`px-3.5 h-9 rounded-[8px] text-[13px] font-medium border transition-colors ${
                              safeCount === n
                                ? "bg-neutral-900 text-white border-neutral-900"
                                : "bg-white text-neutral-600 border-[var(--line)] hover:border-neutral-400"
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 消耗概览 */}
                  <div className="rounded-[12px] bg-gradient-to-br from-neutral-50 to-neutral-100 border border-[var(--line)] p-5">
                    <div className="flex items-center justify-between gap-3 text-[14px]">
                      <span className="text-neutral-600">
                        {safeCount} 个账号 × {accountPrice} 点
                      </span>
                      <span className="text-neutral-400">=</span>
                      <span className="text-[22px] font-bold tracking-[-0.02em]">
                        {totalCost} <span className="text-[13px] font-medium text-neutral-500">点</span>
                      </span>
                    </div>
                    <div className="mt-3 h-px bg-[var(--line)]" />
                    <div className="mt-2.5 flex items-center justify-between gap-3 text-[12px] text-neutral-500">
                      <span>{safeCount === 1 ? "下载 1 个 JSON" : `打包 ${safeCount} 个 JSON 为 ZIP`}</span>
                      <span>余额 {me.balance} 点 → {me.balance - totalCost} 点</span>
                    </div>
                  </div>

                  {redeemMsg && (
                    <div
                      className={`flex items-center gap-2 rounded-[10px] border px-3 py-2.5 text-[14px] ${
                        redeemMsg.type === "ok"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-orange-200 bg-orange-50 text-orange-700"
                      }`}
                    >
                      {redeemMsg.type === "ok" ? (
                        <CheckCircle2 className="size-4 shrink-0" />
                      ) : (
                        <AlertCircle className="size-4 shrink-0" />
                      )}
                      {redeemMsg.text}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className={`${PRIMARY_BTN} w-full h-12 text-[15px]`}
                    disabled={redeemLoading || !canAfford || !enoughStock}
                  >
                    {redeemLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : safeCount > 1 ? (
                      <Package className="size-[18px]" />
                    ) : (
                      <Download className="size-[18px]" />
                    )}
                    {redeemLoading
                      ? "兑换中..."
                      : !canAfford
                      ? `余额不足 ${totalCost} 点`
                      : !enoughStock
                      ? "库存不足，请调小数量"
                      : safeCount === 1
                      ? "兑换并下载"
                      : `兑换 ${safeCount} 个并打包下载`}
                  </Button>
                </form>
              )}
            </>
          )}
        </section>
          </div>

          {/* === 右侧侧栏 === */}
          <aside className="space-y-5">
            {/* 兑换说明 */}
            <section className={`${CARD_BASE} p-5`}>
              <div className="flex items-center gap-2 mb-3">
                <BookOpenText className="size-4 text-emerald-600" />
                <h3 className="text-[13px] font-semibold">兑换说明</h3>
              </div>
              <ul className="space-y-2 text-[13px]">
                <li className="flex items-center justify-between gap-2 py-1.5 border-b border-[var(--line)]">
                  <span className="text-neutral-500">每个账号</span>
                  <span className="font-semibold text-neutral-900">{accountPrice} 点</span>
                </li>
                <li className="flex items-center justify-between gap-2 py-1.5 border-b border-[var(--line)]">
                  <span className="text-neutral-500">单次最多</span>
                  <span className="font-semibold text-neutral-900">50 个</span>
                </li>
                <li className="flex items-center justify-between gap-2 py-1.5">
                  <span className="text-neutral-500">兑换形式</span>
                  <span className="font-semibold text-neutral-900">JSON / ZIP</span>
                </li>
              </ul>
              {settings.contact_info && (
                <div className="mt-3 pt-3 border-t border-[var(--line)] flex items-center gap-2 text-[12px] text-neutral-600">
                  {settings.contact_icon === "telegram" ? (
                    <svg className="size-3.5 text-[#26A5E4] shrink-0" viewBox="0 0 1024 1024" fill="currentColor"><path d="M817.024 213.418667c5.504 0.256 11.946667 1.024 18.602667 2.602666 8.618667 2.090667 21.034667 6.314667 32.341333 15.530667 20.138667 16.384 24.448 38.058667 25.856 46.378667 1.408 8.021333 3.029333 24.704 1.621333 39.552-10.794667 114.005333-57.002667 386.944-80.256 511.914666-10.666667 57.173333-37.12 104.106667-87.850666 108.8l-6.186667 0.384c-26.709333 1.066667-49.450667-7.082667-68.266667-17.066666l-8.405333-4.693334a402.218667 402.218667 0 0 1-28.8-19.157333l-28.330667-19.797333c-39.594667-26.026667-78.506667-52.992-117.76-79.573334l-39.338666-26.368c-53.845333-35.626667-104.064-55.893333-159.232-74.026666l-57.173334-17.92-76.672-24.149334c-12.245333-3.84-25.813333-8.106667-37.674666-12.8l-11.093334-4.949333a90.026667 90.026667 0 0 1-31.146666-23.466667 64.597333 64.597333 0 0 1-14.08-49.365333c3.114667-24.661333 19.925333-40.704 31.957333-49.664 13.013333-9.685333 29.525333-17.877333 47.488-25.088 204.714667-89.514667 341.632-148.778667 410.368-177.493333 97.536-40.746667 157.482667-65.066667 196.522667-79.274667 38.229333-13.952 61.098667-20.053333 82.346666-20.394667l5.12 0.085334z m-12.458667 64.64c-9.856 1.450667-24.874667 5.546667-53.12 15.786666-37.418667 13.610667-96 37.418667-193.749333 78.250667-68.224 28.458667-204.629333 87.466667-409.386667 177.066667l-1.834666 0.725333c-15.616 6.272-26.410667 11.989333-33.109334 16.981333l0.042667 0.042667a31.189333 31.189333 0 0 0-6.741333 6.528v0.469333l0.298666 0.426667 2.858667 2.517333c1.706667 1.152 3.84 2.389333 6.528 3.669334 8.661333 4.266667 22.272 8.661333 40.021333 14.250666 26.154667 8.234667 50.901333 16.213333 76.245334 24.021334 53.888 16.554667 105.301333 32.213333 158.122666 57.472l225.152-212.608c18.688-17.621333 46.848 6.656 32.128 27.733333l-166.528 237.866667c21.333333 14.250667 42.496 28.586667 63.317334 42.794666 26.112 17.792 51.84 35.328 77.738666 52.352 10.922667 7.210667 21.76 15.061333 30.250667 21.12 9.130667 6.528 16.725333 11.776 24.149333 16.128h0.042667c16.128 9.514667 29.866667 14.08 44.458667 12.8l3.2-0.597333c3.072-0.853333 6.144-2.901333 10.069333-8.277333 6.485333-8.874667 13.226667-24.576 17.536-47.914667 23.338667-125.184 68.992-395.477333 79.488-506.197333a102.656 102.656 0 0 0-0.981333-22.784c-0.725333-4.352-1.706667-6.272-3.2-7.509334a11.477333 11.477333 0 0 0-2.56-1.450666l-4.266667-1.450667a36.693333 36.693333 0 0 0-7.765333-0.938667l-8.405334 0.725334z"/></svg>
                  ) : settings.contact_icon === "wechat" ? (
                    <svg className="size-3.5 text-[#07C160] shrink-0" viewBox="0 0 1024 1024" fill="currentColor"><path d="M664.250054 368.541681c10.015098 0 19.892049 0.732687 29.67281 1.795902-26.647917-122.810047-159.358451-214.077703-310.826188-214.077703-169.353083 0-308.085774 114.232694-308.085774 259.274068 0 83.708494 46.165436 152.460344 123.281791 205.78483l-30.80868 91.730191 107.688651-53.455469c38.558178 7.53665 69.459978 15.308661 107.924012 15.308661 9.66308 0 19.230993-0.470721 28.752858-1.225921-6.025227-20.36584-9.521864-41.723264-9.521864-63.862493C402.328693 476.632491 517.908058 368.541681 664.250054 368.541681zM498.62897 285.87389c23.200398 0 38.557154 15.120372 38.557154 38.061874 0 22.846334-15.356756 38.156018-38.557154 38.156018-23.107277 0-46.260603-15.309684-46.260603-38.156018C452.368366 300.994262 475.522716 285.87389 498.62897 285.87389zM283.016307 362.090758c-23.107277 0-46.402843-15.309684-46.402843-38.156018 0-22.941502 23.295566-38.061874 46.402843-38.061874 23.081695 0 38.46301 15.120372 38.46301 38.061874C321.479317 346.782098 306.098002 362.090758 283.016307 362.090758zM945.448458 606.151333c0-121.888048-123.258255-221.236753-261.683954-221.236753-146.57838 0-262.015505 99.348706-262.015505 221.236753 0 122.06508 115.437126 221.200938 262.015505 221.200938 30.66644 0 61.617359-7.609305 92.423993-15.262612l84.513836 45.786813-23.178909-76.17082C899.379213 735.776599 945.448458 674.90216 945.448458 606.151333zM598.803483 567.994292c-15.332197 0-30.807656-15.096836-30.807656-30.501688 0-15.190981 15.47546-30.477129 30.807656-30.477129 23.295566 0 38.558178 15.286148 38.558178 30.477129C637.361661 552.897456 622.099049 567.994292 598.803483 567.994292zM768.25071 567.994292c-15.213493 0-30.594809-15.096836-30.594809-30.501688 0-15.190981 15.381315-30.477129 30.594809-30.477129 23.107277 0 38.558178 15.286148 38.558178 30.477129C806.808888 552.897456 791.357987 567.994292 768.25071 567.994292z"/></svg>
                  ) : (
                    <svg className="size-3.5 text-[#12B7F5] shrink-0" viewBox="0 0 1024 1024" fill="currentColor"><path d="M824.8 613.2c-16-51.4-34.4-94.6-62.7-165.3C766.5 262.2 689.3 112 511.5 112 331.7 112 256.2 265.2 261 447.9c-28.4 70.8-46.7 113.7-62.7 165.3-34 109.5-23 154.8-14.6 155.8 18 2.2 70.1-82.4 70.1-82.4 0 49 25.2 112.9 79.8 159-26.4 8.1-85.7 29.9-71.6 53.8 11.4 19.3 196.2 12.3 249.5 6.3 53.3 6 238.1 13 249.5-6.3 14.1-23.8-45.3-45.7-71.6-53.8 54.6-46.2 79.8-110.1 79.8-159 0 0 52.1 84.6 70.1 82.4 8.5-1.1 19.5-46.4-14.5-155.8z"/></svg>
                  )}
                  {settings.contact_info.startsWith("http") ? (
                    <a
                      href={settings.contact_info}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-blue-600 hover:underline"
                    >
                      {settings.contact_info}
                    </a>
                  ) : settings.contact_info.startsWith("@") ? (
                    <a
                      href={`https://t.me/${settings.contact_info.slice(1)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-blue-600 hover:underline"
                    >
                      {settings.contact_info}
                    </a>
                  ) : (
                    <span className="break-all">{settings.contact_info}</span>
                  )}
                </div>
              )}
            </section>

            {/* 我的最近记录 - 仅登录后 */}
            {me && transactions.length > 0 && (
              <details className={`${CARD_BASE} group`} open>
                <summary className="cursor-pointer list-none px-5 py-3.5 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[13px] font-semibold">
                    <History className="size-4 text-neutral-500" />
                    我的最近记录
                    <span className="text-[11px] font-normal text-neutral-400">
                      共 {transactions.length} 条
                    </span>
                  </span>
                  <span className="text-neutral-400 group-open:rotate-180 transition-transform text-[12px]">▾</span>
                </summary>
                <ul className="border-t border-[var(--line)] divide-y divide-[var(--line)] max-h-[440px] overflow-y-auto">
                  {transactions.map((t) => {
                    const c = t.count || 1;
                    let label = "";
                    if (t.type === "recharge") {
                      label = `充值 ${t.amount} 点`;
                    } else if (t.type === "redeem") {
                      label = `兑换 ${c} 个 · 消耗 ${Math.abs(t.amount)} 点`;
                    } else {
                      label = `调整 ${t.amount > 0 ? "+" : ""}${t.amount} 点`;
                    }
                    return (
                      <li key={t.id} className="px-5 py-2.5">
                        <div className="flex items-center justify-between gap-2 text-[12px]">
                          <span className="flex items-center gap-1.5 min-w-0 flex-1">
                            {t.type === "recharge" ? (
                              <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700">
                                充
                              </span>
                            ) : t.type === "redeem" ? (
                              <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700">
                                兑
                              </span>
                            ) : (
                              <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] bg-neutral-100 text-neutral-700">
                                调
                              </span>
                            )}
                            <span className="text-neutral-700 truncate">{label}</span>
                          </span>
                          <span className="flex items-center gap-2 shrink-0">
                            {t.type === "redeem" && (t.related_credential_ids || t.related_credential_id) && (
                              <button
                                type="button"
                                onClick={() => window.open(`/api/download/${t.id}`, "_blank")}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                title="再次下载"
                              >
                                <Download className="size-3" />
                                下载
                              </button>
                            )}
                            <span
                              className={`font-medium ${
                                t.amount > 0 ? "text-emerald-600" : "text-orange-600"
                              }`}
                            >
                              {t.amount > 0 ? "+" : ""}
                              {t.amount}
                            </span>
                          </span>
                        </div>
                        <p className="text-[10.5px] text-neutral-400 mt-0.5 ml-6">
                          {formatTime(t.created_at)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </details>
            )}
          </aside>
        </div>{/* end of grid */}
      </div>
    </main>
  );
}


