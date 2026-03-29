"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";

type ReportTarget =
  | { type: "post"; id: number; label?: string }
  | { type: "thread"; id: number; label?: string }
  | { type: "user"; id: number; label?: string };

interface ReportDialogProps {
  target: ReportTarget;
  /** Optional custom trigger. Defaults to a ghost Flag icon button. */
  trigger?: React.ReactNode;
}

export default function ReportDialog({ target, trigger }: ReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleOpen = () => {
    setReason("");
    setSubmitted(false);
    setErr(null);
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = { reason: reason.trim() };
      if (target.type === "post")   body.postId         = target.id;
      if (target.type === "thread") body.threadId       = target.id;
      if (target.type === "user")   body.reportedUserId = target.id;

      await apiFetch("/api/reports", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setSubmitted(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not submit report.");
    } finally {
      setSubmitting(false);
    }
  };

  const targetLabel =
    target.label ??
    (target.type === "post"
      ? "this post"
      : target.type === "thread"
      ? "this thread"
      : "this user");

  return (
    <>
      <span onClick={handleOpen}>
        {trigger ?? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-[var(--sd-danger)]"
            title={`Report ${targetLabel}`}
          >
            <Flag className="h-3.5 w-3.5" />
          </Button>
        )}
      </span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          {submitted ? (
            <div className="space-y-4 text-center py-2">
              <Flag className="mx-auto h-8 w-8 text-[var(--sd-accent)]" />
              <p className="font-display text-sm font-bold uppercase tracking-widest">
                Report submitted
              </p>
              <p className="font-body text-xs text-muted-foreground">
                Our moderation team will review it shortly.
              </p>
              <Button variant="outline" onClick={() => setOpen(false)} className="mt-2">
                Close
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="font-display text-sm font-bold uppercase tracking-widest mb-0.5">
                  Report {targetLabel}
                </p>
                <p className="font-body text-xs text-muted-foreground">
                  Tell us why you're reporting this content.
                </p>
              </div>

              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe the issue..."
                rows={4}
                className="w-full rounded-lg border border-[var(--sd-border-subtle)] bg-[var(--sd-surface-raised)] px-3 py-2 font-body text-sm text-foreground outline-none focus:border-[var(--sd-accent)] resize-none"
              />

              {err && (
                <p className="font-body text-xs text-[var(--sd-danger)]">{err}</p>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || reason.trim().length === 0}
                  className="bg-[var(--sd-danger)] text-white hover:bg-[var(--sd-danger)]/90 font-display font-semibold uppercase tracking-wide text-xs"
                >
                  {submitting ? "Submitting…" : "Submit Report"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
