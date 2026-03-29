"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Shield, Clock, CheckCircle, XCircle, User, FileText, MessageSquare, AlertTriangle, Trash2, Gavel } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatDistanceShort } from "@/lib/utils";
import AdminRoute from "@/components/AdminRoute";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type ReportItem = {
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

type AppealItem = {
  id: number;
  reason: string;
  status: string;
  adminMessage: string | null;
  createdAt: string;
  user: { id: number; username: string; isBanned: boolean };
};

type Pagination = { total: number; page: number; limit: number; pages: number };

const STATUS_TABS = ["pending", "approved", "dismissed"] as const;
type StatusTab = typeof STATUS_TABS[number];

const APPEAL_TABS = ["pending", "approved", "rejected"] as const;
type AppealTab = typeof APPEAL_TABS[number];

type SectionTab = "reports" | "appeals";

// ---------------------------------------------------------------------------
// ReportCard
// ---------------------------------------------------------------------------
function ReportCard({ report, onAction }: { report: ReportItem; onAction: () => void }) {
  const [acting, setActing] = useState(false);
  const [contentActing, setContentActing] = useState(false);
  const isUserReport = !!report.reportedUser && !report.post && !report.thread;

  const act = async (action: "approve" | "dismiss") => {
    setActing(true);
    try {
      await apiFetch(`/api/admin/reports/${report.id}/${action}`, { method: "POST" });
      onAction();
    } catch {
      // keep acting=false so buttons re-enable
    } finally {
      setActing(false);
    }
  };

  const actOnContent = async () => {
    setContentActing(true);
    try {
      if (report.post) {
        await apiFetch(`/api/posts/${report.post.id}`, { method: "DELETE" });
      } else if (report.thread) {
        await apiFetch(`/api/threads/${report.thread.id}`, { method: "DELETE" });
      }
      onAction();
    } catch {
      // ignore
    } finally {
      setContentActing(false);
    }
  };

  const toxicityColor =
    report.aiScore == null
      ? "text-muted-foreground"
      : report.aiScore >= 0.7
      ? "text-[var(--sd-danger)]"
      : report.aiScore >= 0.4
      ? "text-yellow-500"
      : "text-green-500";

  const targetLabel = report.post
    ? "Post"
    : report.thread
    ? "Thread"
    : report.reportedUser
    ? "User"
    : "Unknown";

  const targetIcon =
    report.post ? <MessageSquare className="h-3.5 w-3.5" /> :
    report.thread ? <FileText className="h-3.5 w-3.5" /> :
    <User className="h-3.5 w-3.5" />;

  return (
    <div className="rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-4 sm:p-5 space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-[var(--sd-surface-raised)] px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {targetIcon}
            {targetLabel} Report
          </span>
          {report.aiScore != null && (
            <span className={`font-display text-[10px] font-bold uppercase tracking-widest ${toxicityColor}`}>
              {Math.round(report.aiScore * 100)}% toxic
            </span>
          )}
        </div>
        <span className="font-body text-xs text-muted-foreground flex-shrink-0">
          {formatDistanceShort(report.createdAt)}
        </span>
      </div>

      {/* Reported content preview */}
      {report.post && (
        <div className="rounded-lg border border-[var(--sd-border-subtle)] bg-[var(--sd-surface-raised)] px-3 py-2">
          <p className="font-body text-xs text-muted-foreground mb-1">Reported post content:</p>
          <p className="font-body text-sm line-clamp-3 whitespace-pre-wrap">{report.post.content}</p>
          <Link
            href={`/forums/${report.thread?.teamId ?? 0}/${report.post.threadId}#post-${report.post.id}`}
            className="mt-1 inline-block font-body text-xs text-[var(--sd-accent)] hover:underline"
          >
            View post →
          </Link>
        </div>
      )}

      {report.thread && !report.post && (
        <div className="rounded-lg border border-[var(--sd-border-subtle)] bg-[var(--sd-surface-raised)] px-3 py-2">
          <p className="font-body text-xs text-muted-foreground mb-1">Reported thread:</p>
          <p className="font-display text-sm font-bold uppercase tracking-tight">{report.thread.title}</p>
          <Link
            href={`/forums/${report.thread.teamId}/${report.thread.id}`}
            className="mt-1 inline-block font-body text-xs text-[var(--sd-accent)] hover:underline"
          >
            View thread →
          </Link>
        </div>
      )}

      {report.reportedUser && (
        <div className="rounded-lg border border-[var(--sd-border-subtle)] bg-[var(--sd-surface-raised)] px-3 py-2">
          <p className="font-body text-xs text-muted-foreground mb-1">Reported user:</p>
          <div className="flex items-center gap-2">
            <Link
              href={`/users/${report.reportedUser.id}`}
              className="font-display text-sm font-bold uppercase tracking-tight hover:underline text-[var(--sd-accent)]"
            >
              {report.reportedUser.username}
            </Link>
            {report.reportedUser.isBanned && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 uppercase tracking-widest">Banned</Badge>
            )}
          </div>
        </div>
      )}

      {/* Reason */}
      <div>
        <p className="font-display text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Reason</p>
        <p className="font-body text-sm">{report.reason}</p>
      </div>

      {/* AI verdict */}
      {report.aiVerdict && (
        <div className="rounded-lg border border-[var(--sd-border-subtle)] bg-[var(--sd-surface-raised)] px-3 py-2">
          <p className="font-display text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">AI Verdict</p>
          <p className="font-body text-xs">{report.aiVerdict}</p>
        </div>
      )}

      {/* Reporter */}
      <p className="font-body text-xs text-muted-foreground">
        Reported by{" "}
        <Link href={`/users/${report.reporter.id}`} className="font-semibold text-foreground hover:underline">
          {report.reporter.username}
        </Link>
      </p>

      {/* Actions */}
      <div className="space-y-2 pt-1">
        {/* Content delete — only for post/thread reports */}
        {!isUserReport && (report.post || report.thread) && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={actOnContent}
              disabled={contentActing}
              className="gap-1.5 border-[var(--sd-danger)]/40 text-[var(--sd-danger)] hover:bg-[var(--sd-danger)]/10 font-display font-semibold uppercase tracking-wide text-xs"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {report.post ? "Delete Post" : "Delete Thread"}
            </Button>
          </div>
        )}

        {/* Report status actions — pending only */}
        {report.status === "pending" && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => act("approve")}
              disabled={acting}
              className="gap-1.5 bg-[var(--sd-danger)] text-white hover:bg-[var(--sd-danger)]/90 font-display font-semibold uppercase tracking-wide text-xs"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              {isUserReport ? "Approve & Ban" : "Approve & Hide"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => act("dismiss")}
              disabled={acting}
              className="gap-1.5 font-display font-semibold uppercase tracking-wide text-xs"
            >
              <XCircle className="h-3.5 w-3.5" />
              Dismiss
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AppealCard
// ---------------------------------------------------------------------------
function AppealCard({ appeal, onAction }: { appeal: AppealItem; onAction: () => void }) {
  const [acting, setActing] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectMsg, setRejectMsg] = useState("");

  const approve = async () => {
    setActing(true);
    try {
      await apiFetch(`/api/admin/appeals/${appeal.id}/approve`, { method: "POST" });
      onAction();
    } catch {
      setActing(false);
    }
  };

  const reject = async () => {
    setActing(true);
    try {
      await apiFetch(`/api/admin/appeals/${appeal.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ message: rejectMsg }),
      });
      onAction();
    } catch {
      setActing(false);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-4 sm:p-5 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-[var(--sd-surface-raised)] px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <Gavel className="h-3.5 w-3.5" />
            Ban Appeal
          </span>
          {appeal.status !== "pending" && (
            <Badge
              className={`uppercase tracking-widest text-[10px] px-2 py-0.5 ${
                appeal.status === "approved"
                  ? "bg-green-500/10 text-green-600 border-green-500/20"
                  : "bg-[var(--sd-danger)]/10 text-[var(--sd-danger)] border-[var(--sd-danger)]/20"
              }`}
            >
              {appeal.status}
            </Badge>
          )}
        </div>
        <span className="font-body text-xs text-muted-foreground flex-shrink-0">
          {formatDistanceShort(appeal.createdAt)}
        </span>
      </div>

      {/* User info */}
      <div className="rounded-lg border border-[var(--sd-border-subtle)] bg-[var(--sd-surface-raised)] px-3 py-2">
        <p className="font-body text-xs text-muted-foreground mb-1">Banned user:</p>
        <div className="flex items-center gap-2">
          <Link
            href={`/users/${appeal.user.id}`}
            className="font-display text-sm font-bold uppercase tracking-tight hover:underline text-[var(--sd-accent)]"
          >
            {appeal.user.username}
          </Link>
          {appeal.user.isBanned && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 uppercase tracking-widest">Banned</Badge>
          )}
        </div>
      </div>

      {/* Appeal reason */}
      <div>
        <p className="font-display text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Appeal Reason</p>
        <p className="font-body text-sm whitespace-pre-wrap">{appeal.reason}</p>
      </div>

      {/* Admin message if rejected */}
      {appeal.status === "rejected" && appeal.adminMessage && (
        <div className="rounded-lg border border-[var(--sd-border-subtle)] bg-[var(--sd-surface-raised)] px-3 py-2">
          <p className="font-display text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Denial Message</p>
          <p className="font-body text-sm">{appeal.adminMessage}</p>
        </div>
      )}

      {/* Actions — pending only */}
      {appeal.status === "pending" && (
        <div className="space-y-2 pt-1">
          {!showReject ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={approve}
                disabled={acting}
                className="gap-1.5 bg-green-600 text-white hover:bg-green-600/90 font-display font-semibold uppercase tracking-wide text-xs"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Approve & Unban
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowReject(true)}
                disabled={acting}
                className="gap-1.5 font-display font-semibold uppercase tracking-wide text-xs"
              >
                <XCircle className="h-3.5 w-3.5" />
                Deny
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <label className="font-display text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">
                  Denial Message (optional)
                </label>
                <textarea
                  value={rejectMsg}
                  onChange={(e) => setRejectMsg(e.target.value)}
                  placeholder="Explain why the appeal was denied…"
                  rows={3}
                  className="w-full rounded-lg border border-[var(--sd-border-subtle)] bg-[var(--sd-surface-raised)] px-3 py-2 font-body text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[var(--sd-accent)] placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={reject}
                  disabled={acting}
                  className="gap-1.5 bg-[var(--sd-danger)] text-white hover:bg-[var(--sd-danger)]/90 font-display font-semibold uppercase tracking-wide text-xs"
                >
                  Confirm Denial
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowReject(false)}
                  disabled={acting}
                  className="font-display font-semibold uppercase tracking-wide text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reports section
// ---------------------------------------------------------------------------
function ReportsSection() {
  const [activeTab, setActiveTab] = useState<StatusTab>("pending");
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ reports: ReportItem[]; pagination: Pagination }>(
        `/api/admin/reports?status=${activeTab}&page=${page}&limit=20`
      );
      setReports(data.reports);
      setPagination(data.pagination);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [activeTab]);

  const tabIcon = (tab: StatusTab) =>
    tab === "pending" ? <Clock className="h-3.5 w-3.5" /> :
    tab === "approved" ? <CheckCircle className="h-3.5 w-3.5" /> :
    <XCircle className="h-3.5 w-3.5" />;

  return (
    <>
      <div className="flex gap-1 mb-6 border-b border-[var(--sd-border-subtle)]">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 font-display text-[10px] font-bold uppercase tracking-widest transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-[var(--sd-accent)] text-[var(--sd-accent)]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tabIcon(tab)}
            {tab}
            {pagination && activeTab === tab && (
              <span className="ml-1 rounded-full bg-[var(--sd-surface-raised)] px-1.5 py-0.5 text-[9px]">
                {pagination.total}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <AlertTriangle className="h-8 w-8 text-muted-foreground opacity-40" />
          <p className="font-body text-sm text-muted-foreground">No {activeTab} reports.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((r) => (
            <ReportCard key={r.id} report={r} onAction={load} />
          ))}
        </div>
      )}

      {pagination && pagination.pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || loading} className="font-display font-semibold uppercase tracking-wide text-xs">Prev</Button>
          <span className="font-body text-sm text-muted-foreground">{page} / {pagination.pages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages || loading} className="font-display font-semibold uppercase tracking-wide text-xs">Next</Button>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Appeals section
// ---------------------------------------------------------------------------
function AppealsSection() {
  const [activeTab, setActiveTab] = useState<AppealTab>("pending");
  const [appeals, setAppeals] = useState<AppealItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ appeals: AppealItem[]; pagination: Pagination }>(
        `/api/admin/appeals?status=${activeTab}&page=${page}&limit=20`
      );
      setAppeals(data.appeals);
      setPagination(data.pagination);
    } catch {
      setAppeals([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [activeTab]);

  const tabIcon = (tab: AppealTab) =>
    tab === "pending" ? <Clock className="h-3.5 w-3.5" /> :
    tab === "approved" ? <CheckCircle className="h-3.5 w-3.5" /> :
    <XCircle className="h-3.5 w-3.5" />;

  return (
    <>
      <div className="flex gap-1 mb-6 border-b border-[var(--sd-border-subtle)]">
        {APPEAL_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 font-display text-[10px] font-bold uppercase tracking-widest transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-[var(--sd-accent)] text-[var(--sd-accent)]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tabIcon(tab)}
            {tab}
            {pagination && activeTab === tab && (
              <span className="ml-1 rounded-full bg-[var(--sd-surface-raised)] px-1.5 py-0.5 text-[9px]">
                {pagination.total}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : appeals.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <AlertTriangle className="h-8 w-8 text-muted-foreground opacity-40" />
          <p className="font-body text-sm text-muted-foreground">No {activeTab} appeals.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {appeals.map((a) => (
            <AppealCard key={a.id} appeal={a} onAction={load} />
          ))}
        </div>
      )}

      {pagination && pagination.pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || loading} className="font-display font-semibold uppercase tracking-wide text-xs">Prev</Button>
          <span className="font-body text-sm text-muted-foreground">{page} / {pagination.pages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages || loading} className="font-display font-semibold uppercase tracking-wide text-xs">Next</Button>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Admin page root
// ---------------------------------------------------------------------------
export default function AdminPage() {
  const [section, setSection] = useState<SectionTab>("reports");

  return (
    <AdminRoute>
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-6 w-6 text-[var(--sd-accent)]" />
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">
            Moderation
          </h1>
        </div>

        {/* Section switcher */}
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setSection("reports")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-display text-xs font-bold uppercase tracking-widest transition-colors ${
              section === "reports"
                ? "bg-[var(--sd-accent)] text-white"
                : "bg-[var(--sd-surface-raised)] text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Reports
          </button>
          <button
            onClick={() => setSection("appeals")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-display text-xs font-bold uppercase tracking-widest transition-colors ${
              section === "appeals"
                ? "bg-[var(--sd-accent)] text-white"
                : "bg-[var(--sd-surface-raised)] text-muted-foreground hover:text-foreground"
            }`}
          >
            <Gavel className="h-3.5 w-3.5" />
            Appeals
          </button>
        </div>

        {section === "reports" ? <ReportsSection /> : <AppealsSection />}
      </div>
    </AdminRoute>
  );
}

