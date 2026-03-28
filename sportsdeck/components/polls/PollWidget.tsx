// Prompt: PollWidget — fetch GET /api/polls/[id], show question, deadline, option
// rows with result bars, vote when authenticated and poll open. POST vote to
// /api/polls/[id]/vote (upsert — user can change vote until deadline). Design tokens only.
// Claude claude-4.6-opus-high-thinking

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Clock, BarChart3, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getPoll, votePoll } from "@/lib/api";
import { cn, formatDate, formatDistanceShort } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { PollDetail, PollGetResponse, PollOptionResult } from "@/types";

function mergeVoteResults(
  poll: PollDetail,
  results: PollOptionResult[],
  totalVotes: number,
  userVoteOptionId: number
): PollGetResponse {
  return {
    poll: {
      ...poll,
      totalVotes,
      options: results,
    },
    userVote: userVoteOptionId,
  };
}

export default function PollWidget({
  pollId,
  className,
}: {
  pollId: number;
  className?: string;
}) {
  const { user } = useAuth();
  const [data, setData] = useState<PollGetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPoll(pollId);
      setData(res);
      setSelectedOptionId(res.userVote ?? null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load poll";
      toast.error(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [pollId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleVote = async () => {
    if (selectedOptionId == null || !data) return;
    setVoting(true);
    try {
      const res = await votePoll(pollId, selectedOptionId);
      setData(
        mergeVoteResults(
          data.poll,
          res.results,
          res.totalVotes,
          res.selectedOptionId
        )
      );
      toast.success(
        data.userVote === null ? "Vote recorded" : "Vote updated"
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Vote failed";
      toast.error(msg);
    } finally {
      setVoting(false);
    }
  };

  if (loading) {
    return (
      <Card
        className={cn(
          "border-[var(--sd-border-subtle)] bg-[var(--sd-surface)]",
          className
        )}
      >
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-full max-w-md" />
          <Skeleton className="h-3 w-40 mt-2" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { poll, userVote } = data;
  const showBars =
    poll.isClosed || userVote !== null || poll.totalVotes > 0;
  const canSubmit =
    !!user &&
    !poll.isClosed &&
    selectedOptionId != null &&
    (userVote === null || selectedOptionId !== userVote);

  return (
    <Card
      className={cn(
        "card-hover border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] overflow-hidden",
        className
      )}
    >
      <CardHeader className="pb-2 border-b border-[var(--sd-border-subtle)]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-[var(--sd-accent)]">
            <BarChart3 className="h-4 w-4 shrink-0" />
            <span className="font-display text-[10px] font-bold uppercase tracking-widest">
              Poll
            </span>
          </div>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              poll.isClosed
                ? "bg-[var(--sd-surface-raised)] text-muted-foreground"
                : "badge-accent"
            )}
          >
            {poll.isClosed ? "Closed" : "Open"}
          </span>
        </div>
        <h3 className="font-display text-lg font-bold tracking-tight text-foreground pt-1">
          {poll.question}
        </h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground font-body">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(poll.deadline)}
          </span>
          {!poll.isClosed && (
            <span className="text-[var(--sd-accent)]">
              Closes {formatDistanceShort(poll.deadline)}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <ul className="space-y-2">
          {poll.options.map((opt) => {
            const isSelected = selectedOptionId === opt.id;
            const showYourVoteBadge =
              userVote === opt.id &&
              userVote !== null &&
              selectedOptionId === userVote;

            return (
              <li key={opt.id}>
                <button
                  type="button"
                  disabled={!user || poll.isClosed}
                  onClick={() => {
                    if (!user || poll.isClosed) return;
                    setSelectedOptionId(opt.id);
                  }}
                  className={cn(
                    "relative w-full rounded-lg border text-left transition-colors",
                    "border-[var(--sd-border-subtle)] bg-[var(--sd-surface-raised)]/50",
                    user &&
                      !poll.isClosed &&
                      "hover:border-[var(--sd-accent)] cursor-pointer",
                    (!user || poll.isClosed) && "cursor-default opacity-90",
                    isSelected &&
                      "ring-2 ring-[var(--sd-accent)] ring-offset-2 ring-offset-[var(--sd-surface)]"
                  )}
                >
                  {showBars && (
                    <div
                      className="absolute inset-y-0 left-0 rounded-l-lg bg-[var(--sd-accent-muted)] transition-all duration-300"
                      style={{ width: `${opt.percentage}%` }}
                      aria-hidden
                    />
                  )}
                  <div className="relative flex items-center justify-between gap-2 px-3 py-2.5">
                    <span className="font-body text-sm font-medium text-foreground">
                      {opt.text}
                      {showYourVoteBadge && (
                        <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--sd-accent)]">
                          Your vote
                        </span>
                      )}
                    </span>
                    {showBars && (
                      <span className="font-display text-xs font-bold tabular-nums text-[var(--sd-accent)] shrink-0">
                        {opt.percentage}%
                        <span className="text-muted-foreground font-body font-normal ml-1">
                          ({opt.votes})
                        </span>
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        {!user && !poll.isClosed && (
          <p className="text-center text-sm text-muted-foreground font-body">
            <Link
              href="/login"
              className="font-semibold text-[var(--sd-accent)] hover:underline"
            >
              Sign in
            </Link>{" "}
            to vote in this poll.
          </p>
        )}

        {user && !poll.isClosed && (
          <Button
            type="button"
            disabled={!canSubmit || voting}
            onClick={handleVote}
            className="w-full bg-[var(--sd-accent)] text-[var(--sd-bg)] hover:bg-[var(--sd-accent)]/90 font-display font-semibold uppercase tracking-wide text-xs"
          >
            {voting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : userVote !== null ? (
              "Update vote"
            ) : (
              "Submit vote"
            )}
          </Button>
        )}

        {userVote !== null && !poll.isClosed && (
          <p className="text-center text-xs text-muted-foreground font-body">
            Pick another option and press Update vote to change your choice.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
