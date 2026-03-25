// Prompt: ProtectedRoute wrapper — shows accent spinner while loading,
// redirects to /login if unauthenticated, otherwise renders children.
// Claude claude-4.6-opus-high-thinking

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="spinner-accent" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
