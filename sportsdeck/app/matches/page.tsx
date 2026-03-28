// Prompt: Build the Matches page — matchday browser with prev/next navigation,
// status filter tabs (All, Finished, Scheduled, Live), match cards showing
// team crests, names, scores, dates, and status badges. Links to match detail.
// Fetches from GET /api/matches?matchday=N. Loading skeletons while fetching.
// Claude claude-4.6-opus-high-thinking

"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Calendar, Clock } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { Match, MatchStatus } from "@/types";

type StatusFilter = "ALL" | "FINISHED" | "SCHEDULED" | "LIVE";

const STATUS_LABELS: Record<MatchStatus, { label: string; className: string }> = {
  FINISHED: { label: "FT", className: "badge-accent" },
  IN_PLAY: { label: "LIVE", className: "bg-[var(--sd-danger)] text-white" },
  PAUSED: { label: "HT", className: "bg-[var(--sd-danger)] text-white" },
  SCHEDULED: { label: "Upcoming", className: "bg-[var(--sd-surface-raised)] text-muted-foreground" },
  TIMED: { label: "Upcoming", className: "bg-[var(--sd-surface-raised)] text-muted-foreground" },
  POSTPONED: { label: "PPD", className: "badge-danger" },
  SUSPENDED: { label: "SUSP", className: "badge-danger" },
  CANCELLED: { label: "CANC", className: "badge-danger" },
};

const FILTER_TABS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "FINISHED", label: "Results" },
  { value: "SCHEDULED", label: "Upcoming" },
  { value: "LIVE", label: "Live" },
];

function TeamCrest({ url, name }: { url?: string | null; name: string }) {
  if (!url) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--sd-accent-muted)]">
        <span className="font-display text-xs font-bold text-[var(--sd-accent)]">
          {name.slice(0, 3).toUpperCase()}
        </span>
      </div>
    );
  }
  return (
    <Image
      src={url}
      alt={name}
      width={40}
      height={40}
      className="h-10 w-10 object-contain"
    />
  );
}

function MatchCard({ match }: { match: Match }) {
  const home = match.homeTeam!;
  const away = match.awayTeam!;
  const isFinished = match.status === "FINISHED";
  const isLive = match.status === "IN_PLAY" || match.status === "PAUSED";
  const statusInfo = STATUS_LABELS[match.status];

  return (
    <Link
      href={`/matches/${match.id}`}
      className="card-hover block rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-4 transition-colors hover:bg-[var(--sd-surface-raised)]"
    >
      <div className="flex items-center justify-between gap-4">
        {/* Home team */}
        <div className="flex flex-1 items-center gap-3 justify-end">
          <span className="text-right font-display text-sm font-semibold uppercase tracking-tight sm:text-base">
            {home.shortName}
          </span>
          <TeamCrest url={home.crestUrl} name={home.shortName} />
        </div>

        {/* Score / Status */}
        <div className="flex flex-col items-center gap-1 min-w-[80px]">
          {isFinished || isLive ? (
            <div className="flex items-center gap-2">
              <span className="font-display text-2xl font-extrabold tabular-nums">
                {match.homeScore ?? 0}
              </span>
              <span className="text-muted-foreground text-sm">–</span>
              <span className="font-display text-2xl font-extrabold tabular-nums">
                {match.awayScore ?? 0}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span className="font-body text-xs">
                {new Date(match.utcDate).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusInfo.className}`}
          >
            {isLive && (
              <span className="mr-1 h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
            )}
            {statusInfo.label}
          </span>
        </div>

        {/* Away team */}
        <div className="flex flex-1 items-center gap-3">
          <TeamCrest url={away.crestUrl} name={away.shortName} />
          <span className="font-display text-sm font-semibold uppercase tracking-tight sm:text-base">
            {away.shortName}
          </span>
        </div>
      </div>

      {/* Date row */}
      <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Calendar className="h-3 w-3" />
        <span className="font-body">{formatDate(match.utcDate)}</span>
      </div>
    </Link>
  );
}

function MatchCardSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3 justify-end">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
        <div className="flex flex-col items-center gap-1 min-w-[80px]">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-4 w-14 rounded-full" />
        </div>
        <div className="flex flex-1 items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      <div className="mt-3 flex justify-center">
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchday, setMatchday] = useState<number | null>(null);
  const [currentMatchday, setCurrentMatchday] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = useCallback(async (md: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ matches: Match[] }>(
        `/api/matches?matchday=${md}&limit=20`
      );
      setMatches(res.matches);
    } catch {
      setError("Failed to load matches. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const res = await apiFetch<{ matches: Match[] }>(
          "/api/matches?limit=1"
        );
        const first = res.matches[0];
        const md = first?.matchday ?? first?.season?.currentMatchday ?? 1;
        setCurrentMatchday(md);
        setMatchday(md);
      } catch {
        setMatchday(1);
        setCurrentMatchday(1);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (matchday !== null) fetchMatches(matchday);
  }, [matchday, fetchMatches]);

  const filteredMatches = matches.filter((m) => {
    if (statusFilter === "ALL") return true;
    if (statusFilter === "FINISHED") return m.status === "FINISHED";
    if (statusFilter === "SCHEDULED")
      return m.status === "SCHEDULED" || m.status === "TIMED";
    if (statusFilter === "LIVE")
      return m.status === "IN_PLAY" || m.status === "PAUSED";
    return true;
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-8">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.25em] text-[var(--sd-accent)] mb-2">
          Premier League
        </p>
        <h1 className="font-display text-4xl font-extrabold uppercase tracking-tight sm:text-5xl">
          Matches
        </h1>
      </div>

      {/* Matchday browser */}
      <div className="mb-6 flex items-center justify-between rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          disabled={matchday === null || matchday <= 1}
          onClick={() => setMatchday((prev) => Math.max(1, (prev ?? 1) - 1))}
          className="text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <p className="font-display text-lg font-bold uppercase tracking-tight">
            Matchday {matchday ?? "—"}
          </p>
          {matchday === currentMatchday && (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sd-accent)]">
              Current
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          disabled={matchday === null || matchday >= 38}
          onClick={() => setMatchday((prev) => Math.min(38, (prev ?? 38) + 1))}
          className="text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="mb-6 flex gap-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
              statusFilter === tab.value
                ? "bg-[var(--sd-accent)] text-[var(--sd-bg)]"
                : "bg-[var(--sd-surface)] text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Match list */}
      {error && (
        <div className="rounded-xl border border-[var(--sd-danger)]/20 bg-[var(--sd-danger-muted)] p-6 text-center">
          <p className="font-body text-sm text-[var(--sd-danger)]">{error}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => matchday && fetchMatches(matchday)}
            className="mt-3 text-[var(--sd-danger)]"
          >
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <MatchCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-12 text-center">
          <p className="font-display text-lg font-bold uppercase tracking-tight text-muted-foreground">
            No matches found
          </p>
          <p className="mt-2 font-body text-sm text-muted-foreground">
            {statusFilter !== "ALL"
              ? "Try a different filter or matchday."
              : "No matches on this matchday yet."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredMatches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </div>
  );
}
