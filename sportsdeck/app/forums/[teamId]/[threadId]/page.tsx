// Prompt: Thread detail — GET /api/threads/[id], show title, posts with author and
// content; render PollWidget when post.poll?.id; CreatePollForm for signed-in users.
// Claude claude-4.6-opus-high-thinking

"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  MessageSquare,
  Pencil,
  Trash2,
  CornerDownRight,
  Calendar,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatDistanceShort, formatDate } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import PollWidget from "@/components/polls/PollWidget";
import CreatePollForm from "@/components/polls/CreatePollForm";
import SentimentIndicator from "@/components/SentimentIndicator";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { Thread, Post } from "@/types";

type ThreadPost = Post & {
  poll?: { id: number } | null;
  author?: { username: string; avatar?: string | null };
  replies?: ThreadPost[];
};

type ThreadResponse = Thread & {
  posts: ThreadPost[];
  author?: { username: string; avatar?: string | null };
  match?: {
    id: number;
    status?: string;
    homeTeam?: { shortName: string };
    awayTeam?: { shortName: string };
  } | null;
};

export default function ThreadDetailPage() {
  const params = useParams();
  const threadIdParam = params.threadId as string;
  const threadId = parseInt(threadIdParam, 10);
  const { user } = useAuth();

  const [thread, setThread] = useState<ThreadResponse | null>(null);
  const [posts, setPosts] = useState<ThreadPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [activeReplyTo, setActiveReplyTo] = useState<number | null>(null);
  const [replyToContent, setReplyToContent] = useState("");
  const [replyPosting, setReplyPosting] = useState(false);
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [mutatingPostId, setMutatingPostId] = useState<number | null>(null);

  const buildPostTree = useCallback((flat: ThreadPost[]) => {
    const nodes = new Map<number, ThreadPost>();
    const roots: ThreadPost[] = [];

    for (const p of flat) {
      nodes.set(p.id, { ...p, replies: [] });
    }

    for (const p of nodes.values()) {
      if (p.parentId == null) {
        roots.push(p);
        continue;
      }
      const parent = nodes.get(p.parentId);
      if (parent) {
        parent.replies!.push(p);
      } else {
        // orphaned reply (shouldn't happen), treat as root
        roots.push(p);
      }
    }

    return roots;
  }, []);

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
      const flat = await apiFetch<ThreadPost[]>(`/api/threads/${threadId}/posts`);
      setPosts(buildPostTree(flat));
    } catch {
      setError("Thread not found or could not be loaded.");
      setThread(null);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [threadId, buildPostTree]);

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
          href="/forums"
          className="mt-4 inline-block font-body text-sm font-semibold text-[var(--sd-accent)] hover:underline"
        >
          Back to forums
        </Link>
      </div>
    );
  }

  const now = new Date();
  const discussionNotStartedYet = new Date(thread.openAt) > now;
  const isThreadOpen =
    !discussionNotStartedYet &&
    (thread.closeAt == null || new Date(thread.closeAt) > now);

  const handlePost = async () => {
    if (!thread) return;
    const content = replyContent.trim();
    if (!content) return;
    setPosting(true);
    try {
      await apiFetch(`/api/threads/${thread.id}/posts`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      setReplyContent("");
      await loadThread();
    } catch (e) {
      // apiFetch will sign out on 401; keep message generic here
      setError(e instanceof Error ? e.message : "Could not post reply.");
    } finally {
      setPosting(false);
    }
  };

  const isAdmin = user?.role === "admin";

  const handleReplyTo = async (parentId: number) => {
    if (!thread) return;
    const content = replyToContent.trim();
    if (!content) return;
    setReplyPosting(true);
    try {
      await apiFetch(`/api/threads/${thread.id}/posts`, {
        method: "POST",
        body: JSON.stringify({ content, parentId }),
      });
      setActiveReplyTo(null);
      setReplyToContent("");
      await loadThread();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not post reply.");
    } finally {
      setReplyPosting(false);
    }
  };

  const startEdit = (post: ThreadPost) => {
    setEditingPostId(post.id);
    setEditContent(post.content);
  };

  const cancelEdit = () => {
    setEditingPostId(null);
    setEditContent("");
  };

  const saveEdit = async (postId: number) => {
    const content = editContent.trim();
    if (!content) return;
    setMutatingPostId(postId);
    try {
      await apiFetch(`/api/posts/${postId}`, {
        method: "PUT",
        body: JSON.stringify({ content }),
      });
      cancelEdit();
      await loadThread();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update post.");
    } finally {
      setMutatingPostId(null);
    }
  };

  const deletePost = async (postId: number) => {
    if (!confirm("Delete this post?")) return;
    setMutatingPostId(postId);
    try {
      await apiFetch(`/api/posts/${postId}`, { method: "DELETE" });
      await loadThread();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete post.");
    } finally {
      setMutatingPostId(null);
    }
  };

  const renderPost = (post: ThreadPost, depth: number) => {
    const isOwner = user?.id === post.authorId;
    const canEdit = !!user && isOwner;
    const canDelete = !!user && (isOwner || isAdmin);
    const isEditing = editingPostId === post.id;
    const showReplyBox = activeReplyTo === post.id;

    return (
      <div key={post.id} className={depth > 0 ? "pl-6 border-l border-[var(--sd-border-subtle)]" : ""}>
        <article
          id={`post-${post.id}`}
          className="rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-4 sm:p-5"
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="text-xs text-muted-foreground font-body">
              <Link
                href={`/users/${post.authorId}`}
                className="font-semibold text-foreground hover:underline"
              >
                {post.author?.username ?? "User"}
              </Link>
              <span className="mx-2">·</span>
              <time dateTime={post.createdAt}>{formatDistanceShort(post.createdAt)}</time>
              {post.parentId != null && (
                <span className="ml-2 inline-flex items-center gap-1 text-[var(--sd-accent)]">
                  <CornerDownRight className="h-3.5 w-3.5" />
                  reply
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {user && isThreadOpen && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setActiveReplyTo((cur) => (cur === post.id ? null : post.id));
                    setReplyToContent("");
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Reply
                </Button>
              )}
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => startEdit(post)}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deletePost(post.id)}
                  disabled={mutatingPostId === post.id}
                  className="h-8 w-8 text-[var(--sd-danger)] hover:text-[var(--sd-danger)]/90"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {isEditing ? (
            <>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full min-h-[110px] rounded-lg border border-[var(--sd-border-subtle)] bg-[var(--sd-surface-raised)] px-3 py-2 font-body text-sm text-foreground outline-none focus:border-[var(--sd-accent)]"
              />
              <div className="mt-3 flex items-center justify-end gap-2">
                <Button variant="outline" onClick={cancelEdit}>
                  Cancel
                </Button>
                <Button
                  onClick={() => saveEdit(post.id)}
                  disabled={mutatingPostId === post.id || editContent.trim().length === 0}
                  className="bg-[var(--sd-accent)] text-[var(--sd-bg)] hover:bg-[var(--sd-accent)]/90 font-display font-semibold uppercase tracking-wide text-xs"
                >
                  {mutatingPostId === post.id ? "Saving..." : "Save"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="font-body text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {post.content}
              </p>
              {post.poll?.id != null && (
                <div className="mt-4">
                  <PollWidget pollId={post.poll.id} />
                </div>
              )}
            </>
          )}

          {user && isThreadOpen && showReplyBox && (
            <div className="mt-4 rounded-lg border border-[var(--sd-border-subtle)] bg-[var(--sd-surface-raised)] p-3">
              <p className="font-body text-xs text-muted-foreground mb-2">
                Replying to <span className="font-semibold text-foreground">{post.author?.username ?? "User"}</span>
              </p>
              <textarea
                value={replyToContent}
                onChange={(e) => setReplyToContent(e.target.value)}
                placeholder="Write a reply..."
                className="w-full min-h-[90px] rounded-lg border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] px-3 py-2 font-body text-sm text-foreground outline-none focus:border-[var(--sd-accent)]"
              />
              <div className="mt-2 flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setActiveReplyTo(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleReplyTo(post.id)}
                  disabled={replyPosting || replyToContent.trim().length === 0}
                  className="bg-[var(--sd-accent)] text-[var(--sd-bg)] hover:bg-[var(--sd-accent)]/90 font-display font-semibold uppercase tracking-wide text-xs"
                >
                  {replyPosting ? "Posting..." : "Reply"}
                </Button>
              </div>
            </div>
          )}
        </article>

        {post.replies && post.replies.length > 0 && (
          <div className="mt-3 space-y-3">
            {post.replies.map((r) => renderPost(r, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/forums"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-[var(--sd-accent)] font-body mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to forums
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
              By{" "}
              <Link
                href={`/users/${thread.authorId}`}
                className="font-semibold text-foreground hover:underline"
              >
                {thread.author.username}
              </Link>
              {" · "}
            </>
          )}
          {formatDistanceShort(thread.createdAt)}
        </p>
        {thread.isMatchThread && thread.match?.id != null && (
          <Link
            href={`/matches/${thread.match.id}`}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[var(--sd-border-subtle)] bg-[var(--sd-surface-raised)] px-4 py-2.5 text-sm font-display font-bold uppercase tracking-wide text-[var(--sd-accent)] hover:border-[var(--sd-accent)]/40 transition-colors"
          >
            <Calendar className="h-4 w-4 shrink-0" aria-hidden />
            Open match page
          </Link>
        )}
        {discussionNotStartedYet && (
            <p className="mt-3 font-body text-sm text-muted-foreground">
              Discussion opens {formatDate(thread.openAt)}.
            </p>
          )}
      </header>

      {thread.isMatchThread && (
        <SentimentIndicator
          className="mb-8"
          threadId={thread.id}
          homeTeamShort={thread.match?.homeTeam?.shortName}
          awayTeamShort={thread.match?.awayTeam?.shortName}
        />
      )}

      {user && isThreadOpen && (
        <div className="mb-8">
          <CreatePollForm threadId={thread.id} onCreated={loadThread} />
        </div>
      )}

      {user && !isThreadOpen && !discussionNotStartedYet && (
        <div className="mb-8 rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-4">
          <p className="font-body text-sm text-muted-foreground">
            This thread is closed. Polls can only be created on open threads.
          </p>
        </div>
      )}

      {user && isThreadOpen && (
        <div className="mb-8 rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-4">
          <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--sd-accent)] mb-3">
            Reply
          </p>
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Write your reply..."
            className="w-full min-h-[110px] rounded-lg border border-[var(--sd-border-subtle)] bg-[var(--sd-surface-raised)] px-3 py-2 font-body text-sm text-foreground outline-none focus:border-[var(--sd-accent)]"
          />
          <div className="mt-3 flex items-center justify-end gap-3">
            <Button
              onClick={handlePost}
              disabled={posting || replyContent.trim().length === 0}
              className="bg-[var(--sd-accent)] text-[var(--sd-bg)] hover:bg-[var(--sd-accent)]/90 font-display font-semibold uppercase tracking-wide text-xs"
            >
              {posting ? "Posting..." : "Post Reply"}
            </Button>
          </div>
        </div>
      )}

      <section className="space-y-6" aria-label="Posts">
        {posts.map((post) => renderPost(post, 0))}
        {posts.length === 0 && (
          <p className="text-center text-muted-foreground font-body text-sm py-8">
            No posts yet.
          </p>
        )}
      </section>
    </div>
  );
}
