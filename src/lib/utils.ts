import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility for merging Tailwind class names with clsx + tailwind-merge.
 * Used by shadcn/ui components throughout the app.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
