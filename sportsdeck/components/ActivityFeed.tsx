"use client";

import Link from "next/link";
import { formatDistanceShort } from "@/lib/utils";
import { FeedEventGroup } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import {
  MessageSquare,
  MessageCircle,
  Trophy,
  FileText,
  TrendingUp,
  Clock,
} from "lucide-react";

interface ActivityFeedProps {
  events: FeedEventGroup[];
  className?: string;
}

function getEventIcon(type: FeedEventGroup["type"]) {
  switch (type) {
    case "new_thread":
      return <FileText className="h-4 w-4" />;
    case "new_post":
      return <MessageSquare className="h-4 w-4" />;
    case "new_reply":
      return <MessageCircle className="h-4 w-4" />;
    case "new_match":
      return <Trophy className="h-4 w-4" />;
    case "match_score":
      return <TrendingUp className="h-4 w-4" />;
    case "match_status":
      return <Clock className="h-4 w-4" />;
    default:
      return <MessageSquare className="h-4 w-4" />;
  }
}

function getEventText(event: FeedEventGroup): { primary: string; secondary?: string } {
  const actorName = event.actor.username;
  const count = event.count > 1 ? ` and ${event.count - 1} other${event.count > 2 ? "s" : ""}` : "";

  switch (event.type) {
    case "new_thread":
      return {
        primary: `${actorName}${count} started a thread`,
        secondary: event.thread?.title,
      };
    case "new_post":
      return {
        primary: `${actorName}${count} posted in ${event.thread?.title || "a thread"}`,
        secondary: event.post?.content,
      };
    case "new_reply":
      return {
        primary: `${actorName}${count} replied in ${event.thread?.title || "a thread"}`,
        secondary: event.post?.content,
      };
    case "new_match":
      return {
        primary: `New match: ${event.match?.homeTeam.shortName} vs ${event.match?.awayTeam.shortName}`,
      };
    case "match_score":
      return {
        primary: `Goal! ${event.match?.homeTeam.shortName} ${event.match?.homeScore} - ${event.match?.awayScore} ${event.match?.awayTeam.shortName}`,
      };
    case "match_status":
      return {
        primary: `Match ${event.match?.status.toLowerCase()}: ${event.match?.homeTeam.shortName} vs ${event.match?.awayTeam.shortName}`,
      };
    default:
      return { primary: "Activity" };
  }
}

function getEventLink(event: FeedEventGroup): string | null {
  if (event.thread) {
    return `/forums/${event.thread.id}`;
  }
  if (event.match) {
    return `/matches/${event.match.id}`;
  }
  return null;
}

export default function ActivityFeed({ events, className }: ActivityFeedProps) {
  if (events.length === 0) {
    return (
      <Card className="border-[var(--sd-border-subtle)] bg-[var(--sd-surface)]">
        <CardContent className="py-12 text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="font-body text-muted-foreground">No activity yet</p>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Follow users and teams to see updates here
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      {events.map((event, index) => {
        const { primary, secondary } = getEventText(event);
        const link = getEventLink(event);
        const isUnread = !event.isRead;

        const content = (
          <Card
            className={`border-[var(--sd-border-subtle)] transition-all hover:border-[var(--sd-accent)]/30 ${
              isUnread ? "bg-[var(--sd-surface-raised)]" : "bg-[var(--sd-surface)]"
            }`}
          >
            <CardContent className="p-4">
              <div className="flex gap-3">
                <Link href={`/users/${event.actor.id}`} className="shrink-0">
                  <Avatar className="h-10 w-10 border-2 border-[var(--sd-border-subtle)]">
                    <AvatarImage src={event.actor.avatar || undefined} />
                    <AvatarFallback className="bg-[var(--sd-accent)]/10 text-[var(--sd-accent)] font-display font-bold">
                      {event.actor.username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Link>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 mb-1">
                    <div className="text-[var(--sd-accent)] mt-1">{getEventIcon(event.type)}</div>
                    <div className="flex-1">
                      <p className="font-body text-sm text-foreground">{primary}</p>
                      {secondary && (
                        <p className="font-body text-sm text-muted-foreground mt-1 line-clamp-2">
                          {secondary}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <span className="font-body text-xs text-muted-foreground">
                      {formatDistanceShort(new Date(event.createdAt))}
                    </span>
                    {isUnread && (
                      <span className="inline-block h-2 w-2 rounded-full bg-[var(--sd-accent)]" />
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );

        return link ? (
          <Link key={`${event.groupKey || "event"}-${index}`} href={link}>
            {content}
          </Link>
        ) : (
          <div key={`${event.groupKey || "event"}-${index}`}>{content}</div>
        );
      })}
    </div>
  );
}
