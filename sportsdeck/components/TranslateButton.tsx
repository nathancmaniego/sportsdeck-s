"use client";

import { useState } from "react";
import { Languages, Loader2 } from "lucide-react";
import { translatePlainText, translatePostToEnglish } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BaseProps = {
  sourceText: string;
  className?: string;
  /** `title` uses thread heading styles; default is post body. */
  tone?: "body" | "title";
};

type PostProps = BaseProps & {
  mode: "post";
  postId: number;
};

type TextProps = BaseProps & {
  mode: "text";
};

export type TranslateToEnglishProps = PostProps | TextProps;

/**
 * Translate thread title (mode=text → POST /api/translate) or post body
 * (mode=post → POST /api/posts/[id]/translate, cached in DB).
 */
export default function TranslateToEnglish(props: TranslateToEnglishProps) {
  const { sourceText, className, tone = "body" } = props;
  const [showEnglish, setShowEnglish] = useState(false);
  const [english, setEnglish] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchTranslation() {
    setLoading(true);
    setError(null);
    try {
      const res =
        props.mode === "post"
          ? await translatePostToEnglish(props.postId)
          : await translatePlainText(sourceText);
      setEnglish(res.content);
      setShowEnglish(true);
    } catch {
      setError("Could not translate. Try again later.");
    } finally {
      setLoading(false);
    }
  }

  const sameAsSource =
    english != null && english.trim() === sourceText.trim();
  const displayText =
    showEnglish && english != null ? english : sourceText;

  const textClass =
    tone === "title"
      ? "font-display text-3xl font-extrabold uppercase tracking-tight sm:text-4xl text-foreground"
      : "font-body text-sm leading-relaxed text-foreground whitespace-pre-wrap";

  const ContentTag = tone === "title" ? "h1" : "p";

  return (
    <div className={cn("space-y-2", className)}>
      <ContentTag className={textClass}>{displayText}</ContentTag>

      <div className="flex flex-wrap items-center gap-2">
        {english == null ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={fetchTranslation}
            disabled={loading || !sourceText.trim()}
            className="h-8 gap-1.5 px-2 text-xs font-body text-[var(--sd-accent)] hover:text-[var(--sd-accent)]"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
            ) : (
              <Languages className="h-3.5 w-3.5 shrink-0" aria-hidden />
            )}
            Translate to English
          </Button>
        ) : sameAsSource ? (
          <span className="text-xs text-muted-foreground font-body">
            Already in English.
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setShowEnglish((s) => !s)}
            className="text-xs font-body font-medium text-[var(--sd-accent)] hover:underline"
          >
            {showEnglish ? "Show original" : "Show English"}
          </button>
        )}
      </div>
      {error && (
        <p className="text-xs text-[var(--sd-danger)] font-body" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
