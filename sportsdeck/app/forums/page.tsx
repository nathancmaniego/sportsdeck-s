// Prompt: Forums index — browse threads with search, match/fan filters, pagination.
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, Plus, MessageSquare } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ForumThreadCard } from "@/components/ForumThreadCard";
import type { ThreadCategoryFilter } from "@/lib/threadDisplay";
import type { Thread, Team, Match } from "@/types";

type ThreadWithDetails = Thread & {
  author?: { username: string; avatar?: string | null };
  team?: Team | null;
  match?: Match | null;
  _count?: { posts: number };
};

export default function ForumsPage() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<ThreadWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [threadCategory, setThreadCategory] =
    useState<ThreadCategoryFilter>("");
  const [selectedAuthor, setSelectedAuthor] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"" | "open" | "closed">("");
  const [currentPage, setCurrentPage] = useState(1);
  const threadsPerPage = 20;

  const loadThreads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set("title", searchTerm);
      if (threadCategory) params.set("threadCategory", threadCategory);
      if (selectedAuthor) params.set("author", selectedAuthor);
      if (selectedStatus) params.set("status", selectedStatus);
      params.set("limit", threadsPerPage.toString());
      params.set("offset", ((currentPage - 1) * threadsPerPage).toString());

      const data = await apiFetch<ThreadWithDetails[]>(
        `/api/threads?${params.toString()}`
      );
      setThreads(data);
    } catch {
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, [
    searchTerm,
    threadCategory,
    selectedAuthor,
    selectedStatus,
    currentPage,
  ]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const handleNextPage = () => {
    if (threads.length === threadsPerPage) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[var(--sd-accent)] mb-2">
            <MessageSquare className="h-5 w-5" />
            <span className="font-display text-xs font-bold uppercase tracking-widest">
              Forums
            </span>
          </div>
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight sm:text-4xl">
            Discussion Threads
          </h1>
          <p className="mt-2 font-body text-sm text-muted-foreground max-w-xl">
            Filter by matchday threads (finished or still to play) or fan-started
            discussions. Search still matches title text.
          </p>
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

      <div className="mb-6 space-y-4 rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-4 sm:p-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Search by thread title…"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-10"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-display font-bold uppercase tracking-widest text-muted-foreground">
            Thread type
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {(
              [
                { value: "" as const, label: "All threads" },
                {
                  value: "match_finished" as const,
                  label: "Match threads · finished",
                },
                {
                  value: "match_upcoming" as const,
                  label: "Match threads · upcoming & live",
                },
                { value: "community" as const, label: "Fan threads" },
              ] satisfies { value: ThreadCategoryFilter; label: string }[]
            ).map(({ value, label }) => (
              <label
                key={value || "all"}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-body transition-colors ${
                  threadCategory === value
                    ? "border-[var(--sd-accent)] bg-[var(--sd-accent)]/10 text-foreground"
                    : "border-[var(--sd-border-subtle)] bg-[var(--sd-surface-raised)] text-muted-foreground hover:border-[var(--sd-accent)]/40"
                }`}
              >
                <input
                  type="radio"
                  name="threadCategory"
                  className="sr-only"
                  checked={threadCategory === value}
                  onChange={() => {
                    setThreadCategory(value);
                    setCurrentPage(1);
                  }}
                />
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium font-body">
              Author username
            </label>
            <Input
              type="text"
              placeholder="Contains…"
              value={selectedAuthor}
              onChange={(e) => {
                setSelectedAuthor(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium font-body">
              Open / closed
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value as "" | "open" | "closed");
                setCurrentPage(1);
              }}
              className="w-full rounded-lg border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] px-3 py-2 text-sm font-body"
            >
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : threads.length === 0 ? (
        <div className="rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-12 text-center">
          <p className="font-body text-muted-foreground">
            No threads match these filters.{" "}
            {user && "Try another type or start a new thread."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {threads.map((thread) => (
            <ForumThreadCard
              key={thread.id}
              thread={thread}
              threadHref={`/forums/${thread.teamId || "general"}/${thread.id}`}
              showTeam
            />
          ))}
          <div className="flex justify-between mt-6">
            <Button
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className="px-4 py-2 text-sm font-medium text-white bg-[var(--sd-accent)] rounded-lg disabled:opacity-50"
            >
              Previous
            </Button>
            <Button
              onClick={handleNextPage}
              disabled={threads.length < threadsPerPage}
              className="px-4 py-2 text-sm font-medium text-white bg-[var(--sd-accent)] rounded-lg disabled:opacity-50"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
