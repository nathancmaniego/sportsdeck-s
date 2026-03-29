// Prompt: Team Forum page — threads for one team with match / fan filters.
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, MessageSquare } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ForumThreadCard } from "@/components/ForumThreadCard";
import type { ThreadCategoryFilter } from "@/lib/threadDisplay";
import type { Thread, Team, Match } from "@/types";

type ThreadWithDetails = Thread & {
  author?: { username: string; avatar?: string | null };
  match?: Match | null;
  _count?: { posts: number };
};

export default function TeamForumPage() {
  const params = useParams();
  const teamId = params.teamId as string;
  const { user } = useAuth();
  const [threads, setThreads] = useState<ThreadWithDetails[]>([]);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<"" | "open" | "closed">("");
  const [threadCategory, setThreadCategory] =
    useState<ThreadCategoryFilter>("");

  const loadTeam = useCallback(async () => {
    if (teamId === "general") {
      setTeam(null);
      return;
    }
    try {
      const data = await apiFetch<Team>(`/api/teams/${teamId}`);
      setTeam(data);
    } catch {
      setTeam(null);
    }
  }, [teamId]);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (teamId !== "general") {
        params.set("teamId", teamId);
      }
      if (selectedStatus) {
        params.set("status", selectedStatus);
      }
      if (threadCategory) {
        params.set("threadCategory", threadCategory);
      }

      const data = await apiFetch<ThreadWithDetails[]>(
        `/api/threads?${params.toString()}`
      );
      setThreads(data);
    } catch {
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, [teamId, selectedStatus, threadCategory]);

  useEffect(() => {
    loadTeam();
    loadThreads();
  }, [loadTeam, loadThreads]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/forums"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-[var(--sd-accent)] font-body mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to all forums
      </Link>

      <header className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          {team?.crestUrl && (
            <img
              src={team.crestUrl}
              alt={team.shortName}
              className="h-12 w-12 object-contain shrink-0"
            />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[var(--sd-accent)] mb-1">
              <MessageSquare className="h-4 w-4 shrink-0" />
              <span className="font-display text-xs font-bold uppercase tracking-widest">
                Forum
              </span>
            </div>
            <h1 className="font-display text-2xl font-extrabold uppercase tracking-tight sm:text-3xl truncate">
              {team ? team.shortName : "General Discussion"}
            </h1>
          </div>
        </div>
        {user && (
          <Link href="/threads/new" className="shrink-0">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Thread
            </Button>
          </Link>
        )}
      </header>

      <div className="mb-6 space-y-4 rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-4">
        <div>
          <span className="font-display text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">
            Thread type
          </span>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {(
              [
                { value: "" as const, label: "All" },
                { value: "match_finished" as const, label: "Match · finished" },
                {
                  value: "match_upcoming" as const,
                  label: "Match · upcoming & live",
                },
                { value: "community" as const, label: "Fan threads" },
              ] satisfies { value: ThreadCategoryFilter; label: string }[]
            ).map(({ value, label }) => (
              <label
                key={value || "all"}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-body sm:text-sm ${
                  threadCategory === value
                    ? "border-[var(--sd-accent)] bg-[var(--sd-accent)]/10"
                    : "border-[var(--sd-border-subtle)] bg-[var(--sd-surface-raised)]"
                }`}
              >
                <input
                  type="radio"
                  name="teamThreadCat"
                  className="sr-only"
                  checked={threadCategory === value}
                  onChange={() => setThreadCategory(value)}
                />
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    threadCategory === value
                      ? "bg-[var(--sd-accent)]"
                      : "bg-muted-foreground/30"
                  }`}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-body text-sm text-muted-foreground">Show</span>
          <select
            value={selectedStatus}
            onChange={(e) =>
              setSelectedStatus(e.target.value as "" | "open" | "closed")
            }
            className="rounded-lg border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] px-3 py-2 text-sm font-body"
          >
            <option value="">All threads</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : threads.length === 0 ? (
        <div className="rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-12 text-center">
          <p className="font-body text-muted-foreground">
            No threads yet. {user && "Be the first to start a discussion!"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {threads.map((thread) => (
            <ForumThreadCard
              key={thread.id}
              thread={thread}
              threadHref={`/forums/${teamId}/${thread.id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
