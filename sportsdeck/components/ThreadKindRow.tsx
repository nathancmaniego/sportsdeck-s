"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getThreadKindDisplay } from "@/lib/threadDisplay";
import type { Match } from "@/types";

export type ThreadKindThread = {
  isMatchThread: boolean;
  match?: Pick<Match, "status" | "homeScore" | "awayScore" | "utcDate"> | null;
};

export function ThreadKindRow({ thread }: { thread: ThreadKindThread }) {
  const { label, detail } = getThreadKindDisplay(thread);
  const st = thread.match?.status;
  const live = st === "IN_PLAY" || st === "PAUSED";
  const finished = st === "FINISHED";

  return (
    <div className="flex flex-wrap items-center gap-2 mb-2">
      <Badge
        variant="outline"
        className={cn(
          "font-body text-[10px] font-bold uppercase tracking-wide",
          live &&
            "border-[var(--sd-danger)] bg-[var(--sd-danger-muted)] text-[var(--sd-danger)]",
          !thread.isMatchThread &&
            "border-[var(--sd-accent)]/40 bg-[var(--sd-accent)]/10 text-[var(--sd-accent)]",
          thread.isMatchThread && finished &&
            "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
          thread.isMatchThread && !live && !finished &&
            "border-[var(--sd-border-subtle)] bg-[var(--sd-surface-raised)] text-muted-foreground"
        )}
      >
        {label}
      </Badge>
      {detail ? (
        <span className="text-xs text-muted-foreground font-body">{detail}</span>
      ) : null}
    </div>
  );
}
