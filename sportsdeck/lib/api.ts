// Prompt: Typed fetch wrapper and auth helpers for SportsDeck. apiFetch sends
// JSON requests with JWT from localStorage. Exports login, signup, logout, getMe
// mapped to actual API routes found in the Phase 1 audit.
// Claude claude-4.6-opus-high-thinking

import type {
  ApiError,
  AuthResponse,
  CreateThreadPollResponse,
  PollGetResponse,
  PollVoteResponse,
  User,
  UserProfile,
  FeedResponse,
} from "@/types";

const TOKEN_KEY = "sportsdeck_token";
const USER_KEY = "sportsdeck_user";

class ApiRequestError extends Error {
  status: number;

  constructor({ status, message }: ApiError) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

export { ApiRequestError };

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeAuth(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      message = body.error || body.message || message;
    } catch {
      // keep default message
    }
    throw new ApiRequestError({ status: res.status, message });
  }

  return res.json() as Promise<T>;
}

export async function login(
  email: string,
  password: string
): Promise<User> {
  const res = await apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  const user = res.data.user as User;
  storeAuth(res.data.token, user);
  return user;
}

export async function signup(
  username: string,
  email: string,
  password: string
): Promise<User> {
  const res = await apiFetch<AuthResponse>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });

  const user = res.data.user as User;
  storeAuth(res.data.token, user);
  return user;
}

export async function logout(): Promise<void> {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch {
    // clear local state even if server call fails
  }
  clearAuth();
}

export async function getMe(): Promise<User | null> {
  const stored = getStoredUser();
  if (!stored?.id) return null;

  try {
    const res = await apiFetch<{ user: User }>(
      `/api/users/${stored.id}`
    );
    const user = res.user;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  } catch {
    clearAuth();
    return null;
  }
}

export async function getPoll(pollId: number): Promise<PollGetResponse> {
  return apiFetch<PollGetResponse>(`/api/polls/${pollId}`);
}

export async function votePoll(
  pollId: number,
  optionId: number
): Promise<PollVoteResponse> {
  return apiFetch<PollVoteResponse>(`/api/polls/${pollId}/vote`, {
    method: "POST",
    body: JSON.stringify({ optionId }),
  });
}

export async function createThreadPoll(
  threadId: number,
  body: {
    question: string;
    options: string[];
    deadline: string;
    content?: string;
  }
): Promise<CreateThreadPollResponse> {
  return apiFetch<CreateThreadPollResponse>(
    `/api/threads/${threadId}/polls`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
}

// ---------------------------------------------------------------------------
// Follow / Activity
// ---------------------------------------------------------------------------

export async function getUser(userId: number): Promise<UserProfile> {
  return apiFetch<{ user: UserProfile }>(`/api/users/${userId}`).then(
    (res) => res.user
  );
}

export async function followUser(userId: number): Promise<void> {
  await apiFetch(`/api/users/${userId}/follow`, { method: "POST" });
}

export async function unfollowUser(userId: number): Promise<void> {
  await apiFetch(`/api/users/${userId}/follow`, { method: "DELETE" });
}

export async function getFeed(
  userId: number,
  params?: { page?: number; limit?: number; unreadOnly?: boolean }
): Promise<FeedResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", params.page.toString());
  if (params?.limit) query.set("limit", params.limit.toString());
  if (params?.unreadOnly) query.set("unreadOnly", "true");

  const url = `/api/users/${userId}/feed${query.toString() ? `?${query}` : ""}`;
  return apiFetch<FeedResponse>(url);
}
