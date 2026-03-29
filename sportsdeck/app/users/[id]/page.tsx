"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { formatDate, formatDistanceShort } from "@/lib/utils";
import {
  getUser,
  getFollowers,
  getFollowing,
  removeFollower,
  updateProfile,
  getTeams,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import FollowButton from "@/components/FollowButton";
import ReportDialog from "@/components/ReportDialog";
import type { FollowUser, TeamStub } from "@/types";
import {
  User,
  Calendar,
  MessageSquare,
  FileText,
  Users,
  UserCheck,
  Trophy,
  Ban,
  Pencil,
  X,
  Loader2,
  UserX,
  History,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Edit Profile Modal
// ---------------------------------------------------------------------------

function EditProfileModal({
  userId,
  currentTeamId,
  currentAvatar,
  onClose,
  onSaved,
}: {
  userId: number;
  currentTeamId: number | null | undefined;
  currentAvatar: string | null | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [teams, setTeams] = useState<TeamStub[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(
    currentTeamId ?? null
  );
  const [useTeamLogo, setUseTeamLogo] = useState(false);
  const [customAvatar, setCustomAvatar] = useState(currentAvatar ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getTeams()
      .then(setTeams)
      .catch(() => setTeams([]));
  }, []);

  // Default to team crest when you have a favourite team and no separate custom avatar.
  useEffect(() => {
    if (!teams.length || selectedTeamId == null) return;
    const t = teams.find((x) => x.id === selectedTeamId);
    if (!t?.crestUrl) return;
    const av = (currentAvatar ?? "").trim();
    if (!av || av === t.crestUrl) {
      setUseTeamLogo(true);
    }
  }, [teams, selectedTeamId, currentAvatar]);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);
  const previewAvatar = useTeamLogo
    ? selectedTeam?.crestUrl ?? ""
    : customAvatar;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile(userId, {
        favoriteTeamId: selectedTeamId,
        avatar: useTeamLogo ? (selectedTeam?.crestUrl ?? null) : customAvatar || null,
      });
      toast.success("Profile updated");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <Card className="w-full max-w-md border-[var(--sd-border-subtle)] bg-[var(--sd-surface-raised)] shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-[var(--sd-border-subtle)]">
          <h2 className="font-display text-lg font-bold uppercase tracking-tight">
            Edit Profile
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="pt-5 space-y-5">
          {/* Avatar preview */}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-[var(--sd-border-subtle)]">
              <AvatarImage src={previewAvatar || undefined} />
              <AvatarFallback className="bg-[var(--sd-accent)]/10 text-[var(--sd-accent)] font-display font-bold text-xl">
                ?
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <Label className="font-body text-xs uppercase tracking-wide text-muted-foreground">
                Avatar URL
              </Label>
              <input
                type="url"
                value={useTeamLogo ? (selectedTeam?.crestUrl ?? "") : customAvatar}
                disabled={useTeamLogo}
                onChange={(e) => setCustomAvatar(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] px-3 py-2 text-sm font-body outline-none focus:border-[var(--sd-accent)] disabled:opacity-50"
              />
            </div>
          </div>

          {/* Favourite team */}
          <div className="space-y-2">
            <Label className="font-body text-xs uppercase tracking-wide text-muted-foreground">
              Favourite Team
            </Label>
            {teams.length === 0 ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="font-body text-sm text-muted-foreground">
                  Loading teams…
                </span>
              </div>
            ) : (
              <select
                value={selectedTeamId ?? ""}
                onChange={(e) =>
                  setSelectedTeamId(
                    e.target.value ? parseInt(e.target.value) : null
                  )
                }
                className="w-full rounded-lg border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] px-3 py-2 text-sm font-body outline-none focus:border-[var(--sd-accent)]"
              >
                <option value="">— No favourite team —</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.tla})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Use team logo as avatar */}
          {selectedTeam && (
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                className={`relative h-5 w-9 rounded-full transition-colors ${useTeamLogo ? "bg-[var(--sd-accent)]" : "bg-muted"}`}
                onClick={() => setUseTeamLogo((v) => !v)}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${useTeamLogo ? "translate-x-4" : ""}`}
                />
              </div>
              <div className="flex items-center gap-2">
                <img
                  src={selectedTeam.crestUrl}
                  alt={selectedTeam.tla}
                  className="h-5 w-5 object-contain"
                />
                <span className="font-body text-sm">
                  Use {selectedTeam.shortName} crest as avatar
                </span>
              </div>
            </label>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 border-[var(--sd-border-subtle)]"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-[var(--sd-accent)] text-[var(--sd-bg)] hover:bg-[var(--sd-accent)]/90 font-display font-semibold uppercase tracking-wide text-xs"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Follow list row
// ---------------------------------------------------------------------------

function FollowRow({
  user: fu,
  canRemove,
  onRemove,
}: {
  user: FollowUser;
  canRemove?: boolean;
  onRemove?: (id: number) => void;
}) {
  const [removing, setRemoving] = useState(false);

  const handleRemove = async () => {
    if (!onRemove) return;
    setRemoving(true);
    onRemove(fu.id);
    setRemoving(false);
  };

  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-[var(--sd-border-subtle)] last:border-0">
      <Link href={`/users/${fu.id}`} className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar className="h-9 w-9 shrink-0 border border-[var(--sd-border-subtle)]">
          <AvatarImage src={fu.avatar || undefined} />
          <AvatarFallback className="bg-[var(--sd-accent)]/10 text-[var(--sd-accent)] font-display font-bold text-sm">
            {fu.username[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-body text-sm font-semibold text-foreground truncate">
            {fu.username}
          </p>
          <p className="font-body text-xs text-muted-foreground">
            {formatDistanceShort(fu.followedAt)}
          </p>
        </div>
      </Link>
      {canRemove && (
        <Button
          variant="ghost"
          size="sm"
          disabled={removing}
          onClick={handleRemove}
          className="shrink-0 text-[var(--sd-danger)] hover:text-[var(--sd-danger)]/90 hover:bg-[var(--sd-danger)]/10"
        >
          <UserX className="h-4 w-4 mr-1" />
          Remove
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const userId = parseInt(id);
  const { user: me, refreshUser } = useAuth();
  const isOwner = me?.id === userId;

  const {
    data: profile,
    error,
    mutate,
  } = useSWR(userId ? `user-${userId}` : null, () => getUser(userId));

  const [followersCount, setFollowersCount] = useState(0);
  const [showEdit, setShowEdit] = useState(false);

  // followers / following lists (only loaded when those tabs are active)
  const {
    data: followersData,
    mutate: mutateFollowers,
  } = useSWR(
    userId ? `followers-${userId}` : null,
    () => getFollowers(userId)
  );
  const { data: followingData } = useSWR(
    userId ? `following-${userId}` : null,
    () => getFollowing(userId)
  );

  useEffect(() => {
    if (profile) setFollowersCount(profile._count.followers);
  }, [profile?._count.followers]);

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
    setFollowersCount((prev) => (isFollowing ? prev + 1 : prev - 1));
    mutate();
  };

  const handleRemoveFollower = async (followerId: number) => {
    try {
      await removeFollower(userId, followerId);
      toast.success("Follower removed");
      setFollowersCount((prev) => Math.max(0, prev - 1));
      mutateFollowers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove follower");
    }
  };

  const handleProfileSaved = () => {
    mutate();
    if (isOwner) refreshUser();
  };

  const followers: FollowUser[] = followersData?.followers ?? [];
  const following: FollowUser[] = followingData?.following ?? [];

  type ThreadT = (typeof profile.threads)[number];
  type PostT = (typeof profile.posts)[number];
  type ActivityRow =
    | { kind: "thread"; at: string; thread: ThreadT }
    | { kind: "post"; at: string; post: PostT; isReply: boolean };

  const authoredThreadIds = new Set(profile.threads.map((t) => t.id));
  const postsForTimeline = profile.posts.filter((post) => {
    if (post.parentId != null) return true;
    return !authoredThreadIds.has(post.thread.id);
  });

  const activityRows: ActivityRow[] = [
    ...profile.threads.map((thread) => ({
      kind: "thread" as const,
      at: thread.createdAt,
      thread,
    })),
    ...postsForTimeline.map((post) => ({
      kind: "post" as const,
      at: post.createdAt,
      post,
      isReply: post.parentId != null,
    })),
  ].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );

  return (
    <>
      {showEdit && (
        <EditProfileModal
          userId={userId}
          currentTeamId={profile.favoriteTeam?.id}
          currentAvatar={profile.avatar}
          onClose={() => setShowEdit(false)}
          onSaved={handleProfileSaved}
        />
      )}

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

                  <div className="flex items-center gap-2">
                    {isOwner ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-[var(--sd-border-subtle)]"
                        onClick={() => setShowEdit(true)}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit Profile
                      </Button>
                    ) : (
                      <FollowButton
                        userId={userId}
                        initialIsFollowing={profile.isFollowedByMe}
                        onFollowChange={handleFollowChange}
                        className="bg-[var(--sd-accent)] text-[var(--sd-bg)] hover:bg-[var(--sd-accent)]/90 font-display font-semibold uppercase tracking-wide text-xs"
                      />
                    )}
                  </div>
                </div>

                {!isOwner && (
                  <ReportDialog
                    target={{ type: "user", id: userId, label: profile.username }}
                  />
                )}
                {profile.favoriteTeam && (
                  <Link
                    href={`/forums/${profile.favoriteTeam.id}`}
                    className="inline-flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-[var(--sd-surface-raised)] border border-[var(--sd-border-subtle)] hover:border-[var(--sd-accent)]/30 transition-colors"
                  >
                    {profile.favoriteTeam.crestUrl && (
                      <img
                        src={profile.favoriteTeam.crestUrl}
                        alt={profile.favoriteTeam.tla}
                        className="h-5 w-5 object-contain"
                      />
                    )}
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
              {[
                { icon: Users, label: "Followers", value: followersCount },
                { icon: UserCheck, label: "Following", value: profile._count.following },
                { icon: FileText, label: "Threads", value: profile._count.threads },
                { icon: MessageSquare, label: "Posts", value: profile._count.posts },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <Icon className="h-4 w-4" />
                    <span className="font-body text-xs uppercase tracking-wide">
                      {label}
                    </span>
                  </div>
                  <p className="font-display text-2xl font-bold text-foreground">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="activity" className="w-full">
          <TabsList className="w-full justify-start border-b border-[var(--sd-border-subtle)] bg-transparent rounded-none h-auto p-0 mb-6 ">
            {[
              { value: "activity", Icon: History, label: "Activity" },
              { value: "threads", Icon: FileText, label: "Threads" },
              { value: "posts", Icon: MessageSquare, label: "Posts" },
              { value: "followers", Icon: Users, label: `Followers (${followersCount})` },
              { value: "following", Icon: UserCheck, label: `Following (${profile._count.following})` },
            ].map(({ value, Icon, label }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="shrink-0 data-[state=active]:border-b-2 data-[state=active]:border-[var(--sd-accent)] rounded-none font-display font-semibold uppercase tracking-wide text-xs pb-2"
              >
                <Icon className="h-4 w-4 mr-1" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Activity — unified timeline */}
          <TabsContent value="activity">
            {activityRows.length === 0 ? (
              <Card className="border-[var(--sd-border-subtle)] bg-[var(--sd-surface)]">
                <CardContent className="py-12 text-center">
                  <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="font-body text-muted-foreground">
                    No public activity yet
                  </p>
                  <p className="font-body text-sm text-muted-foreground mt-1">
                    Threads you start and posts or replies you write appear here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                <p className="font-body text-xs text-muted-foreground px-1 mb-2">
                  Recent threads, posts, and replies — newest first.
                </p>
                {activityRows.map((row) =>
                  row.kind === "thread" ? (
                    <Link
                      key={`t-${row.thread.id}`}
                      href={`/forums/${row.thread.team?.id ?? "general"}/${row.thread.id}`}
                    >
                      <Card className="border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] hover:border-[var(--sd-accent)]/30 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-body text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-[var(--sd-accent)]/15 text-[var(--sd-accent)]">
                              New thread
                            </span>
                            <span className="font-body text-xs text-muted-foreground">
                              {formatDate(new Date(row.at))}
                            </span>
                          </div>
                          <h3 className="font-display text-lg font-bold text-foreground line-clamp-2">
                            {row.thread.title}
                          </h3>
                          <p className="font-body text-xs text-muted-foreground mt-1">
                            {row.thread.team?.shortName ?? "General forum"}
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  ) : (
                    <Link
                      key={`p-${row.post.id}`}
                      href={`/forums/${row.post.thread.teamId ?? "general"}/${row.post.thread.id}#post-${row.post.id}`}
                    >
                      <Card className="border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] hover:border-[var(--sd-accent)]/30 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className={`font-body text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${
                                row.isReply
                                  ? "bg-indigo-500/15 text-indigo-400"
                                  : "bg-blue-500/15 text-blue-400"
                              }`}
                            >
                              {row.isReply ? "Reply" : "Post"}
                            </span>
                            <span className="font-body text-xs text-muted-foreground">
                              {formatDate(new Date(row.at))}
                            </span>
                          </div>
                          <p className="font-body text-xs text-muted-foreground mb-1">
                            in{" "}
                            <span className="text-[var(--sd-accent)] font-semibold">
                              {row.post.thread.title}
                            </span>
                          </p>
                          <p className="font-body text-sm text-foreground line-clamp-4">
                            {row.post.content}
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  )
                )}
              </div>
            )}
          </TabsContent>

          {/* Threads */}
          <TabsContent value="threads">
            {profile.threads.length === 0 ? (
              <Card className="border-[var(--sd-border-subtle)] bg-[var(--sd-surface)]">
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="font-body text-muted-foreground">No threads yet</p>
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
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Posts */}
          <TabsContent value="posts">
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

          {/* Followers */}
          <TabsContent value="followers">
            <Card className="border-[var(--sd-border-subtle)] bg-[var(--sd-surface)]">
              <CardContent className="p-4">
                {!followersData ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <div className="flex-1 space-y-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : followers.length === 0 ? (
                  <div className="py-8 text-center">
                    <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                    <p className="font-body text-sm text-muted-foreground">
                      No followers yet
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-body text-xs text-muted-foreground mb-3 uppercase tracking-wide">
                      {followers.length} follower{followers.length !== 1 ? "s" : ""} · sorted by most recent
                    </p>
                    {followers.map((fu) => (
                      <FollowRow
                        key={fu.id}
                        user={fu}
                        canRemove={isOwner}
                        onRemove={handleRemoveFollower}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Following */}
          <TabsContent value="following">
            <Card className="border-[var(--sd-border-subtle)] bg-[var(--sd-surface)]">
              <CardContent className="p-4">
                {!followingData ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <div className="flex-1 space-y-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : following.length === 0 ? (
                  <div className="py-8 text-center">
                    <UserCheck className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                    <p className="font-body text-sm text-muted-foreground">
                      Not following anyone yet
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-body text-xs text-muted-foreground mb-3 uppercase tracking-wide">
                      {following.length} following · sorted by most recent
                    </p>
                    {following.map((fu) => (
                      <FollowRow key={fu.id} user={fu} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
