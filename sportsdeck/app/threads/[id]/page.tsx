// Thread Detail Page
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formatDistanceShort } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import type { Thread, Post, User } from '@/types';

type PostWithDetails = Post & {
  author: User;
};

type ThreadWithDetails = Thread & {
  author: User;
  posts: PostWithDetails[];
};

export default function ThreadDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [thread, setThread] = useState<ThreadWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState('');

  const loadThread = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<ThreadWithDetails>(`/api/threads/${id}`);
      setThread(data);
    } catch {
      setThread(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handlePostSubmit = async () => {
    if (!newPost.trim()) return;
    try {
      const post = await apiFetch<PostWithDetails>(`/api/threads/${id}/posts`, {
        method: 'POST',
        body: JSON.stringify({ content: newPost }),
      });
      setThread((prev) =>
        prev ? { ...prev, posts: [...prev.posts, post] } : prev
      );
      setNewPost('');
    } catch (error) {
      console.error('Failed to post:', error);
    }
  };

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!thread) {
    return <p>Thread not found.</p>;
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight sm:text-4xl">
          {thread.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          By {thread.author.username} · {formatDistanceShort(thread.createdAt)}
        </p>
      </header>

      <div className="space-y-4">
        {thread.posts.map((post) => (
          <div
            key={post.id}
            className="rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-4"
          >
            <p className="font-body text-sm text-muted-foreground">
              {post.author?.username || 'Unknown Author'} ·{' '}
              {post.createdAt ? formatDistanceShort(post.createdAt) : 'Unknown Date'}
            </p>
            <p className="font-body text-base text-foreground mt-2">
              {post.content}
            </p>
          </div>
        ))}
      </div>

      {user && (
        <div className="mt-6">
          <Input
            type="text"
            placeholder="Write a reply..."
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            className="mb-2"
          />
          <Button onClick={handlePostSubmit}>Post Reply</Button>
        </div>
      )}
    </div>
  );
}