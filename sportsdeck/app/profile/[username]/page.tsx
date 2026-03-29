// User public profile page — shows stats, recent threads/posts, follow and report buttons.
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users, MessageSquare, FileText, UserPlus, UserMinus } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { formatDistanceShort } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import ReportDialog from '@/components/ReportDialog'

interface UserProfile {
  id: number
  username: string
  avatar: string | null
  createdAt: string
  isBanned: boolean
  isFollowedByMe: boolean
  favoriteTeam: { id: number; name: string; shortName: string; tla: string; crestUrl: string | null } | null
  _count: { followers: number; following: number; threads: number; posts: number }
  threads: { id: number; title: string; createdAt: string; team: { id: number; shortName: string; tla: string } | null }[]
  posts: { id: number; content: string; createdAt: string; parentId: number | null; thread: { id: number; title: string; teamId: number } }[]
}

export default function UserProfilePage() {
  const params = useParams()
  const username = params.username as string
  const { user: me } = useAuth()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [following, setFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // The GET /api/users/[id] route accepts numeric ids. Find by username by
      // fetching with the username string — the route also accepts username lookup.
      const data = await apiFetch<{ user: UserProfile }>(`/api/users/by-username/${encodeURIComponent(username)}`)
      setProfile(data.user)
      setFollowing(data.user.isFollowedByMe)
    } catch {
      setError('User not found.')
    } finally {
      setLoading(false)
    }
  }, [username])

  useEffect(() => { loadProfile() }, [loadProfile])

  const handleFollow = async () => {
    if (!profile) return
    setFollowLoading(true)
    try {
      if (following) {
        await apiFetch(`/api/users/${profile.id}/follow`, { method: 'DELETE' })
        setFollowing(false)
      } else {
        await apiFetch(`/api/users/${profile.id}/follow`, { method: 'POST' })
        setFollowing(true)
      }
    } catch {
      // ignore — auth errors are handled by apiFetch
    } finally {
      setFollowLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-4 w-32 mb-8" />
        <div className="flex items-center gap-4 mb-8">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
        <p className="font-body text-muted-foreground">{error ?? 'User not found.'}</p>
      </div>
    )
  }

  const isOwnProfile = me?.id === profile.id

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/forums"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-[var(--sd-accent)] font-body mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      {/* Profile header */}
      <div className="rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-5 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {profile.avatar ? (
              <img
                src={profile.avatar}
                alt={profile.username}
                className="h-14 w-14 rounded-full object-cover border border-[var(--sd-border-subtle)]"
              />
            ) : (
              <div className="h-14 w-14 rounded-full bg-[var(--sd-surface-raised)] border border-[var(--sd-border-subtle)] flex items-center justify-center">
                <span className="font-display text-xl font-extrabold uppercase text-[var(--sd-accent)]">
                  {profile.username[0]}
                </span>
              </div>
            )}
            <div>
              <h1 className="font-display text-2xl font-extrabold uppercase tracking-tight">
                {profile.username}
              </h1>
              <p className="font-body text-xs text-muted-foreground mt-0.5">
                Joined {formatDistanceShort(profile.createdAt)}
              </p>
              {profile.favoriteTeam && (
                <p className="font-body text-xs text-muted-foreground mt-0.5">
                  Supports{' '}
                  <span className="font-semibold text-foreground">{profile.favoriteTeam.name}</span>
                </p>
              )}
            </div>
          </div>

          {/* Actions — only shown to other logged-in users */}
          {me && !isOwnProfile && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleFollow}
                disabled={followLoading}
                className="gap-1.5 font-display font-semibold uppercase tracking-wide text-xs"
              >
                {following ? (
                  <><UserMinus className="h-3.5 w-3.5" /> Unfollow</>
                ) : (
                  <><UserPlus className="h-3.5 w-3.5" /> Follow</>
                )}
              </Button>
              <ReportDialog
                target={{ type: 'user', id: profile.id, label: profile.username }}
              />
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-4 divide-x divide-[var(--sd-border-subtle)] border-t border-[var(--sd-border-subtle)] pt-4">
          {[
            { icon: Users, label: 'Followers', value: profile._count.followers },
            { icon: Users, label: 'Following', value: profile._count.following },
            { icon: FileText, label: 'Threads', value: profile._count.threads },
            { icon: MessageSquare, label: 'Posts', value: profile._count.posts },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex flex-col items-center gap-1 px-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="font-display text-xl font-extrabold">{value}</span>
              <span className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent threads */}
      {profile.threads.length > 0 && (
        <section className="mb-6">
          <h2 className="font-display text-[10px] font-bold uppercase tracking-widest text-[var(--sd-accent)] mb-3">
            Recent Threads
          </h2>
          <div className="space-y-2">
            {profile.threads.map((t) => (
              <Link
                key={t.id}
                href={`/forums/${t.team?.id ?? 0}/${t.id}`}
                className="block rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-4 hover:border-[var(--sd-accent)] transition-colors"
              >
                <p className="font-display text-sm font-bold uppercase tracking-tight line-clamp-1">
                  {t.title}
                </p>
                <p className="font-body text-xs text-muted-foreground mt-1">
                  {t.team?.shortName ?? 'General'} · {formatDistanceShort(t.createdAt)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent posts */}
      {profile.posts.length > 0 && (
        <section>
          <h2 className="font-display text-[10px] font-bold uppercase tracking-widest text-[var(--sd-accent)] mb-3">
            Recent Posts
          </h2>
          <div className="space-y-2">
            {profile.posts.map((p) => (
              <Link
                key={p.id}
                href={`/forums/${p.thread.teamId}/${p.thread.id}#post-${p.id}`}
                className="block rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-4 hover:border-[var(--sd-accent)] transition-colors"
              >
                <p className="font-body text-sm text-foreground line-clamp-2 whitespace-pre-wrap">
                  {p.content}
                </p>
                <p className="font-body text-xs text-muted-foreground mt-1">
                  in{' '}
                  <span className="font-semibold text-foreground">{p.thread.title}</span>
                  {' · '}
                  {formatDistanceShort(p.createdAt)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {profile.threads.length === 0 && profile.posts.length === 0 && (
        <p className="text-center font-body text-sm text-muted-foreground py-12">
          No public activity yet.
        </p>
      )}
    </div>
  )
}

