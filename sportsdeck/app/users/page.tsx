"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Search, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { searchUsers } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import FollowButton from "@/components/FollowButton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import type { UserListItem } from "@/types";

function UserRow({ u }: { u: UserListItem }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] px-4 py-3 sm:px-5">
      <Link href={`/users/${u.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar className="h-11 w-11 shrink-0 border border-[var(--sd-border-subtle)]">
          <AvatarImage src={u.avatar ?? undefined} alt="" />
          <AvatarFallback className="bg-[var(--sd-accent-muted)] font-display text-sm font-bold text-[var(--sd-accent)]">
            {u.username.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-display text-sm font-bold uppercase tracking-tight text-foreground truncate hover:text-[var(--sd-accent)]">
            {u.username}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-body text-xs text-muted-foreground">
            {u.favoriteTeam ? (
              <span className="inline-flex items-center gap-1">
                {u.favoriteTeam.crestUrl ? (
                  <img
                    src={u.favoriteTeam.crestUrl}
                    alt=""
                    className="h-3.5 w-3.5 object-contain"
                  />
                ) : null}
                {u.favoriteTeam.shortName}
              </span>
            ) : (
              <span>No favourite team</span>
            )}
            <span className="text-muted-foreground/50">·</span>
            <span>
              {u._count.followers} follower{u._count.followers === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </Link>
      <FollowButton
        userId={u.id}
        initialIsFollowing={u.isFollowedByMe}
        className="shrink-0 bg-[var(--sd-accent)] text-[var(--sd-bg)] hover:bg-[var(--sd-accent)]/90 font-display font-semibold uppercase tracking-wide text-xs"
      />
    </div>
  );
}

export default function UsersDiscoverPage() {
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ]);

  const { data, error, isLoading } = useSWR(
    ["users-search", debouncedQ, page],
    () => searchUsers({ q: debouncedQ, page, limit: 20 })
  );

  const pagination = data?.pagination;
  const users = data?.users ?? [];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2 text-[var(--sd-accent)]">
          <Users className="h-5 w-5" />
          <span className="font-display text-[10px] font-bold uppercase tracking-widest">
            Community
          </span>
        </div>
        <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight text-foreground sm:text-4xl">
          Find users
        </h1>
        <p className="mt-2 font-body text-sm text-muted-foreground">
          Search by username and follow people to see their posts in your feed.
        </p>
      </div>

      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search usernames…"
          autoComplete="off"
          className="h-11 pl-10 bg-[var(--sd-surface)] border-[var(--sd-border-subtle)]"
          aria-label="Search users by username"
        />
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-4"
            >
              <Skeleton className="h-11 w-11 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && error && (
        <p className="text-center font-body text-sm text-[var(--sd-danger)] py-12">
          {error instanceof Error ? error.message : "Could not load users."}
        </p>
      )}

      {!isLoading && !error && users.length === 0 && (
        <div className="rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] py-16 text-center px-4">
          <Users className="mx-auto h-10 w-10 text-muted-foreground opacity-40 mb-3" />
          <p className="font-body text-sm text-muted-foreground">
            {debouncedQ
              ? `No users match “${debouncedQ}”. Try another name.`
              : "No users to show yet."}
          </p>
        </div>
      )}

      {!isLoading && !error && users.length > 0 && (
        <>
          <ul className="space-y-3" aria-label="User search results">
            {users.map((u) => (
              <li key={u.id}>
                <UserRow u={u} />
              </li>
            ))}
          </ul>

          {pagination && pagination.pages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="border-[var(--sd-border-subtle)]"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="font-body text-xs text-muted-foreground tabular-nums">
                Page {pagination.page} of {pagination.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.pages}
                onClick={() => setPage((p) => p + 1)}
                className="border-[var(--sd-border-subtle)]"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}

          {user && (
            <p className="mt-8 text-center font-body text-xs text-muted-foreground">
              <Link href={`/users/${user.id}`} className="text-[var(--sd-accent)] hover:underline">
                View your profile
              </Link>
            </p>
          )}
        </>
      )}
    </div>
  );
}
