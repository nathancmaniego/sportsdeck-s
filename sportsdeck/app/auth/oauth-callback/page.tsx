"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { completeOAuthSession } from "@/lib/api";

export default function OAuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#token=")) {
      router.replace("/login?error=oauth");
      return;
    }

    const token = decodeURIComponent(hash.slice("#token=".length));
    if (!token) {
      router.replace("/login?error=oauth");
      return;
    }

    window.history.replaceState(null, "", window.location.pathname);

    completeOAuthSession(token)
      .then(() => {
        toast.success("Welcome!");
        router.replace("/activity");
      })
      .catch(() => {
        setMessage("Could not finish sign-in.");
        toast.error("Sign-in failed. Try again.");
        router.replace("/login?error=oauth");
      });
  }, [router]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
      <Loader2 className="h-8 w-8 animate-spin text-[var(--sd-accent)]" aria-hidden />
      <p className="font-body text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
