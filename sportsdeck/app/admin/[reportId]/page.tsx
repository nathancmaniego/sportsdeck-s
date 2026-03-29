"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Shield, CheckCircle, XCircle, User, FileText, MessageSquare, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatDistanceShort } from "@/lib/utils";
import AdminRoute from "@/components/AdminRoute";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type ReportDetail = {
  id: number;
  reason: string;
  status: string;
  aiScore: number | null;
  aiVerdict: string | null;
  createdAt: string;
  reporter: { id: number; username: string };
  post: { id: number; content: string; authorId: number; threadId: number } | null;
  thread: { id: number; title: string; teamId: number } | null;
  reportedUser: { id: number; username: string; isBanned: boolean } | null;
};

export default function ReportDetailPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const router = useRouter();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [contentActing, setContentActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isUserReport = !!(report?.reportedUser && !report.post && !report.thread);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Fetch from queue and find matching report — admin reports list supports filtering
        const data = await apiFetch<{ reports: ReportDetail[] }>(
          `/api/admin/reports?limit=50&status=pending`
        );
        const found = data.reports.find((r) => r.id === parseInt(reportId));
        if (found) { setReport(found); return; }

        // Try other statuses
        for (const status of ["approved", "dismissed"]) {
          const d = await apiFetch<{ reports: ReportDetail[] }>(
            `/api/admin/reports?limit=50&status=${status}`
          );
          const f = d.reports.find((r) => r.id === parseInt(reportId));
          if (f) { setReport(f); return; }
        }
        setError("Report not found.");
      } catch {
        setError("Failed to load report.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [reportId]);

  const act = async (action: "approve" | "dismiss") => {
    setActing(true);
    try {
      await apiFetch(`/api/admin/reports/${reportId}/${action}`, { method: "POST" });
      router.push("/admin");
    } catch {
      setActing(false);
    }
  };

  const actOnContent = async () => {
    if (!report) return;
    setContentActing(true);
    try {
      if (report.post) {
        await apiFetch(`/api/posts/${report.post.id}`, { method: "DELETE" });
      } else if (report.thread) {
        await apiFetch(`/api/threads/${report.thread.id}`, { method: "DELETE" });
      }
    } catch {
      // ignore
    } finally {
      setContentActing(false);
    }
  };

  const toxicityColor =
    report?.aiScore == null
      ? "text-muted-foreground"
      : report.aiScore >= 0.7
      ? "text-[var(--sd-danger)]"
      : report.aiScore >= 0.4
      ? "text-yellow-500"
      : "text-green-500";

  return (
    <AdminRoute>
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-[var(--sd-accent)] font-body mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to moderation
        </Link>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : error || !report ? (
          <p className="font-body text-sm text-muted-foreground">{error ?? "Report not found."}</p>
        ) : (
          <div className="space-y-5">
            {/* Title */}
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-[var(--sd-accent)]" />
              <h1 className="font-display text-2xl font-extrabold uppercase tracking-tight">
                Report #{report.id}
              </h1>
              <Badge
                className={`uppercase tracking-widest text-[10px] px-2 py-0.5 ${
                  report.status === "pending"
                    ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                    : report.status === "approved"
                    ? "bg-red-500/10 text-red-600 border-red-500/20"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {report.status}
              </Badge>
            </div>

            {/* Target */}
            <div className="rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-4 space-y-2">
              <p className="font-display text-[10px] font-bold uppercase tracking-widest text-[var(--sd-accent)]">
                Reported Content
              </p>

              {report.post && (
                <>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span className="font-display text-[10px] uppercase tracking-widest">Post</span>
                  </div>
                  <p className="font-body text-sm whitespace-pre-wrap">{report.post.content}</p>
                  <Link
                    href={`/forums/${report.thread?.teamId ?? 0}/${report.post.threadId}#post-${report.post.id}`}
                    className="font-body text-xs text-[var(--sd-accent)] hover:underline"
                  >
                    View post in thread →
                  </Link>
                </>
              )}

              {report.thread && !report.post && (
                <>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    <span className="font-display text-[10px] uppercase tracking-widest">Thread</span>
                  </div>
                  <p className="font-display text-sm font-bold uppercase tracking-tight">{report.thread.title}</p>
                  <Link
                    href={`/forums/${report.thread.teamId}/${report.thread.id}`}
                    className="font-body text-xs text-[var(--sd-accent)] hover:underline"
                  >
                    View thread →
                  </Link>
                </>
              )}

              {report.reportedUser && (
                <>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    <span className="font-display text-[10px] uppercase tracking-widest">User</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/users/${report.reportedUser.id}`}
                      className="font-display text-sm font-bold uppercase tracking-tight text-[var(--sd-accent)] hover:underline"
                    >
                      {report.reportedUser.username}
                    </Link>
                    {report.reportedUser.isBanned && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 uppercase tracking-widest">Banned</Badge>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Reason */}
            <div className="rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-4">
              <p className="font-display text-[10px] font-bold uppercase tracking-widest text-[var(--sd-accent)] mb-2">Reason</p>
              <p className="font-body text-sm">{report.reason}</p>
            </div>

            {/* AI Verdict */}
            <div className="rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-4">
              <p className="font-display text-[10px] font-bold uppercase tracking-widest text-[var(--sd-accent)] mb-2">AI Analysis</p>
              {report.aiVerdict ? (
                <>
                  <p className={`font-display text-sm font-bold uppercase tracking-wide mb-1 ${toxicityColor}`}>
                    {report.aiScore != null ? `${Math.round(report.aiScore * 100)}% toxicity score` : ""}
                  </p>
                  <p className="font-body text-sm">{report.aiVerdict}</p>
                </>
              ) : (
                <p className="font-body text-sm text-muted-foreground">AI verdict pending…</p>
              )}
            </div>

            {/* Meta */}
            <p className="font-body text-xs text-muted-foreground">
              Reported by{" "}
              <Link href={`/users/${report.reporter.id}`} className="font-semibold text-foreground hover:underline">
                {report.reporter.username}
              </Link>
              {" · "}
              {formatDistanceShort(report.createdAt)}
            </p>

            {/* Actions */}
            <div className="space-y-3">
              {/* Content delete — only for post/thread reports */}
              {!isUserReport && (report.post || report.thread) && (
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={actOnContent}
                    disabled={contentActing}
                    className="gap-1.5 border-[var(--sd-danger)]/40 text-[var(--sd-danger)] hover:bg-[var(--sd-danger)]/10 font-display font-semibold uppercase tracking-wide text-xs"
                  >
                    <Trash2 className="h-4 w-4" />
                    {report.post ? "Delete Post" : "Delete Thread"}
                  </Button>
                </div>
              )}

              {/* Report status actions — pending only */}
              {report.status === "pending" && (
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => act("approve")}
                    disabled={acting}
                    className="gap-1.5 bg-[var(--sd-danger)] text-white hover:bg-[var(--sd-danger)]/90 font-display font-semibold uppercase tracking-wide text-xs"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {isUserReport ? "Approve & Ban" : "Approve & Hide Content"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => act("dismiss")}
                    disabled={acting}
                    className="gap-1.5 font-display font-semibold uppercase tracking-wide text-xs"
                  >
                    <XCircle className="h-4 w-4" />
                    Dismiss
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminRoute>
  );
}

