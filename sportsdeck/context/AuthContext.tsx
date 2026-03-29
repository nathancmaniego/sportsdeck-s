// Prompt: AuthProvider wrapping children with user state, login, logout, signup.
// On mount reads JWT + user from localStorage and calls getMe() to refresh.
// Provides useAuth() hook that throws outside the provider.
// Claude claude-4.6-opus-high-thinking

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "@/types";
import * as api from "@/lib/api";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const stored = api.getStoredUser();
      if (!stored) {
        setIsLoading(false);
        return;
      }
      setUser(stored);

      try {
        const fresh = await api.getMe();
        if (!cancelled) {
          setUser(fresh);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep auth state in sync when apiFetch signs us out (e.g. expired token).
  useEffect(() => {
    const handler = () => {
      const stored = api.getStoredUser();
      setUser(stored);
    };
    window.addEventListener("sportsdeck:auth-changed", handler);
    return () => window.removeEventListener("sportsdeck:auth-changed", handler);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await api.login(email, password);
    setUser(u);
  }, []);

  const signup = useCallback(
    async (username: string, email: string, password: string) => {
      const u = await api.signup(username, email, password);
      setUser(u);
    },
    []
  );

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const fresh = await api.getMe();
    setUser(fresh);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, signup, logout, refreshUser }),
    [user, isLoading, login, signup, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
