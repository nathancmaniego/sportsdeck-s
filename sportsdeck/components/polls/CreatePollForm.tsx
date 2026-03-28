// Prompt: Create poll in a thread — react-hook-form + zod for question/deadline; local
// state for dynamic options (min 2). POST /api/threads/[id]/polls. Collapsible card.
// Claude claude-4.6-opus-high-thinking

"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { createThreadPoll } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DateTimePicker } from "@/components/ui/date-time-picker";

const baseSchema = z.object({
  question: z.string().min(1, "Enter a question"),
  deadline: z.date({ message: "Pick a deadline" }),
});

type BaseForm = z.infer<typeof baseSchema>;

export default function CreatePollForm({
  threadId,
  onCreated,
  className,
}: {
  threadId: number;
  onCreated?: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [options, setOptions] = useState<string[]>(["", ""]);

  const form = useForm<BaseForm>({
    resolver: zodResolver(baseSchema),
    defaultValues: { question: "", deadline: undefined },
  });

  const setOption = (index: number, value: string) => {
    setOptions((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const addOption = () => setOptions((prev) => [...prev, ""]);
  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (values: BaseForm) => {
    const trimmed = options.map((o) => o.trim()).filter(Boolean);
    if (trimmed.length < 2) {
      toast.error("Add at least two non-empty options");
      return;
    }
    if (!values.deadline || values.deadline <= new Date()) {
      toast.error("Deadline must be in the future");
      return;
    }
    setSubmitting(true);
    try {
      await createThreadPoll(threadId, {
        question: values.question.trim(),
        options: trimmed,
        deadline: values.deadline.toISOString(),
      });
      toast.success("Poll created");
      form.reset({ question: "", deadline: undefined });
      setOptions(["", ""]);
      setOpen(false);
      onCreated?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not create poll";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card
      className={`border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] ${className ?? ""}`}
    >
      <CardHeader className="py-3 px-4 border-b border-[var(--sd-border-subtle)]">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 text-left font-display text-sm font-bold uppercase tracking-tight text-foreground"
        >
          <span>Create a poll</span>
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </CardHeader>
      {open && (
        <CardContent className="pt-4 pb-4 px-4">
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="poll-question">Question</Label>
              <Input
                id="poll-question"
                placeholder="Who will be player of the match?"
                className="input-focus bg-[var(--sd-surface-raised)] border-[var(--sd-border-subtle)]"
                {...form.register("question")}
              />
              {form.formState.errors.question && (
                <p className="text-xs text-[var(--sd-danger)]">
                  {form.formState.errors.question.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="poll-deadline">Deadline</Label>
              <Controller
                name="deadline"
                control={form.control}
                render={({ field }) => (
                  <DateTimePicker
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="When should voting close?"
                    minDate={new Date()}
                  />
                )}
              />
              {form.formState.errors.deadline && (
                <p className="text-xs text-[var(--sd-danger)]">
                  {form.formState.errors.deadline.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Options</Label>
              <div className="space-y-2">
                {options.map((value, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder={`Option ${index + 1}`}
                      className="input-focus flex-1 bg-[var(--sd-surface-raised)] border-[var(--sd-border-subtle)]"
                      value={value}
                      onChange={(e) => setOption(index, e.target.value)}
                    />
                    {options.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-[var(--sd-danger)]"
                        onClick={() => removeOption(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-[var(--sd-border-subtle)]"
                onClick={addOption}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add option
              </Button>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-[var(--sd-accent)] text-[var(--sd-bg)] hover:bg-[var(--sd-accent)]/90 font-display font-semibold uppercase tracking-wide text-xs"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Post poll"
              )}
            </Button>
          </form>
        </CardContent>
      )}
    </Card>
  );
}
