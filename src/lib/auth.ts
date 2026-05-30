import { cookies } from "next/headers";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { getDb } from "./db";

const SECRET = process.env.ADMIN_SECRET || "default-secret-change-me";
const ADMIN_COOKIE_NAME = "admin_session";
const USER_COOKIE_NAME = "user_session";
const SESSION_MAX_AGE = 60 * 60 * 24; // 24 hours
const USER_SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function sign(payload: string): string {
  const hmac = crypto.createHmac("sha256", SECRET);
  hmac.update(payload);
  return payload + "." + hmac.digest("hex");
}

function verify(token: string): string | null {
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return null;
  const payload = token.substring(0, lastDot);
  const expected = sign(payload);
  if (token.length !== expected.length) return null;
  if (crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
    return payload;
  }
  return null;
}

// ========== Admin session ==========

export async function createSession(username: string): Promise<void> {
  const payload = JSON.stringify({
    username,
    exp: Date.now() + SESSION_MAX_AGE * 1000,
  });
  const token = sign(payload);
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}

export async function getSession(): Promise<{ username: string } | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(ADMIN_COOKIE_NAME);
  if (!cookie) return null;

  const payload = verify(cookie.value);
  if (!payload) return null;

  try {
    const data = JSON.parse(payload);
    if (data.exp < Date.now()) return null;
    return { username: data.username };
  } catch {
    return null;
  }
}

export async function requireAdmin(): Promise<{ username: string }> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

// ========== User session ==========

export interface UserSession {
  id: number;
  username: string;
}

export async function createUserSession(user: UserSession): Promise<void> {
  const payload = JSON.stringify({
    id: user.id,
    username: user.username,
    exp: Date.now() + USER_SESSION_MAX_AGE * 1000,
  });
  const token = sign(payload);
  const cookieStore = await cookies();
  cookieStore.set(USER_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: USER_SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function destroyUserSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(USER_COOKIE_NAME);
}

export async function getUserSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(USER_COOKIE_NAME);
  if (!cookie) return null;

  const payload = verify(cookie.value);
  if (!payload) return null;

  try {
    const data = JSON.parse(payload);
    if (data.exp < Date.now()) return null;
    if (typeof data.id !== "number" || typeof data.username !== "string") return null;
    // Verify user still exists in DB
    const row = getDb()
      .prepare("SELECT id, username FROM users WHERE id = ?")
      .get(data.id) as { id: number; username: string } | undefined;
    if (!row) return null;
    return { id: row.id, username: row.username };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<UserSession> {
  const session = await getUserSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

// ========== Password helpers ==========

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

// ========== IP helper ==========

export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
