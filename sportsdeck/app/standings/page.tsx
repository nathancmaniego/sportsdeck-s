// Prompt: Build the Standings page — full Premier League table with position, team
// crest + name, matches played, W/D/L, goals for/against, goal difference, and
// points. Top 4 rows get accent left border (Champions League), bottom 3 get danger
// left border (relegation). Alternating row tints. Fetches from GET /api/standings.
// Responsive — horizontal scroll on mobile. Loading skeleton while fetching.
// Claude claude-4.6-opus-high-thinking

"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { Standing } from "@/types";

function TeamCrest({ url, name }: { url?: string; name: string }) {
  if (!url) {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded bg-[var(--sd-accent-muted)]">
        <span className="font-display text-[8px] font-bold text-[var(--sd-accent)]">
          {name.slice(0, 3).toUpperCase()}
        </span>
      </div>
    );
  }
  return (
    <Image
      src={url}
      alt={name}
      width={24}
      height={24}
      className="h-6 w-6 object-contain"
    />
  );
}

function getRowBorderClass(position: number, total: number): string {
  if (position <= 4) return "accent-border-left";
  if (position === 5) return "europa-border-left";
  if (position === 6) return "conference-border-left";
  if (position > total - 3) return "danger-border-left";
  return "border-l-3 border-l-transparent";
}

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-lg bg-[var(--sd-surface)] px-4 py-3"
        >
          <Skeleton className="h-4 w-6" />
          <Skeleton className="h-6 w-6 rounded" />
          <Skeleton className="h-4 w-32" />
          <div className="ml-auto flex gap-4">
            {Array.from({ length: 5 }).map((_, j) => (
              <Skeleton key={j} className="h-4 w-8" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const STAT_HEADERS = [
  { key: "playedGames", label: "MP", title: "Matches Played" },
  { key: "won", label: "W", title: "Won" },
  { key: "draw", label: "D", title: "Drawn" },
  { key: "lost", label: "L", title: "Lost" },
  { key: "goalsFor", label: "GF", title: "Goals For" },
  { key: "goalsAgainst", label: "GA", title: "Goals Against" },
  { key: "goalDifference", label: "GD", title: "Goal Difference" },
  { key: "points", label: "Pts", title: "Points" },
] as const;

export default function StandingsPage() {
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchStandings() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ standings: Standing[] }>("/api/standings");
      setStandings(res.standings);
    } catch {
      setError("Failed to load standings. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStandings();
  }, []);

  const totalTeams = standings.length;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-8">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.25em] text-[var(--sd-accent)] mb-2">
          Premier League
        </p>
        <h1 className="font-display text-4xl font-extrabold uppercase tracking-tight sm:text-5xl">
          Standings
        </h1>
      </div>

      {/* Legend */}
      <div className="mb-6 flex flex-wrap items-center gap-4 text-xs text-muted-foreground font-body">
        <div className="flex items-center gap-2">
          <span className="h-3 w-1 rounded-full bg-[var(--sd-accent)]" />
          Champions League
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-1 rounded-full bg-[var(--sd-europa)]" />
          Europa League
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-1 rounded-full bg-[var(--sd-conference)]" />
          Conference League
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-1 rounded-full bg-[var(--sd-danger)]" />
          Relegation
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-[var(--sd-danger)]/20 bg-[var(--sd-danger-muted)] p-6 text-center">
          <p className="font-body text-sm text-[var(--sd-danger)]">{error}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchStandings}
            className="mt-3 text-[var(--sd-danger)]"
          >
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--sd-border-subtle)]">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-[var(--sd-border-subtle)] bg-[var(--sd-surface)]">
                <th className="w-12 px-4 py-3 text-left font-display text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  #
                </th>
                <th className="px-4 py-3 text-left font-display text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Team
                </th>
                {STAT_HEADERS.map((h) => (
                  <th
                    key={h.key}
                    title={h.title}
                    className="w-12 px-2 py-3 text-center font-display text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {standings.map((row, i) => (
                <tr
                  key={row.position}
                  className={`border-b border-[var(--sd-border-subtle)] last:border-b-0 transition-colors hover:bg-[var(--sd-surface-raised)] ${
                    i % 2 === 0 ? "row-tint-even" : "row-tint-odd"
                  }`}
                >
                  <td className="px-4 py-3">
                    <div
                      className={`flex items-center ${getRowBorderClass(row.position, totalTeams)} pl-2`}
                    >
                      <span className="font-display text-sm font-bold tabular-nums">
                        {row.position}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <TeamCrest url={row.team.crest} name={row.team.name} />
                      <span className="font-display text-sm font-semibold tracking-tight">
                        {row.team.name}
                      </span>
                    </div>
                  </td>
                  {STAT_HEADERS.map((h) => (
                    <td
                      key={h.key}
                      className={`px-2 py-3 text-center font-body text-sm tabular-nums ${
                        h.key === "points"
                          ? "font-display font-bold text-[var(--sd-accent)]"
                          : h.key === "goalDifference"
                            ? "font-semibold"
                            : "text-muted-foreground"
                      }`}
                    >
                      {h.key === "goalDifference" && row[h.key] > 0
                        ? `+${row[h.key]}`
                        : row[h.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
