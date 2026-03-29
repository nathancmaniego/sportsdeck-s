// Prompt: Forums index — browse all threads with search/filter, create new threads
// Claude claude-4.6-opus-high-thinking
'use client'

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, Plus, MessageSquare } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatDistanceShort } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { Thread, Team, Tag } from "@/types";

type ThreadWithDetails = Thread & {
  author?: { username: string; avatar?: string | null };
  tags?: { tag: Tag }[];
  team?: Team | null;
  _count?: { posts: number };
};

export default function ForumsPage() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<ThreadWithDetails[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [selectedAuthor, setSelectedAuthor] = useState("");
  const [selectedTheme, setSelectedTheme] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"" | "open" | "closed">("");
  const [currentPage, setCurrentPage] = useState(1);
  const threadsPerPage = 20;

  const loadTeams = useCallback(async () => {
    try {
      const data = await apiFetch<{ teams: Team[] }>("/api/teams");
      setTeams(data.teams || []);
    } catch {
      setTeams([]);
    }
  }, []);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set("title", searchTerm);
      if (selectedTag) params.set("tag", selectedTag);
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
  }, [searchTerm, selectedTag, selectedAuthor, selectedStatus, currentPage]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads, currentPage]);

  const availableTags = ["general", "transfers", "tactics", "player-discussion", "match-review"];

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
      {/* Header */}
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

      {/* Search & Filters */}
      <div className="mb-6 space-y-4 rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search threads by title or author..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium font-body">
              Filter by Tag
            </label>
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="w-full rounded-lg border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] px-3 py-2 text-sm font-body"
            >
              <option value="">All Tags</option>
              {availableTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium font-body">
              Filter by Author
            </label>
            <Input
              type="text"
              placeholder="Search by author..."
              value={selectedAuthor}
              onChange={(e) => setSelectedAuthor(e.target.value)}
              className="w-full"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium font-body">
              Filter by Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value as "" | "open" | "closed");
                setCurrentPage(1);
              }}
              className="w-full rounded-lg border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] px-3 py-2 text-sm font-body"
            >
              <option value="">All Threads</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Thread List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : threads.length === 0 ? (
        <div className="rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-12 text-center">
          <p className="font-body text-muted-foreground">
            No threads found. {user && "Be the first to start a discussion!"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {threads.map((thread) => (
            <Link
              key={thread.id}
              href={`/forums/${thread.teamId || "general"}/${thread.id}`}
              className="card-hover block rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-5 transition-colors hover:bg-[var(--sd-surface-raised)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-lg font-bold uppercase tracking-tight mb-2 truncate">
                    {thread.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground font-body mb-3">
                    <span className="font-semibold text-foreground">
                      {thread.author?.username || "Unknown"}
                    </span>
                    <span>·</span>
                    <span>{formatDistanceShort(thread.createdAt)}</span>
                    {thread.team && (
                      <>
                        <span>·</span>
                        <span className="text-[var(--sd-accent)]">
                          {thread.team.shortName}
                        </span>
                      </>
                    )}
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
                </div>
              </div>
            </Link>
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
