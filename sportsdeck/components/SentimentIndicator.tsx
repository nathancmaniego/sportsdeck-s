"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SentimentMood } from "@/types";

export type ThreadSentimentResponse = {
  threadId: number;
  overallMood: SentimentMood;
  homeTeamMood: string | null;
  awayTeamMood: string | null;
  calculatedAt: string;
  cached?: boolean;
};

function moodLabel(mood: string): string {
  return mood.charAt(0).toUpperCase() + mood.slice(1);
}

function moodBadgeClass(mood: string): string {
  switch (mood) {
    case "positive":
      return "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "negative":
      return "border-[var(--sd-danger)]/40 bg-[var(--sd-danger-muted)] text-[var(--sd-danger)]";
    case "mixed":
      return "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-200";
    case "neutral":
    default:
      return "border-[var(--sd-border-subtle)] bg-[var(--sd-surface-raised)] text-muted-foreground";
  }
}

function MoodBadge({ mood }: { mood: string }) {
  return (
    <Badge
      variant="outline"
      className={`font-body text-xs font-semibold capitalize ${moodBadgeClass(mood)}`}
    >
      {moodLabel(mood)}
    </Badge>
  );
}

type SentimentIndicatorProps = {
  threadId: number;
  /** When set, show home / away fan breakdown (match threads). */
  homeTeamShort?: string | null;
  awayTeamShort?: string | null;
  /** Tighter layout for match detail card. */
  compact?: boolean;
  className?: string;
};

export default function SentimentIndicator({
  threadId,
  homeTeamShort,
  awayTeamShort,
  compact,
  className = "",
}: SentimentIndicatorProps) {
  const [data, setData] = useState<ThreadSentimentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showTeams = Boolean(homeTeamShort && awayTeamShort);

  const load = useCallback(
    async (refresh: boolean) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const q = refresh ? "?refresh=true" : "";
        const res = await apiFetch<ThreadSentimentResponse>(
          `/api/threads/${threadId}/sentiment${q}`
        );
        setData(res);
      } catch {
        setError("Could not load sentiment.");
        setData(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [threadId]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const wrap = compact ? "rounded-lg border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-3" : "rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-4 sm:p-5";

  if (loading) {
    return (
      <div className={`${wrap} ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-6 w-28 rounded-full" />
        {showTeams && (
          <div className="mt-3 space-y-2">
            <Skeleton className="h-5 w-full max-w-xs" />
            <Skeleton className="h-5 w-full max-w-xs" />
          </div>
        )}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={`${wrap} ${className}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-body text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={() => load(false)} className="font-body text-xs">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${wrap} ${className}`} aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 text-[var(--sd-accent)]">
          <Sparkles className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"}`} aria-hidden />
          <span
            className={`font-display font-bold uppercase tracking-widest text-[var(--sd-accent)] ${
              compact ? "text-[10px]" : "text-xs"
            }`}
          >
            Thread sentiment
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={refreshing}
          onClick={() => load(true)}
          className="h-8 gap-1.5 font-body text-xs text-muted-foreground hover:text-foreground"
          title="Re-run analysis on latest posts (may take a few seconds)"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Analyzing…" : "Refresh"}
        </Button>
      </div>

      <div className={compact ? "space-y-2" : "space-y-3"}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-body text-xs text-muted-foreground shrink-0">Overall</span>
          <MoodBadge mood={data.overallMood} />
        </div>

        {showTeams && (
          <div
            className={`grid gap-2 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 gap-3 pt-1 border-t border-[var(--sd-border-subtle)]"}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-body text-xs text-muted-foreground min-w-0">
                {homeTeamShort} fans
              </span>
              {data.homeTeamMood ? (
                <MoodBadge mood={data.homeTeamMood} />
              ) : (
                <span className="font-body text-xs text-muted-foreground italic">No posts yet</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-body text-xs text-muted-foreground min-w-0">
                {awayTeamShort} fans
              </span>
              {data.awayTeamMood ? (
                <MoodBadge mood={data.awayTeamMood} />
              ) : (
                <span className="font-body text-xs text-muted-foreground italic">No posts yet</span>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 font-body text-[10px] text-muted-foreground">
        Based on recent posts
        {data.cached ? " (cached)" : ""}
        {" · "}
        <time dateTime={data.calculatedAt}>
          {new Date(data.calculatedAt).toLocaleString(undefined, {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </time>
      </p>
    </div>
  );
}
