// Prompt: Thread detail — GET /api/threads/[id], show title, posts with author and
// content; render PollWidget when post.poll?.id; CreatePollForm for signed-in users.
// Claude claude-4.6-opus-high-thinking

"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatDistanceShort } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import PollWidget from "@/components/polls/PollWidget";
import CreatePollForm from "@/components/polls/CreatePollForm";
import { Skeleton } from "@/components/ui/skeleton";
import type { Thread, Post } from "@/types";

type ThreadPost = Post & {
  poll?: { id: number } | null;
  author?: { username: string; avatar?: string | null };
};

type ThreadResponse = Thread & {
  posts: ThreadPost[];
  author?: { username: string; avatar?: string | null };
};

export default function ThreadDetailPage() {
  const params = useParams();
  const teamId = params.teamId as string;
  const threadIdParam = params.threadId as string;
  const threadId = parseInt(threadIdParam, 10);
  const { user } = useAuth();

  const [thread, setThread] = useState<ThreadResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadThread = useCallback(async () => {
    if (isNaN(threadId)) {
      setError("Invalid thread");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ThreadResponse>(`/api/threads/${threadId}`);
      setThread(data);
    } catch {
      setError("Thread not found or could not be loaded.");
      setThread(null);
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-4 w-32 mb-6" />
        <Skeleton className="h-10 w-full max-w-xl mb-8" />
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !thread) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
        <p className="font-body text-muted-foreground">{error}</p>
        <Link
          href={`/forums/${teamId}`}
          className="mt-4 inline-block font-body text-sm font-semibold text-[var(--sd-accent)] hover:underline"
        >
          Back to forum
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href={`/forums/${teamId}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-[var(--sd-accent)] font-body mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to forum
      </Link>

      <header className="mb-8 border-b border-[var(--sd-border-subtle)] pb-6">
        <div className="flex items-center gap-2 text-[var(--sd-accent)] mb-2">
          <MessageSquare className="h-4 w-4" />
          <span className="font-display text-[10px] font-bold uppercase tracking-widest">
            Thread
          </span>
        </div>
        <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight sm:text-4xl">
          {thread.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground font-body">
          {thread.author?.username && (
            <>
              By <span className="font-semibold text-foreground">{thread.author.username}</span>
              {" · "}
            </>
          )}
          {formatDistanceShort(thread.createdAt)}
        </p>
      </header>

      {user && (
        <div className="mb-8">
          <CreatePollForm threadId={thread.id} onCreated={loadThread} />
        </div>
      )}

      <section className="space-y-6" aria-label="Posts">
        {thread.posts?.map((post) => (
          <article
            key={post.id}
            className="rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-4 sm:p-5"
          >
            <div className="flex items-center justify-between gap-2 mb-3 text-xs text-muted-foreground font-body">
              <span className="font-semibold text-foreground">
                {post.author?.username ?? "User"}
              </span>
              <time dateTime={post.createdAt}>
                {formatDistanceShort(post.createdAt)}
              </time>
            </div>
            <p className="font-body text-sm leading-relaxed text-foreground whitespace-pre-wrap">
              {post.content}
            </p>
            {post.poll?.id != null && (
              <div className="mt-4">
                <PollWidget pollId={post.poll.id} />
              </div>
            )}
          </article>
        ))}
        {(!thread.posts || thread.posts.length === 0) && (
          <p className="text-center text-muted-foreground font-body text-sm py-8">
            No posts yet.
          </p>
        )}
      </section>
    </div>
  );
}
