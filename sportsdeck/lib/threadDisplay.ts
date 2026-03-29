import type { Match } from "@/types";

/** Query value for GET /api/threads?threadCategory= */
export type ThreadCategoryFilter =
  | ""
  | "match_finished"
  | "match_upcoming"
  | "community";

type ThreadLike = {
  isMatchThread: boolean;
  match?: Pick<
    Match,
    "status" | "homeScore" | "awayScore" | "utcDate"
  > | null;
};

/**
 * Primary label + optional score/status line for forum cards (replaces noisy tag chips).
 */
export function getThreadKindDisplay(thread: ThreadLike): {
  label: string;
  detail?: string;
} {
  if (!thread.isMatchThread) {
    return { label: "Fan thread" };
  }

  const st = thread.match?.status;
  const hs = thread.match?.homeScore;
  const as = thread.match?.awayScore;
  const score =
    hs != null && as != null ? `${hs}–${as}` : null;

  if (st === "FINISHED") {
    return {
      label: "Match",
      detail: score ? `Full time ${score}` : "Full time",
    };
  }
  if (st === "IN_PLAY" || st === "PAUSED") {
    return {
      label: "Live match",
      detail: score ? `${score}` : "In play",
    };
  }
  if (st === "POSTPONED" || st === "SUSPENDED") {
    return { label: "Match", detail: st === "POSTPONED" ? "Postponed" : "Suspended" };
  }
  return {
    label: "Match",
    detail: "Upcoming",
  };
}
