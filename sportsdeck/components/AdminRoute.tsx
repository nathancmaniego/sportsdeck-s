// Prompt: AdminRoute wrapper — same as ProtectedRoute but also checks
// user.role === 'admin', redirects to / if not admin.
// Claude claude-4.6-opus-high-thinking

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function AdminRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.replace("/login");
      } else if (user.role !== "admin") {
        router.replace("/");
      }
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="spinner-accent" />
      </div>
    );
  }

  if (!user || user.role !== "admin") return null;

  return <>{children}</>;
}
