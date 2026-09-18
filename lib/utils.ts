import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a Date as YYYY-MM-DD using local timezone.
 * Used consistently across the app for sale dates.
 */
export function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format a Date as YYYY-MM using local timezone.
 * Used for monthly reports and filtering.
 */
export function monthKey(date: Date): string {
  return dateKey(date).slice(0, 7);
}
