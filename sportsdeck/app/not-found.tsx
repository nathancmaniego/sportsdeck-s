// Prompt: 404 page — display font "404" at text-8xl, matchday headline
// "That's offside.", helpful subline, link home in accent color.
// Claude claude-4.6-opus-high-thinking

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-[8rem] font-extrabold leading-none tracking-tighter text-[var(--sd-accent)] sm:text-[10rem]">
        404
      </h1>
      <h2 className="mt-4 font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
        That&apos;s offside.
      </h2>
      <p className="mt-3 max-w-md text-muted-foreground font-body text-lg">
        VAR checked. This page doesn&apos;t exist. Head back to the pitch and
        try a different play.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center rounded-md bg-[var(--sd-accent)] px-6 py-3 font-display font-semibold uppercase tracking-wide text-sm text-[var(--sd-bg)] transition-opacity hover:opacity-90"
      >
        Back to Home
      </Link>
    </div>
  );
}
