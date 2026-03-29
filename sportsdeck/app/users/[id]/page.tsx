"use client";

import { use, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { formatDate } from "@/lib/utils";
import { getUser } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FollowButton from "@/components/FollowButton";
import ReportDialog from "@/components/ReportDialog";
import { useAuth } from "@/context/AuthContext";
import {
  User,
  Calendar,
  MessageSquare,
  FileText,
  Users,
  UserCheck,
  Trophy,
  Ban,
} from "lucide-react";

export default function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const userId = parseInt(id);
  const { user: me } = useAuth();

  const { data: profile, error, mutate } = useSWR(
    userId ? `user-${userId}` : null,
    () => getUser(userId)
  );

  const [followersCount, setFollowersCount] = useState(
    profile?._count.followers ?? 0
  );

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Card className="border-[var(--sd-border-subtle)] bg-[var(--sd-surface)]">
          <CardContent className="py-12 text-center">
            <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="font-body text-muted-foreground">
              {error.message || "User not found"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Card className="border-[var(--sd-border-subtle)] bg-[var(--sd-surface)]">
          <CardHeader className="pb-4">
            <div className="flex items-start gap-6">
              <Skeleton className="h-24 w-24 rounded-full" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-24" />
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleFollowChange = (isFollowing: boolean) => {
    setFollowersCount((prev: number) => (isFollowing ? prev + 1 : prev - 1));
    mutate();
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Profile Header */}
      <Card className="border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] mb-6">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <Avatar className="h-24 w-24 border-4 border-[var(--sd-border-subtle)]">
              <AvatarImage src={profile.avatar || undefined} />
              <AvatarFallback className="bg-[var(--sd-accent)]/10 text-[var(--sd-accent)] font-display font-bold text-3xl">
                {profile.username[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <h1 className="font-display text-3xl font-bold text-foreground mb-1">
                    {profile.username}
                  </h1>
                  {profile.isBanned && (
                    <div className="flex items-center gap-1 text-[var(--sd-danger)] mb-2">
                      <Ban className="h-4 w-4" />
                      <span className="font-body text-sm font-semibold">
                        Banned
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span className="font-body text-sm">
                      Joined {formatDate(new Date(profile.createdAt))}
                    </span>
                  </div>
                </div>

                <FollowButton
                  userId={userId}
                  initialIsFollowing={profile.isFollowedByMe}
                  onFollowChange={handleFollowChange}
                  className="bg-[var(--sd-accent)] text-[var(--sd-bg)] hover:bg-[var(--sd-accent)]/90 font-display font-semibold uppercase tracking-wide text-xs"
                />
                {me && me.id !== userId && (
                  <ReportDialog
                    target={{ type: "user", id: userId, label: profile.username }}
                  />
                )}
              </div>

              {profile.favoriteTeam && (
                <Link
                  href={`/forums/${profile.favoriteTeam.id}`}
                  className="inline-flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-[var(--sd-surface-raised)] border border-[var(--sd-border-subtle)] hover:border-[var(--sd-accent)]/30 transition-colors"
                >
                  <Trophy className="h-4 w-4 text-[var(--sd-accent)]" />
                  <span className="font-body text-sm font-semibold">
                    {profile.favoriteTeam.shortName}
                  </span>
                </Link>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 border-t border-[var(--sd-border-subtle)]">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <Users className="h-4 w-4" />
                <span className="font-body text-xs uppercase tracking-wide">
                  Followers
                </span>
              </div>
              <p className="font-display text-2xl font-bold text-foreground">
                {followersCount}
              </p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <UserCheck className="h-4 w-4" />
                <span className="font-body text-xs uppercase tracking-wide">
                  Following
                </span>
              </div>
              <p className="font-display text-2xl font-bold text-foreground">
                {profile._count.following}
              </p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <FileText className="h-4 w-4" />
                <span className="font-body text-xs uppercase tracking-wide">
                  Threads
                </span>
              </div>
              <p className="font-display text-2xl font-bold text-foreground">
                {profile._count.threads}
              </p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <MessageSquare className="h-4 w-4" />
                <span className="font-body text-xs uppercase tracking-wide">
                  Posts
                </span>
              </div>
              <p className="font-display text-2xl font-bold text-foreground">
                {profile._count.posts}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Tabs */}
      <Tabs defaultValue="threads" className="w-full">
        <TabsList className="w-full justify-start border-b border-[var(--sd-border-subtle)] bg-transparent rounded-none h-auto p-0">
          <TabsTrigger
            value="threads"
            className="data-[state=active]:border-b-2 data-[state=active]:border-[var(--sd-accent)] rounded-none font-display font-semibold uppercase tracking-wide text-xs"
          >
            <FileText className="h-4 w-4 mr-1" />
            Threads
          </TabsTrigger>
          <TabsTrigger
            value="posts"
            className="data-[state=active]:border-b-2 data-[state=active]:border-[var(--sd-accent)] rounded-none font-display font-semibold uppercase tracking-wide text-xs"
          >
            <MessageSquare className="h-4 w-4 mr-1" />
            Posts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="threads" className="mt-6">
          {profile.threads.length === 0 ? (
            <Card className="border-[var(--sd-border-subtle)] bg-[var(--sd-surface)]">
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="font-body text-muted-foreground">
                  No threads yet
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {profile.threads.map((thread: typeof profile.threads[0]) => (
                <Link
                  key={thread.id}
                  href={`/forums/${thread.team?.id ?? "general"}/${thread.id}`}
                >
                  <Card className="border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] hover:border-[var(--sd-accent)]/30 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-display text-lg font-bold text-foreground mb-1 line-clamp-2">
                            {thread.title}
                          </h3>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span className="font-body text-xs">
                              {thread.team?.shortName ?? "General"}
                            </span>
                            <span>•</span>
                            <span className="font-body text-xs">
                              {formatDate(new Date(thread.createdAt))}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="posts" className="mt-6">
          {profile.posts.length === 0 ? (
            <Card className="border-[var(--sd-border-subtle)] bg-[var(--sd-surface)]">
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="font-body text-muted-foreground">No posts yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {profile.posts.map((post: typeof profile.posts[0]) => (
                <Link
                  key={post.id}
                  href={`/forums/${post.thread.teamId ?? "general"}/${post.thread.id}#post-${post.id}`}
                >
                  <Card className="border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] hover:border-[var(--sd-accent)]/30 transition-colors">
                    <CardContent className="p-4">
                      <div className="mb-2">
                        <span className="font-body text-sm text-muted-foreground">
                          in{" "}
                          <span className="text-[var(--sd-accent)] font-semibold">
                            {post.thread.title}
                          </span>
                        </span>
                      </div>
                      <p className="font-body text-sm text-foreground line-clamp-3">
                        {post.content}
                      </p>
                      <div className="mt-2">
                        <span className="font-body text-xs text-muted-foreground">
                          {formatDate(new Date(post.createdAt))}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
