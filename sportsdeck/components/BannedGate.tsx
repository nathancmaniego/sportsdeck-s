"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ShieldOff, LogOut, XCircle } from "lucide-react";
import { logout } from "@/lib/api";

type AppealStatus = {
  id: number;
  status: "pending" | "approved" | "rejected";
  reason: string;
  adminMessage: string | null;
  createdAt: string;
} | null;

export function BannedGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <>{children}</>;
  if (!user?.isBanned) return <>{children}</>;

  return <BannedScreen onLogout={async () => { await logout(); window.location.href = "/"; }} />;
}

function BannedScreen({ onLogout }: { onLogout: () => void }) {
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [appeal, setAppeal] = useState<AppealStatus>(undefined as unknown as AppealStatus);
  const [appealLoading, setAppealLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ appeal: AppealStatus }>("/api/appeals")
      .then((data) => setAppeal(data.appeal))
      .catch(() => setAppeal(null))
      .finally(() => setAppealLoading(false));
  }, []);

  const submit = async () => {
    if (!reason.trim()) return;
    setStatus("submitting");
    try {
      await apiFetch("/api/appeals", {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      setStatus("submitted");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to submit appeal.";
      setErrorMsg(msg);
      setStatus("error");
    }
  };

  // Already has a pending or rejected appeal — determine what to show
  const hasPendingAppeal = appeal?.status === "pending";
  const hasRejectedAppeal = appeal?.status === "rejected";
  const hasApprovedAppeal = appeal?.status === "approved"; // shouldn't see this page if unbanned
  const canSubmit = !appealLoading && !appeal; // no existing appeal at all

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[var(--sd-bg)]">
      <div className="w-full max-w-md space-y-6">
        {/* Icon + heading */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--sd-danger)]/10 border border-[var(--sd-danger)]/30">
            <ShieldOff className="h-7 w-7 text-[var(--sd-danger)]" />
          </div>
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">
            Account Banned
          </h1>
          <p className="font-body text-sm text-muted-foreground leading-relaxed">
            Your account has been banned for violating community guidelines.
            If you believe this is a mistake, you can submit an appeal below.
          </p>
        </div>

        {/* Appeal section */}
        <div className="rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-5 space-y-4">
          {appealLoading ? (
            <div className="h-8 animate-pulse rounded bg-[var(--sd-surface-raised)]" />
          ) : hasRejectedAppeal ? (
            /* Denial message */
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-[var(--sd-danger)] flex-shrink-0" />
                <p className="font-display text-sm font-bold uppercase tracking-widest text-[var(--sd-danger)]">
                  Appeal Denied
                </p>
              </div>
              {appeal?.adminMessage ? (
                <div className="rounded-lg bg-[var(--sd-surface-raised)] border border-[var(--sd-border-subtle)] px-3 py-2">
                  <p className="font-display text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Admin Message</p>
                  <p className="font-body text-sm">{appeal.adminMessage}</p>
                </div>
              ) : (
                <p className="font-body text-sm text-muted-foreground">
                  Your appeal was reviewed and denied. No additional information was provided.
                </p>
              )}
            </div>
          ) : hasPendingAppeal ? (
            /* Pending state */
            <div className="text-center space-y-2 py-2">
              <p className="font-display text-sm font-bold uppercase tracking-widest text-yellow-500">
                Appeal Under Review
              </p>
              <p className="font-body text-sm text-muted-foreground">
                Your appeal has been submitted and is awaiting admin review.
              </p>
            </div>
          ) : status === "submitted" ? (
            <div className="text-center space-y-2 py-2">
              <p className="font-display text-sm font-bold uppercase tracking-widest text-green-500">
                Appeal Submitted
              </p>
              <p className="font-body text-sm text-muted-foreground">
                An admin will review your appeal shortly.
              </p>
            </div>
          ) : canSubmit ? (
            <>
              <div>
                <label className="font-display text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                  Your Appeal
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why you believe this ban is a mistake…"
                  rows={4}
                  className="w-full rounded-lg border border-[var(--sd-border-subtle)] bg-[var(--sd-surface-raised)] px-3 py-2 font-body text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[var(--sd-accent)] placeholder:text-muted-foreground"
                />
                {status === "error" && (
                  <p className="mt-1 font-body text-xs text-[var(--sd-danger)]">{errorMsg}</p>
                )}
              </div>
              <Button
                onClick={submit}
                disabled={status === "submitting" || !reason.trim()}
                className="w-full font-display font-bold uppercase tracking-wide text-sm bg-[var(--sd-accent)] text-white hover:bg-[var(--sd-accent)]/90"
              >
                {status === "submitting" ? "Submitting…" : "Send Appeal"}
              </Button>
            </>
          ) : null}
        </div>

        {/* Log out */}
        <button
          onClick={onLogout}
          className="flex items-center gap-2 mx-auto font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
