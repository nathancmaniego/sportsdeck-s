// Prompt: Utility functions for SportsDeck — cn (clsx/tailwind-merge), formatDate,
// formatDistanceShort, and truncate. Built on top of shadcn's utils pattern.
// Claude claude-4.6-opus-high-thinking

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "EEE, MMM d · h:mm a");
}

export function formatDistanceShort(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function truncate(str: string, n: number): string {
  if (str.length <= n) return str;
  return str.slice(0, n).trimEnd() + "…";
}
