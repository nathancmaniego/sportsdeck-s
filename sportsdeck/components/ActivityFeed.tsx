"use client";

import Link from "next/link";
import { formatDistanceShort } from "@/lib/utils";
import { FeedEventGroup } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  MessageCircle,
  Trophy,
  FileText,
  TrendingUp,
  Clock,
  Users,
  BookOpen,
  MessageSquare,
  CalendarDays,
  ChevronRight,
  Dot,
} from "lucide-react";

interface ActivityFeedProps {
  events: FeedEventGroup[];
  className?: string;
  viewerId?: number;
  viewerFavoriteTeamId?: number | null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type MatchEvent = FeedEventGroup & {
  type: "new_match" | "match_score" | "match_status";
};

type SocialEvent = FeedEventGroup & {
  type: "new_post" | "new_reply" | "new_thread" | "my_post";
};

type MatchDateGroup = {
  dateLabel: string;
  isoDate: string;
  events: MatchEvent[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isMatchEvent(e: FeedEventGroup): e is MatchEvent {
  return (
    e.type === "new_match" || e.type === "match_score" || e.type === "match_status"
  );
}

function isOwnFavoriteTeamForumEvent(
  e: FeedEventGroup,
  viewerId?: number,
  favTeamId?: number | null
): boolean {
  if (viewerId == null || favTeamId == null) return false;
  if (e.actor.id !== viewerId) return false;
  const tid = e.thread?.teamId;
  if (tid == null || tid !== favTeamId) return false;
  return (
    e.type === "new_thread" || e.type === "new_post" || e.type === "my_post"
  );
}

function formatMatchDate(utcDate: string): string {
  const d = new Date(utcDate);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  if (sameDay(d, tomorrow)) return "Tomorrow";

  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function groupMatchEventsByDate(events: MatchEvent[]): MatchDateGroup[] {
  const map = new Map<string, MatchDateGroup>();

  const sorted = [...events].sort((a, b) => {
    const dateA = a.match?.utcDate ?? a.createdAt;
    const dateB = b.match?.utcDate ?? b.createdAt;
    return new Date(dateA).getTime() - new Date(dateB).getTime();
  });

  for (const e of sorted) {
    const rawDate = e.match?.utcDate ?? e.createdAt;
    const d = new Date(rawDate);
    const iso = d.toISOString().split("T")[0];
    if (!map.has(iso)) {
      map.set(iso, {
        dateLabel: formatMatchDate(rawDate),
        isoDate: iso,
        events: [],
      });
    }
    map.get(iso)!.events.push(e);
  }

  return Array.from(map.values());
}

function getMatchStatusLabel(status: string, type: MatchEvent["type"]): {
  label: string;
  color: string;
  bg: string;
} {
  if (type === "new_match" || status === "SCHEDULED" || status === "TIMED") {
    return {
      label: "Upcoming",
      color: "text-sky-400",
      bg: "bg-sky-500/10",
    };
  }
  if (status === "IN_PLAY" || status === "PAUSED") {
    return {
      label: "Live",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    };
  }
  if (status === "FINISHED") {
    return {
      label: "Full time",
      color: "text-[var(--sd-accent)]",
      bg: "bg-[var(--sd-accent)]/10",
    };
  }
  return {
    label: status.replace(/_/g, " ").toLowerCase(),
    color: "text-orange-400",
    bg: "bg-orange-500/10",
  };
}

// ─── Match card ───────────────────────────────────────────────────────────────

function MatchCard({ event }: { event: MatchEvent }) {
  const m = event.match;
  if (!m) return null;

  const { label, color, bg } = getMatchStatusLabel(m.status, event.type);
  const hasScore = m.homeScore != null && m.awayScore != null;
  const isFinished = m.status === "FINISHED";
  const isLive = m.status === "IN_PLAY" || m.status === "PAUSED";
  const link = `/matches/${m.id}`;

  return (
    <Link
      href={link}
      className="group block rounded-xl border border-transparent hover:border-[var(--sd-border-subtle)] hover:bg-[var(--sd-surface-raised)] transition-all duration-150"
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* Home team */}
        <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
          <span
            className={`font-body text-sm truncate text-right ${
              isFinished && hasScore && m.homeScore! > m.awayScore!
                ? "font-semibold text-foreground"
                : "text-muted-foreground"
            }`}
          >
            {m.homeTeam.shortName}
          </span>
          {m.homeTeam.crestUrl && (
            <img
              src={m.homeTeam.crestUrl}
              alt={m.homeTeam.shortName}
              className="h-5 w-5 object-contain shrink-0"
            />
          )}
        </div>

        {/* Score / vs */}
        <div className="flex flex-col items-center shrink-0 w-16">
          {hasScore ? (
            <span
              className={`font-display text-base font-bold tabular-nums ${
                isLive ? "text-emerald-400" : "text-foreground"
              }`}
            >
              {m.homeScore} – {m.awayScore}
            </span>
          ) : (
            <span className="font-body text-xs text-muted-foreground">vs</span>
          )}
          <span
            className={`font-body text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded mt-0.5 ${bg} ${color}`}
          >
            {isLive && (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse" />
            )}
            {label}
          </span>
        </div>

        {/* Away team */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {m.awayTeam.crestUrl && (
            <img
              src={m.awayTeam.crestUrl}
              alt={m.awayTeam.shortName}
              className="h-5 w-5 object-contain shrink-0"
            />
          )}
          <span
            className={`font-body text-sm truncate ${
              isFinished && hasScore && m.awayScore! > m.homeScore!
                ? "font-semibold text-foreground"
                : "text-muted-foreground"
            }`}
          >
            {m.awayTeam.shortName}
          </span>
        </div>

        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 group-hover:text-muted-foreground transition-colors" />
      </div>
    </Link>
  );
}

// ─── Team sidebar ─────────────────────────────────────────────────────────────

function TeamSidebar({ matchGroups }: { matchGroups: MatchDateGroup[] }) {
  if (matchGroups.length === 0) return null;

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-5">
      {matchGroups.map((group) => {
        const isPast = group.isoDate < today;
        const isToday = group.isoDate === today;

        return (
          <div key={group.isoDate}>
            {/* Date header */}
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays
                className={`h-3.5 w-3.5 shrink-0 ${
                  isToday ? "text-[var(--sd-accent)]" : "text-muted-foreground"
                }`}
              />
              <span
                className={`font-display text-[11px] font-bold uppercase tracking-widest ${
                  isToday ? "text-[var(--sd-accent)]" : "text-muted-foreground"
                }`}
              >
                {group.dateLabel}
              </span>
              <div className="flex-1 h-px bg-[var(--sd-border-subtle)]" />
            </div>

            {/* Match cards */}
            <div className="space-y-0.5">
              {group.events.map((event, i) => (
                <MatchCard key={event.groupKey ?? i} event={event} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Social event card ────────────────────────────────────────────────────────

type SocialSection = "replies" | "following" | "yours";

function buildSocialText(
  event: FeedEventGroup,
  section: SocialSection,
  viewerId?: number
): { headline: string; sub: string | null } {
  const actor = event.actor.username;
  const more = event.count - 1;
  const others = more === 1 ? "1 other" : more > 1 ? `${more} others` : "";
  const who = others ? `${actor} + ${others}` : actor;
  const thread = event.thread?.title ? `"${event.thread.title}"` : null;

  switch (event.type) {
    case "new_reply":
      return {
        headline: `${who} replied to you`,
        sub: thread,
      };
    case "new_thread":
      return {
        headline: `${who} started a new thread`,
        sub: thread,
      };
    case "new_post":
      return {
        headline: `${who} posted`,
        sub: thread,
      };
    case "my_post":
      return {
        headline: "You posted",
        sub: thread,
      };
    default:
      return { headline: "Activity", sub: null };
  }
}

const SECTION_ICON: Record<SocialSection, React.FC<{ className?: string }>> = {
  replies: MessageCircle,
  following: Users,
  yours: BookOpen,
};

const SECTION_COLOR: Record<SocialSection, string> = {
  replies: "text-indigo-400",
  following: "text-blue-400",
  yours: "text-violet-400",
};

const SECTION_LABEL: Record<SocialSection, string> = {
  replies: "Replies to you",
  following: "From people you follow",
  yours: "Your forum activity",
};

const EVENT_PILL: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  new_reply: {
    label: "Reply",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
  },
  new_thread: {
    label: "Thread",
    color: "text-[var(--sd-accent)]",
    bg: "bg-[var(--sd-accent)]/10",
  },
  new_post: { label: "Post", color: "text-blue-400", bg: "bg-blue-500/10" },
  my_post: {
    label: "Your post",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
  },
};

const AVATAR_COLOR: Record<SocialSection, string> = {
  replies: "bg-indigo-500/10 text-indigo-400",
  following: "bg-blue-500/10 text-blue-400",
  yours: "bg-violet-500/10 text-violet-400",
};

function SocialEventCard({
  event,
  section,
  viewerId,
}: {
  event: FeedEventGroup;
  section: SocialSection;
  viewerId?: number;
}) {
  const { headline, sub } = buildSocialText(event, section, viewerId);
  const pill = EVENT_PILL[event.type] ?? EVENT_PILL.new_post;
  const threadHref = event.thread
    ? `/forums/${event.thread.teamId ?? "general"}/${event.thread.id}`
    : null;
  const snippet =
    event.type === "new_post" ||
    event.type === "new_reply" ||
    event.type === "my_post"
      ? event.post?.content
      : null;
  const avatarColors = AVATAR_COLOR[section];

  const headlineAfterUser =
    section === "yours"
      ? headline
      : headline
          .replace(event.actor.username, "")
          .replace(/^\s*\+?\s*\d+\s*others?\s*/, "")
          .trimStart();

  /** Thread links are separate from user links — never nest <a> inside <a>. */
  const HeadlineThread = threadHref
    ? ({ children }: { children: React.ReactNode }) => (
        <Link
          href={threadHref}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {children}
        </Link>
      )
    : ({ children }: { children: React.ReactNode }) => (
        <span className="text-muted-foreground">{children}</span>
      );

  const DetailThread = threadHref
    ? ({ children }: { children: React.ReactNode }) => (
        <Link href={threadHref} className="block mt-1">
          {children}
        </Link>
      )
    : ({ children }: { children: React.ReactNode }) => <>{children}</>;

  return (
    <div className="group flex gap-3 items-start px-4 py-3.5 rounded-xl border border-transparent hover:border-[var(--sd-border-subtle)] hover:bg-[var(--sd-surface-raised)] transition-all duration-150">
      {section !== "yours" ? (
        <Link href={`/users/${event.actor.id}`} className="shrink-0">
          <Avatar className="h-8 w-8 border border-[var(--sd-border-subtle)]">
            <AvatarImage src={event.actor.avatar ?? undefined} />
            <AvatarFallback className={`font-display font-bold text-xs ${avatarColors}`}>
              {event.actor.username[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>
      ) : (
        <div className={`h-8 w-8 rounded-full shrink-0 flex items-center justify-center ${avatarColors}`}>
          <BookOpen className="h-3.5 w-3.5" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="font-body text-sm text-foreground leading-snug">
          {section !== "yours" && (
            <>
              <Link
                href={`/users/${event.actor.id}`}
                className="font-semibold hover:underline"
              >
                {event.actor.username}
              </Link>{" "}
            </>
          )}
          <HeadlineThread>
            <span>{headlineAfterUser}</span>
            {sub && <span className="text-foreground/70"> in {sub}</span>}
          </HeadlineThread>
        </p>

        <DetailThread>
          {snippet && (
            <p className="font-body text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {snippet}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className={`font-body text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${pill.bg} ${pill.color}`}
            >
              {pill.label}
            </span>
            <Dot className="h-3 w-3 text-muted-foreground/40" />
            <span className="font-body text-xs text-muted-foreground">
              {formatDistanceShort(event.createdAt)}
            </span>
            {event.count > 1 && (
              <>
                <Dot className="h-3 w-3 text-muted-foreground/40" />
                <span className="font-body text-xs text-muted-foreground">
                  {event.count} updates
                </span>
              </>
            )}
          </div>
        </DetailThread>
      </div>

      {threadHref ? (
        <Link
          href={threadHref}
          className="shrink-0 mt-1 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors"
          aria-label="Open thread"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      ) : (
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mt-1 group-hover:text-muted-foreground transition-colors" />
      )}
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function FeedSection({
  section,
  events,
  viewerId,
}: {
  section: SocialSection;
  events: FeedEventGroup[];
  viewerId?: number;
}) {
  if (events.length === 0) return null;

  const Icon = SECTION_ICON[section];
  const color = SECTION_COLOR[section];
  const label = SECTION_LABEL[section];

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-2 pt-2 pb-1 px-1 mb-1">
        <Icon className={`h-3.5 w-3.5 ${color}`} />
        <span
          className={`font-display text-[10px] font-bold uppercase tracking-widest ${color}`}
        >
          {label}
        </span>
        <div className="flex-1 h-px bg-[var(--sd-border-subtle)]" />
        <span className="font-body text-[10px] text-muted-foreground tabular-nums">
          {events.length}
        </span>
      </div>

      <div className="space-y-0.5">
        {events.map((event, i) => (
          <SocialEventCard
            key={event.groupKey ?? i}
            event={event}
            section={section}
            viewerId={viewerId}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Team forum own-posts section inside sidebar ──────────────────────────────

function TeamForumSection({
  events,
  viewerId,
}: {
  events: FeedEventGroup[];
  viewerId?: number;
}) {
  if (events.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 pt-2 pb-1 px-1 mb-1">
        <FileText className="h-3.5 w-3.5 text-[var(--sd-accent)]" />
        <span className="font-display text-[10px] font-bold uppercase tracking-widest text-[var(--sd-accent)]">
          Your team forum
        </span>
        <div className="flex-1 h-px bg-[var(--sd-border-subtle)]" />
      </div>

      <div className="space-y-0.5">
        {events.map((event, i) => (
          <SocialEventCard
            key={event.groupKey ?? i}
            event={event}
            section="yours"
            viewerId={viewerId}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-8">
      <div className="h-14 w-14 rounded-2xl bg-[var(--sd-surface-raised)] flex items-center justify-center mb-4 border border-[var(--sd-border-subtle)]">
        <MessageSquare className="h-6 w-6 text-muted-foreground opacity-40" />
      </div>
      <p className="font-display text-base text-foreground font-semibold mb-1">
        Nothing here yet
      </p>
      <p className="font-body text-sm text-muted-foreground max-w-xs leading-relaxed">
        Follow users to see their posts, and set a favourite team on your
        profile to see match results and upcoming fixtures.
      </p>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function ActivityFeed({
  events,
  className,
  viewerId,
  viewerFavoriteTeamId,
}: ActivityFeedProps) {
  if (events.length === 0) {
    return <EmptyState />;
  }

  // Partition events
  const repliesEvents = events.filter((e) => e.type === "new_reply");

  const followingEvents = events.filter(
    (e) =>
      (e.type === "new_post" || e.type === "new_thread") &&
      !isOwnFavoriteTeamForumEvent(e, viewerId, viewerFavoriteTeamId)
  );

  const ownActivityEvents = events.filter(
    (e) =>
      e.type === "my_post" &&
      !isOwnFavoriteTeamForumEvent(e, viewerId, viewerFavoriteTeamId)
  );

  const teamForumEvents = events.filter((e) =>
    isOwnFavoriteTeamForumEvent(e, viewerId, viewerFavoriteTeamId)
  );

  const matchEvents = events.filter(isMatchEvent);
  const matchGroups = groupMatchEventsByDate(matchEvents);

  const hasTeamSidebar =
    matchGroups.length > 0 || teamForumEvents.length > 0;

  return (
    <div
      className={`grid gap-8 ${
        hasTeamSidebar
          ? "grid-cols-1 lg:grid-cols-2 lg:max-w-7xl 7xl"
          : "grid-cols-1"
      } ${className ?? ""}`}
    >
      {/* ── Left: social feed ─────────────────────────────────────────────── */}
      <div className="space-y-6 min-w-0">
        <FeedSection
          section="replies"
          events={repliesEvents}
          viewerId={viewerId}
        />
        <FeedSection
          section="following"
          events={followingEvents}
          viewerId={viewerId}
        />
        <FeedSection
          section="yours"
          events={ownActivityEvents}
          viewerId={viewerId}
        />

        {/* Empty social state when only match events exist */}
        {repliesEvents.length === 0 &&
          followingEvents.length === 0 &&
          ownActivityEvents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-10 w-10 rounded-xl bg-[var(--sd-surface-raised)] flex items-center justify-center mb-3 border border-[var(--sd-border-subtle)]">
                <Users className="h-4 w-4 text-muted-foreground opacity-40" />
              </div>
              <p className="font-body text-sm text-muted-foreground">
                No social activity yet.{" "}
                <Link
                  href="/users"
                  className="text-[var(--sd-accent)] hover:underline"
                >
                  Find people to follow
                </Link>
              </p>
            </div>
          )}
      </div>

      {/* ── Right: team sidebar ───────────────────────────────────────────── */}
      {hasTeamSidebar && (
        <div className="space-y-6 lg:border-l lg:border-[var(--sd-border-subtle)] lg:pl-6">
          {/* Sidebar header */}
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-400" />
            <span className="font-display text-sm font-bold text-foreground">
              Your Team
            </span>
          </div>

          {/* Match timeline */}
          {matchGroups.length > 0 && (
            <TeamSidebar matchGroups={matchGroups} />
          )}

          {/* Team forum own posts */}
          {teamForumEvents.length > 0 && (
            <TeamForumSection events={teamForumEvents} viewerId={viewerId} />
          )}
        </div>
      )}
    </div>
  );
}