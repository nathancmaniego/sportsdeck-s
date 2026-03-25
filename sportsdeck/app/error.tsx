// Prompt: Error boundary — 'use client', accepts error + reset props,
// styled retry button consistent with design system.
// Claude claude-4.6-opus-high-thinking

"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[SportsDeck Error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--sd-danger-muted)]">
        <AlertTriangle className="h-8 w-8 text-[var(--sd-danger)]" />
      </div>
      <h2 className="mt-6 font-display text-3xl font-bold uppercase tracking-tight">
        Something went wrong
      </h2>
      <p className="mt-3 max-w-md text-muted-foreground font-body text-lg">
        An unexpected error occurred. The ref might need to review the footage.
      </p>
      <Button
        onClick={reset}
        className="mt-8 bg-[var(--sd-accent)] text-[var(--sd-bg)] hover:bg-[var(--sd-accent)]/90 font-display font-semibold uppercase tracking-wide"
      >
        Try again
      </Button>
    </div>
  );
}
