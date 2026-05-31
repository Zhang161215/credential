import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import crypto from "crypto";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateCardKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const segment = () => {
    let s = "";
    for (let i = 0; i < 4; i++) {
      s += chars[crypto.randomInt(chars.length)];
    }
    return s;
  };
  return `TEAM-${segment()}-${segment()}-${segment()}`;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso + "Z").toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
}

export function generateSlug(length = 6): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let slug = "";
  for (let i = 0; i < length; i++) {
    slug += chars[crypto.randomInt(chars.length)];
  }
  return slug;
}
