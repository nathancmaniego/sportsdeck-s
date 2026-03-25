// Prompt: SWR-based typed fetch hook — wraps apiFetch for client-side data fetching
// with caching, revalidation, and error handling.
// Claude claude-4.6-opus-high-thinking

import useSWR, { type SWRConfiguration } from "swr";
import { apiFetch } from "@/lib/api";

export function useFetch<T>(
  path: string | null,
  options?: SWRConfiguration<T>
) {
  return useSWR<T>(
    path,
    (url: string) => apiFetch<T>(url),
    {
      revalidateOnFocus: false,
      ...options,
    }
  );
}
