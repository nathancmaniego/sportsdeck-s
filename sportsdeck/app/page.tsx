// Prompt: SportsDeck landing page — hero section with bold typographic treatment,
// quick links to Matches, Standings, Forums. Uses design system tokens.
// Claude claude-4.6-opus-high-thinking

import Link from "next/link";
import { Trophy, MessageSquare, BarChart3 } from "lucide-react";

const QUICK_LINKS = [
  {
    href: "/matches",
    icon: Trophy,
    title: "Matches",
    desc: "Live scores, upcoming fixtures, and full match details.",
  },
  {
    href: "/standings",
    icon: BarChart3,
    title: "Standings",
    desc: "Current Premier League table with full stats.",
  },
  {
    href: "/forums",
    icon: MessageSquare,
    title: "Forums",
    desc: "Join the discussion — match threads, team talk, and more.",
  },
] as const;

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative flex min-h-[70vh] flex-col items-center justify-center px-4 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--sd-accent)]/5 to-transparent pointer-events-none" />
        <div className="relative z-10">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.25em] text-[var(--sd-accent)] mb-4">
            Premier League Fan Hub
          </p>
          <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.95] tracking-tight sm:text-7xl md:text-8xl">
            Live the
            <br />
            <span className="text-[var(--sd-accent)]">Beautiful Game</span>
          </h1>
          <p className="mt-6 max-w-xl mx-auto text-lg text-muted-foreground font-body leading-relaxed">
            Scores, standings, forums, and community — everything a Premier
            League fan needs, all in one place.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/matches"
              className="inline-flex items-center justify-center rounded-md bg-[var(--sd-accent)] px-8 py-3 font-display font-semibold uppercase tracking-wide text-sm text-[var(--sd-bg)] transition-opacity hover:opacity-90"
            >
              View Matches
            </Link>
            <Link
              href="/forums"
              className="inline-flex items-center justify-center rounded-md border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] px-8 py-3 font-display font-semibold uppercase tracking-wide text-sm text-foreground transition-colors hover:bg-[var(--sd-surface-raised)]"
            >
              Join Forums
            </Link>
          </div>
        </div>
      </section>

      {/* Quick links */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-3">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="card-hover group rounded-xl border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] p-6"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--sd-accent-muted)]">
                <link.icon className="h-5 w-5 text-[var(--sd-accent)]" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold uppercase tracking-tight">
                {link.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground font-body leading-relaxed">
                {link.desc}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
