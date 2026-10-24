import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const LAMPORTS = 1_000_000_000;

export function fmtSol(lamports: number | bigint): string {
  return (Number(lamports) / LAMPORTS).toFixed(3);
}

export function shortAddr(addr: string, head = 4, tail = 4): string {
  if (addr.length <= head + tail + 3) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}
