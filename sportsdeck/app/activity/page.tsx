"use client";
// Prompt: Generate a page that displays the activity feed for the current user.
// Claude claude-4.6-opus-high-thinking

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { getFeed } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import ActivityFeed from "@/components/ActivityFeed";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronLeft, ChevronRight, LayoutDashboard, LogIn } from "lucide-react";

export default function ActivityPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);

  const { data, error, isLoading } = useSWR(
    user ? `feed-${user.id}-${page}` : null,
    () => getFeed(user!.id, { page, limit: 30, unreadOnly: false })
  );

  /* ── Not signed in ─────────────────────────────────────────────────────── */
  if (!user) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="h-16 w-16 rounded-full bg-[var(--sd-surface-raised)] flex items-center justify-center mx-auto mb-6">
            <LayoutDashboard className="h-8 w-8 text-muted-foreground opacity-50" />
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground mb-2">
            Your Feed
          </h2>
          <p className="font-body text-sm text-muted-foreground mb-6">
            Sign in for a stream of what people you follow post, replies to your
            threads, curated forum activity when that’s thin, and your team’s
            fixtures and results.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-md bg-[var(--sd-accent)] px-5 py-2.5 text-sm font-display font-semibold uppercase tracking-wide text-[var(--sd-bg)] hover:bg-[var(--sd-accent)]/90 transition-colors"
          >
            <LogIn className="h-4 w-4" />
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  /* ── Signed in ─────────────────────────────────────────────────────────── */
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Page header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-3">
          <Avatar className="h-11 w-11 border-2 border-[var(--sd-accent)]/30">
            <AvatarImage src={user.avatar ?? undefined} alt={user.username} />
            <AvatarFallback className="bg-[var(--sd-accent-muted)] text-[var(--sd-accent)] font-display font-bold">
              {user.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground leading-tight">
              Your Feed
            </h1>
            <p className="font-body text-sm text-muted-foreground">
              Follows, forum picks when it’s quiet, and your favourite team
            </p>
          </div>
        </div>

        <Link
          href={`/users/${user.id}`}
          className="text-xs font-body text-muted-foreground hover:text-[var(--sd-accent)] transition-colors"
        >
          View profile →
        </Link>
      </div>

      {/* Feed */}
      {isLoading ? (
        <div className="space-y-1">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="flex gap-3 items-start px-4 py-3.5"
            >
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12 text-muted-foreground font-body text-sm">
          {error.message || "Failed to load feed. Try refreshing."}
        </div>
      ) : (
        <>
          <ActivityFeed
            events={data?.feed ?? []}
            viewerId={user.id}
            viewerFavoriteTeamId={
              user.favoriteTeamId ?? user.favoriteTeam?.id ?? null
            }
          />

          {/* Pagination */}
          {data && data.pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-10">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="border-[var(--sd-border-subtle)]"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Newer
              </Button>

              <span className="font-body text-xs text-muted-foreground">
                Page {page} of {data.pagination.pages}
              </span>

              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.pagination.pages}
                onClick={() => setPage((p) => p + 1)}
                className="border-[var(--sd-border-subtle)]"
              >
                Older
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
