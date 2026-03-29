"use client";

import Link from "next/link";
import { Calendar } from "lucide-react";
import { ThreadKindRow } from "@/components/ThreadKindRow";
import { formatDistanceShort } from "@/lib/utils";
import type { Thread, Team, Match } from "@/types";

export type ForumThreadCardThread = Thread & {
  author?: { username: string; avatar?: string | null };
  team?: Team | null;
  match?: Match | null;
  _count?: { posts: number };
};

export function ForumThreadCard({
  thread,
  threadHref,
  showTeam = false,
}: {
  thread: ForumThreadCardThread;
  threadHref: string;
  showTeam?: boolean;
}) {
  const matchId = thread.match?.id;

  return (
    <div className="card-hover flex flex-col gap-4 rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-5 transition-colors hover:bg-[var(--sd-surface-raised)] sm:flex-row sm:items-start">
      <Link href={threadHref} className="min-w-0 flex-1 block">
        <ThreadKindRow thread={thread} />
        <h3 className="font-display text-lg font-bold uppercase tracking-tight mb-2 truncate">
          {thread.title}
        </h3>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground font-body">
          <span className="font-semibold text-foreground">
            {thread.author?.username || "Unknown"}
          </span>
          <span>·</span>
          <span>{formatDistanceShort(thread.createdAt)}</span>
          {showTeam && thread.team && (
            <>
              <span>·</span>
              <span className="text-[var(--sd-accent)]">{thread.team.shortName}</span>
            </>
          )}
          <span>·</span>
          <span>{thread._count?.posts || 0} posts</span>
        </div>
      </Link>
      {thread.isMatchThread && matchId != null && (
        <Link
          href={`/matches/${matchId}`}
          className="shrink-0 inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--sd-border-subtle)] bg-[var(--sd-surface-raised)] px-3 py-2.5 text-xs font-display font-bold uppercase tracking-wide text-[var(--sd-accent)] hover:border-[var(--sd-accent)]/40 sm:self-start"
        >
          <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Match page
        </Link>
      )}
    </div>
  );
}
