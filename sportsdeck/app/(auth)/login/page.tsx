// Prompt: Login page — react-hook-form + zod validation (email, password min 6).
// Calls useAuth().login(), redirects to /activity on success. Inline field errors,
// loading spinner, error toast via sonner. Split layout: left panel with bold
// typographic treatment, right panel with form using surface tokens.
// Claude claude-4.6-opus-high-thinking

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    try {
      await login(data.email, data.password);
      toast.success("Welcome back!");
      router.push("/activity");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Login failed. Try again.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Left panel — typographic hero */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center bg-[var(--sd-surface)] px-16 relative overflow-hidden">
        <div className="relative z-10">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-[var(--sd-accent)] mb-4">
            Premier League Fan Hub
          </p>
          <h1 className="font-display text-6xl font-extrabold uppercase leading-none tracking-tight text-foreground xl:text-7xl">
            Every
            <br />
            Matchday
            <br />
            <span className="text-[var(--sd-accent)]">Matters.</span>
          </h1>
          <p className="mt-6 max-w-md text-muted-foreground font-body text-lg leading-relaxed">
            Live scores, heated debates, and a community that lives and breathes
            football. Join the conversation.
          </p>
        </div>
        {/* Decorative accent line */}
        <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-transparent via-[var(--sd-accent)] to-transparent" />
      </div>

      {/* Right panel — login form */}
      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile-only heading */}
          <div className="lg:hidden text-center">
            <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
              SportsDeck
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Premier League Fan Hub
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold uppercase tracking-tight">
              Sign in
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Welcome back. Enter your credentials to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-body text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                className="input-focus bg-[var(--sd-surface)] border-[var(--sd-border-subtle)]"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-[var(--sd-danger)]">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="font-body text-sm font-medium">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                className="input-focus bg-[var(--sd-surface)] border-[var(--sd-border-subtle)]"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-[var(--sd-danger)]">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[var(--sd-accent)] text-[var(--sd-bg)] hover:bg-[var(--sd-accent)]/90 font-display font-semibold uppercase tracking-wide"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-medium text-[var(--sd-accent)] hover:underline"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
