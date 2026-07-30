import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Standard shadcn/21st.dev class helper: conditional classes via clsx, with
 * tailwind-merge resolving conflicts so a later class wins (e.g. passing
 * "p-2" overrides a component's built-in "p-6" instead of both landing in
 * the class list and letting CSS order decide).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
