// Prompt: Signup page — react-hook-form + zod validation: username (min 3),
// email (valid), password (min 6), confirmPassword (must match). Calls signup,
// redirects to /activity. Same split layout treatment as login.
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

const signupSchema = z
  .object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    email: z.string().email("Enter a valid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignupFormData = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupFormData) => {
    setIsSubmitting(true);
    try {
      await signup(data.username, data.email, data.password);
      toast.success("Account created! Welcome to SportsDeck.");
      router.push("/activity");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Signup failed. Try again.";
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
            Join the Community
          </p>
          <h1 className="font-display text-6xl font-extrabold uppercase leading-none tracking-tight text-foreground xl:text-7xl">
            Your
            <br />
            Pitch.
            <br />
            <span className="text-[var(--sd-accent)]">Your Voice.</span>
          </h1>
          <p className="mt-6 max-w-md text-muted-foreground font-body text-lg leading-relaxed">
            Discuss every goal, every save, every VAR call. Create an account
            and become part of the matchday conversation.
          </p>
        </div>
        <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-transparent via-[var(--sd-accent)] to-transparent" />
      </div>

      {/* Right panel — signup form */}
      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-md space-y-8">
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
              Create account
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Set up your profile and start engaging.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="font-body text-sm font-medium">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="your_username"
                autoComplete="username"
                className="input-focus bg-[var(--sd-surface)] border-[var(--sd-border-subtle)]"
                {...register("username")}
              />
              {errors.username && (
                <p className="text-xs text-[var(--sd-danger)]">
                  {errors.username.message}
                </p>
              )}
            </div>

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
                autoComplete="new-password"
                className="input-focus bg-[var(--sd-surface)] border-[var(--sd-border-subtle)]"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-[var(--sd-danger)]">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="confirmPassword"
                className="font-body text-sm font-medium"
              >
                Confirm Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                className="input-focus bg-[var(--sd-surface)] border-[var(--sd-border-subtle)]"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-[var(--sd-danger)]">
                  {errors.confirmPassword.message}
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
                "Create account"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-[var(--sd-accent)] hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
