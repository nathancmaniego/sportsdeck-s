// Prompt: Team Forum page — threads specific to one team
// Claude claude-4.6-opus-high-thinking
'use client'

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, MessageSquare } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatDistanceShort } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { Thread, Team, Tag } from "@/types";

type ThreadWithDetails = Thread & {
  author?: { username: string; avatar?: string | null };
  tags?: { tag: Tag }[];
  _count?: { posts: number };
};

export default function TeamForumPage() {
  const params = useParams();
  const teamId = params.teamId as string;
  const { user } = useAuth();
  const [threads, setThreads] = useState<ThreadWithDetails[]>([]);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

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

      const data = await apiFetch<ThreadWithDetails[]>(
        `/api/threads?${params.toString()}`
      );
      setThreads(data);
    } catch {
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

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

      {/* Header */}
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {team?.crestUrl && (
            <img
              src={team.crestUrl}
              alt={team.shortName}
              className="h-12 w-12 object-contain"
            />
          )}
          <div>
            <div className="flex items-center gap-2 text-[var(--sd-accent)] mb-1">
              <MessageSquare className="h-4 w-4" />
              <span className="font-display text-xs font-bold uppercase tracking-widest">
                Forum
              </span>
            </div>
            <h1 className="font-display text-2xl font-extrabold uppercase tracking-tight sm:text-3xl">
              {team ? team.shortName : "General Discussion"}
            </h1>
          </div>
        </div>
        {user && (
          <Link href="/threads/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Thread
            </Button>
          </Link>
        )}
      </header>

      {/* Thread List */}
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
            <Link
              key={thread.id}
              href={`/forums/${teamId}/${thread.id}`}
              className="card-hover block rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-5 transition-colors hover:bg-[var(--sd-surface-raised)]"
            >
              <h3 className="font-display text-lg font-bold uppercase tracking-tight mb-2">
                {thread.title}
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground font-body mb-3">
                <span className="font-semibold text-foreground">
                  {thread.author?.username || "Unknown"}
                </span>
                <span>·</span>
                <span>{formatDistanceShort(thread.createdAt)}</span>
                <span>·</span>
                <span>{thread._count?.posts || 0} posts</span>
              </div>
              {thread.tags && thread.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {thread.tags.map((t) => (
                    t.tag && (
                      <Badge key={t.tag.id} variant="secondary">
                        {t.tag.name}
                      </Badge>
                    )
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
