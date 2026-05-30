"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  KeyRound, Download, AlertCircle, CheckCircle2, Megaphone, MessageCircle,
  Loader2, Wallet, LogOut, RefreshCw, Coins, Sparkles, History, BookOpenText,
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
  account_price: string;
}

interface PublicStats {
  inventory: number;
  recent5min: number;
}

interface Transaction {
  id: number;
  type: "recharge" | "redeem" | "admin_adjust";
  amount: number;
  balance_after: number;
  related_card_key: string | null;
  related_credential_id: number | null;
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

export default function HomePage() {
  const [me, setMe] = useState<MeData | null>(null);
  const [meLoading, setMeLoading] = useState(true);

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
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
    account_price: "100",
  });
  const [stats, setStats] = useState<PublicStats>({ inventory: 0, recent5min: 0 });
  const [transactions, setTransactions] = useState<Transaction[]>([]);

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
        account_price: data.account_price || "100",
      });
    } catch {}
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      setStats({
        inventory: data.inventory ?? 0,
        recent5min: data.recent5min ?? 0,
      });
    } catch {}
  }, []);

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
      const res = await fetch("/api/recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: cardKey.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRechargeMsg({ type: "err", text: data.error || "充值失败" });
        return;
      }
      setRechargeMsg({
        type: "ok",
        text: `充值成功 +${data.value} 点，当前余额 ${data.balance} 点`,
      });
      setCardKey("");
      if (me) setMe({ ...me, balance: data.balance });
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
        const res = await fetch("/api/redeem", { method: "POST" });
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
        const res = await fetch("/api/redeem/batch", {
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
    <main className="min-h-screen px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto w-full max-w-[1180px] space-y-5">
        {/* Top nav */}
        <nav className={`${CARD_BASE} flex items-center justify-between gap-3 px-4 md:px-5 py-3`}>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-neutral-900 text-white font-bold">
              K
            </span>
            <div>
              <p className="text-[15px] font-semibold leading-tight">账号提取</p>
              <p className="text-[12px] text-neutral-500 leading-tight">统一余额提号工作台</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {me && (
              <span className="hidden md:inline-flex items-center gap-1 rounded-[10px] border border-[var(--line)] bg-white px-3 h-9 text-sm">
                <Wallet className="size-4 text-cyan-700" />
                {me.balance}
                <span className="text-neutral-500 ml-0.5">点</span>
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="rounded-[10px] h-9"
              onClick={() => fetchStats()}
            >
              <RefreshCw className="size-3.5" />
              <span className="hidden md:inline">刷新</span>
            </Button>
            {me && (
              <Button variant="outline" size="sm" className="rounded-[10px] h-9" onClick={handleLogout}>
                <LogOut className="size-3.5" />
                <span className="hidden md:inline">退出</span>
              </Button>
            )}
          </div>
        </nav>

        {/* Title row + stats */}
        <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
          <div className={`${CARD_BASE} p-[22px]`}>
            <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-neutral-500">
              凭证提取工作台
            </p>
            <h1 className="mt-2 text-[26px] md:text-[30px] font-bold tracking-[-0.02em]">
              注册账号 → 卡密充值 → 点数兑换
            </h1>
            <p className="mt-2 text-sm text-neutral-500">
              所有兑换记录集中管理，1 个账号消耗
              <span className="mx-1 font-semibold text-neutral-900">{accountPrice}</span>
              点。
            </p>
          </div>

          <div className={`${CARD_BASE} flex items-center justify-between gap-3 px-[18px] py-[16px]`}>
            <div>
              <p className="text-[12px] uppercase tracking-[0.16em] text-neutral-500">当前库存</p>
              <p className="mt-1 text-[28px] font-bold tracking-[-0.04em] text-neutral-900">
                {stats.inventory}
              </p>
            </div>
            <div className="h-10 w-px bg-[var(--line)]" />
            <div>
              <p className="text-[12px] uppercase tracking-[0.16em] text-neutral-500">最近 5 分钟</p>
              <p className="mt-1 text-[28px] font-bold tracking-[-0.04em] text-blue-600">
                {stats.recent5min}
              </p>
            </div>
            <div className="hidden md:flex items-center gap-1 text-[12px] text-neutral-500">
              <Sparkles className="size-3.5 text-cyan-600" />
              实时
            </div>
          </div>
        </div>

        {/* Main two-column */}
        <div className="grid gap-5 md:grid-cols-[1.8fr_0.9fr]">
          <section className={`${CARD_BASE} p-[22px] space-y-5`}>
            {meLoading ? (
              <div className="flex items-center gap-2 text-neutral-500 py-12 justify-center">
                <Loader2 className="size-4 animate-spin" />
                加载中...
              </div>
            ) : !me ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[18px] font-semibold tracking-[-0.01em]">访问账号</h2>
                    <p className="text-[13px] text-neutral-500 mt-1">登录或注册以使用兑换功能</p>
                  </div>
                  <div className={SEG_WRAP}>
                    <button
                      type="button"
                      onClick={() => { setAuthMode("login"); setAuthError(""); }}
                      className={`px-3 h-8 rounded-[8px] text-sm font-medium transition-colors ${
                        authMode === "login" ? SEG_ACTIVE : SEG_INACTIVE
                      }`}
                    >
                      登录
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAuthMode("register"); setAuthError(""); }}
                      className={`px-3 h-8 rounded-[8px] text-sm font-medium transition-colors ${
                        authMode === "register" ? SEG_ACTIVE : SEG_INACTIVE
                      }`}
                    >
                      注册
                    </button>
                  </div>
                </div>

                <form onSubmit={handleAuth} className="space-y-3">
                  <div className={FIELD_CARD}>
                    <label className="text-[12px] font-medium text-neutral-500 uppercase tracking-wider">
                      用户名
                    </label>
                    <Input
                      value={authUsername}
                      onChange={(e) => setAuthUsername(e.target.value)}
                      placeholder="3-32 字符 字母/数字/下划线"
                      className="bg-white h-10 rounded-[10px]"
                      autoComplete="username"
                      disabled={authLoading}
                    />
                  </div>
                  <div className={FIELD_CARD}>
                    <label className="text-[12px] font-medium text-neutral-500 uppercase tracking-wider">
                      密码
                    </label>
                    <Input
                      type="password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder={authMode === "register" ? "至少 6 位" : "请输入密码"}
                      className="bg-white h-10 rounded-[10px]"
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
                    className={`${PRIMARY_BTN} w-full`}
                    disabled={authLoading || !authUsername.trim() || !authPassword}
                  >
                    {authLoading ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                    {authLoading
                      ? (authMode === "login" ? "登录中..." : "注册中...")
                      : (authMode === "login" ? "登录账号" : "注册账号")}
                  </Button>
                </form>

                <ol className="grid grid-cols-3 gap-3 pt-1">
                  {[
                    { n: 1, t: "注册账号", d: "几秒完成" },
                    { n: 2, t: "卡密充值", d: "兑换成点数" },
                    { n: 3, t: "下载账号", d: "JSON 直发" },
                  ].map((s) => (
                    <li key={s.n} className="rounded-[12px] border border-[var(--line)] bg-white/60 p-3">
                      <p className="text-[11px] font-medium text-blue-600">第 {s.n} 步</p>
                      <p className="mt-1 text-[14px] font-semibold">{s.t}</p>
                      <p className="text-[12px] text-neutral-500">{s.d}</p>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[12px] uppercase tracking-[0.18em] text-neutral-500">欢迎回来</p>
                    <h2 className="text-[20px] font-semibold tracking-[-0.01em] mt-1">
                      {me.username}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 rounded-[12px] border border-[var(--line)] bg-white px-3 py-2">
                    <Wallet className="size-4 text-cyan-700" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-neutral-500">余额</p>
                      <p className="text-[18px] font-bold leading-tight">
                        {me.balance}
                        <span className="text-[12px] text-neutral-500 ml-1">点</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className={SEG_WRAP}>
                  <button
                    type="button"
                    onClick={() => setWorkMode("recharge")}
                    className={`px-3 h-8 rounded-[8px] text-sm font-medium transition-colors ${
                      workMode === "recharge" ? SEG_ACTIVE : SEG_INACTIVE
                    }`}
                  >
                    <Coins className="size-3.5 inline mr-1.5 -mt-0.5" />
                    充值
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkMode("redeem")}
                    className={`px-3 h-8 rounded-[8px] text-sm font-medium transition-colors ${
                      workMode === "redeem" ? SEG_ACTIVE : SEG_INACTIVE
                    }`}
                  >
                    <Download className="size-3.5 inline mr-1.5 -mt-0.5" />
                    兑换
                  </button>
                </div>

                {workMode === "recharge" ? (
                  <form onSubmit={handleRecharge} className="space-y-3">
                    <div className={FIELD_CARD}>
                      <label className="text-[12px] font-medium text-neutral-500 uppercase tracking-wider">
                        卡密
                      </label>
                      <Textarea
                        value={cardKey}
                        onChange={(e) => setCardKey(e.target.value.toUpperCase())}
                        placeholder="TEAM-XXXX-XXXX-XXXX"
                        className="bg-white font-mono tracking-wider rounded-[10px] min-h-20"
                        disabled={rechargeLoading}
                      />
                      <p className="text-[12px] text-neutral-500">
                        输入卡密充值，面值会自动加到余额
                      </p>
                    </div>

                    {rechargeMsg && (
                      <div
                        className={`flex items-center gap-2 rounded-[10px] border px-3 py-2 text-sm ${
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
                      className={`${PRIMARY_BTN} w-full`}
                      disabled={rechargeLoading || !cardKey.trim()}
                    >
                      {rechargeLoading ? <Loader2 className="size-4 animate-spin" /> : <Coins className="size-4" />}
                      {rechargeLoading ? "充值中..." : "充值到账户"}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleRedeem} className="space-y-3">
                    <div className={FIELD_CARD}>
                      <label className="text-[12px] font-medium text-neutral-500 uppercase tracking-wider">
                        兑换数量（最多 50）
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={50}
                          value={redeemCount}
                          onChange={(e) => {
                            const v = parseInt(e.target.value);
                            setRedeemCount(Number.isFinite(v) ? v : 1);
                          }}
                          className="bg-white h-10 rounded-[10px] w-28"
                          disabled={redeemLoading}
                        />
                        <div className="flex flex-wrap gap-1">
                          {[1, 5, 10, 20, 50].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setRedeemCount(n)}
                              disabled={redeemLoading}
                              className={`px-2.5 h-8 rounded-[8px] text-[12px] border transition-colors ${
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
                      <p className="text-[12px] text-neutral-500">
                        2 个以上将自动打包成 ZIP 下载
                      </p>
                    </div>

                    <div className={FIELD_CARD}>
                      <p className="text-[12px] font-medium text-neutral-500 uppercase tracking-wider">
                        本次兑换
                      </p>
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <p className="text-[28px] font-bold tracking-[-0.03em]">
                            {safeCount} 个账号
                          </p>
                          <p className="text-[13px] text-neutral-500">
                            {safeCount === 1
                              ? "将下载 1 个 JSON 文件"
                              : `将打包成 ZIP 下载（含 ${safeCount} 个 JSON）`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] uppercase tracking-wider text-neutral-500">
                            合计消耗
                          </p>
                          <p className="text-[20px] font-bold text-blue-600">{totalCost}</p>
                          <p className="text-[11px] text-neutral-500">
                            {safeCount} × {accountPrice} 点
                          </p>
                        </div>
                      </div>
                    </div>

                    {redeemMsg && (
                      <div
                        className={`flex items-center gap-2 rounded-[10px] border px-3 py-2 text-sm ${
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
                      className={`${PRIMARY_BTN} w-full`}
                      disabled={redeemLoading || !canAfford || !enoughStock}
                    >
                      {redeemLoading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : safeCount > 1 ? (
                        <Package className="size-4" />
                      ) : (
                        <Download className="size-4" />
                      )}
                      {redeemLoading
                        ? "兑换中..."
                        : !canAfford
                        ? `余额不足 ${totalCost} 点`
                        : !enoughStock
                        ? `库存不足，仅 ${stats.inventory} 个`
                        : safeCount === 1
                        ? "兑换并下载"
                        : `兑换 ${safeCount} 个并打包下载`}
                    </Button>
                  </form>
                )}

                <div className="rounded-[14px] border border-[var(--line)] bg-white/60 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[13px] font-semibold flex items-center gap-1.5">
                      <History className="size-3.5" />
                      我的最近记录
                    </p>
                    <button
                      type="button"
                      onClick={fetchTransactions}
                      className="text-[12px] text-neutral-500 hover:text-neutral-900"
                    >
                      刷新
                    </button>
                  </div>
                  {transactions.length === 0 ? (
                    <p className="text-[12px] text-neutral-500 py-2">暂无记录</p>
                  ) : (
                    <ul className="divide-y divide-[var(--line)]">
                      {transactions.map((t) => (
                        <li key={t.id} className="flex items-center justify-between py-1.5 text-[12px]">
                          <span className="flex items-center gap-2">
                            {t.type === "recharge" ? (
                              <span className="text-emerald-600 font-medium">充值</span>
                            ) : t.type === "redeem" ? (
                              <span className="text-blue-600 font-medium">兑换</span>
                            ) : (
                              <span className="text-neutral-700 font-medium">调整</span>
                            )}
                            <span className="text-neutral-500">
                              {t.related_card_key
                                ? t.related_card_key
                                : t.credential_filename || "-"}
                            </span>
                          </span>
                          <span className="flex items-center gap-3">
                            <span className={t.amount > 0 ? "text-emerald-600" : "text-orange-600"}>
                              {t.amount > 0 ? "+" : ""}
                              {t.amount}
                            </span>
                            <span className="text-neutral-400 hidden md:inline">
                              {formatTime(t.created_at)}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </section>

          <aside className="space-y-4">
            {settings.announcement && (
              <section className={`${CARD_BASE} p-[18px] space-y-2`}>
                <div className="flex items-center gap-2 text-[13px] font-semibold">
                  <Megaphone className="size-4 text-blue-600" />
                  公告
                </div>
                <p className="text-[13px] text-neutral-600 whitespace-pre-wrap leading-relaxed">
                  {settings.announcement}
                </p>
              </section>
            )}

            <section className={`${CARD_BASE} p-[18px] space-y-3`}>
              <div className="flex items-center gap-2 text-[13px] font-semibold">
                <BookOpenText className="size-4 text-emerald-600" />
                价格说明
              </div>
              <div className="rounded-[12px] border border-[var(--line)] bg-gradient-to-b from-blue-500/[0.04] to-blue-500/[0.01] p-3">
                <p className="text-[12px] text-neutral-500 uppercase tracking-wider">每个账号</p>
                <p className="mt-1 text-[24px] font-bold tracking-[-0.03em]">
                  {accountPrice} <span className="text-[14px] font-medium text-neutral-500">点</span>
                </p>
                <p className="mt-1 text-[12px] text-neutral-500">
                  通过卡密充值获得点数后可兑换
                </p>
              </div>
              <ul className="text-[12px] text-neutral-500 space-y-1.5">
                <li>· 卡密一次性使用，充值后即作废</li>
                <li>· 兑换将发放 1 个 JSON 账号文件</li>
                <li>· 兑换记录可在"我的记录"查看</li>
              </ul>
            </section>

            {settings.contact_info && (
              <section className={`${CARD_BASE} p-[18px] space-y-2`}>
                <div className="flex items-center gap-2 text-[13px] font-semibold">
                  <MessageCircle className="size-4 text-orange-600" />
                  联系方式
                </div>
                <p className="text-[13px] text-neutral-600 break-words">
                  {settings.contact_info}
                </p>
              </section>
            )}
          </aside>

        </div>
      </div>
    </main>
  );
}



