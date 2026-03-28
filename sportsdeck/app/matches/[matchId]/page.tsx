// Prompt: Build the Match Detail page — large score hero with team crests and names,
// half-time score, match info (date, matchday, venue, status), and a link to the
// match thread if one exists. Fetches from GET /api/matches/[id]. Back button to
// /matches. Loading skeleton while fetching. Responsive layout.
// Claude claude-4.6-opus-high-thinking

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Calendar, MapPin, MessageSquare, Hash } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { Match, MatchStatus } from "@/types";

const STATUS_DISPLAY: Record<MatchStatus, { label: string; className: string }> = {
  FINISHED: { label: "Full Time", className: "badge-accent" },
  IN_PLAY: { label: "Live", className: "bg-[var(--sd-danger)] text-white" },
  PAUSED: { label: "Half Time", className: "bg-[var(--sd-danger)] text-white" },
  SCHEDULED: { label: "Scheduled", className: "bg-[var(--sd-surface-raised)] text-muted-foreground" },
  TIMED: { label: "Scheduled", className: "bg-[var(--sd-surface-raised)] text-muted-foreground" },
  POSTPONED: { label: "Postponed", className: "badge-danger" },
  SUSPENDED: { label: "Suspended", className: "badge-danger" },
  CANCELLED: { label: "Cancelled", className: "badge-danger" },
};

function TeamCrest({ url, name }: { url?: string | null; name: string }) {
  if (!url) {
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--sd-accent-muted)] sm:h-20 sm:w-20">
        <span className="font-display text-lg font-bold text-[var(--sd-accent)]">
          {name.slice(0, 3).toUpperCase()}
        </span>
      </div>
    );
  }
  return (
    <Image
      src={url}
      alt={name}
      width={80}
      height={80}
      className="h-16 w-16 object-contain sm:h-20 sm:w-20"
    />
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Skeleton className="h-5 w-28 mb-8" />
      <div className="rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col items-center gap-3 flex-1">
            <Skeleton className="h-20 w-20 rounded-xl" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="h-12 w-24" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="flex flex-col items-center gap-3 flex-1">
            <Skeleton className="h-20 w-20 rounded-xl" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    </div>
  );
}

export default function MatchDetailPage() {
  const params = useParams();
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<{ match: Match }>(
          `/api/matches/${params.matchId}`
        );
        setMatch(res.match);
      } catch {
        setError("Failed to load match details.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.matchId]);

  if (loading) return <DetailSkeleton />;

  if (error || !match) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/matches"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="font-body">Back to Matches</span>
        </Link>
        <div className="rounded-xl border border-[var(--sd-danger)]/20 bg-[var(--sd-danger-muted)] p-12 text-center">
          <p className="font-display text-xl font-bold uppercase tracking-tight text-[var(--sd-danger)]">
            Match not found
          </p>
          <p className="mt-2 font-body text-sm text-muted-foreground">
            {error ?? "This match doesn't exist or has been removed."}
          </p>
        </div>
      </div>
    );
  }

  const home = match.homeTeam!;
  const away = match.awayTeam!;
  const isFinished = match.status === "FINISHED";
  const isLive = match.status === "IN_PLAY" || match.status === "PAUSED";
  const hasScore = isFinished || isLive;
  const statusInfo = STATUS_DISPLAY[match.status];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        href="/matches"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="font-body">Back to Matches</span>
      </Link>

      {/* Score hero */}
      <div className="rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-6 sm:p-8">
        {/* Status badge */}
        <div className="flex justify-center mb-6">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${statusInfo.className}`}
          >
            {isLive && (
              <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
            )}
            {statusInfo.label}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 sm:gap-8">
          {/* Home team */}
          <div className="flex flex-1 flex-col items-center gap-3 text-center">
            <TeamCrest url={home.crestUrl} name={home.shortName} />
            <div>
              <p className="font-display text-base font-bold uppercase tracking-tight sm:text-lg">
                {home.shortName}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {home.tla}
              </p>
            </div>
          </div>

          {/* Score */}
          <div className="flex flex-col items-center gap-2">
            {hasScore ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="font-display text-4xl font-extrabold tabular-nums sm:text-5xl">
                    {match.homeScore ?? 0}
                  </span>
                  <span className="text-muted-foreground text-xl">–</span>
                  <span className="font-display text-4xl font-extrabold tabular-nums sm:text-5xl">
                    {match.awayScore ?? 0}
                  </span>
                </div>
                {(match.halfTimeHome !== null || match.halfTimeAway !== null) && (
                  <p className="text-xs text-muted-foreground font-body">
                    HT: {match.halfTimeHome ?? 0} – {match.halfTimeAway ?? 0}
                  </p>
                )}
              </>
            ) : (
              <p className="font-display text-2xl font-bold text-muted-foreground uppercase">
                vs
              </p>
            )}
          </div>

          {/* Away team */}
          <div className="flex flex-1 flex-col items-center gap-3 text-center">
            <TeamCrest url={away.crestUrl} name={away.shortName} />
            <div>
              <p className="font-display text-base font-bold uppercase tracking-tight sm:text-lg">
                {away.shortName}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {away.tla}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Match info cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Calendar className="h-4 w-4" />
            <span className="font-display text-xs font-semibold uppercase tracking-wider">
              Date & Time
            </span>
          </div>
          <p className="font-body text-sm">{formatDate(match.utcDate)}</p>
        </div>

        <div className="rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Hash className="h-4 w-4" />
            <span className="font-display text-xs font-semibold uppercase tracking-wider">
              Matchday
            </span>
          </div>
          <p className="font-body text-sm">
            Matchday {match.matchday ?? "—"}
            {match.seasonLabel && (
              <span className="text-muted-foreground"> · {match.seasonLabel}</span>
            )}
          </p>
        </div>

        {home.venue && (
          <div className="rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <MapPin className="h-4 w-4" />
              <span className="font-display text-xs font-semibold uppercase tracking-wider">
                Venue
              </span>
            </div>
            <p className="font-body text-sm">{home.venue}</p>
          </div>
        )}

        {match.thread && (
          <Link
            href={`/forums/${home.id}/${match.thread.id}`}
            className="card-hover rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-4 transition-colors hover:bg-[var(--sd-surface-raised)]"
          >
            <div className="flex items-center gap-2 text-[var(--sd-accent)] mb-2">
              <MessageSquare className="h-4 w-4" />
              <span className="font-display text-xs font-semibold uppercase tracking-wider">
                Match Thread
              </span>
            </div>
            <p className="font-body text-sm">
              Join the discussion for this match
            </p>
          </Link>
        )}
      </div>
    </div>
  );
}
