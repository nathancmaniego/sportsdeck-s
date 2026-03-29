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
  FollowListResponse,
  TeamStub,
  UserSearchResponse,
  DailyDigest,
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

function broadcastAuthChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("sportsdeck:auth-changed"));
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
    // If the token is expired/invalid, sign out locally immediately.
    if (res.status === 401) {
      try {
        clearAuth();
        broadcastAuthChange();
      } catch {
        // ignore
      }
    }

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

/**
 * If the user has a favourite team but no avatar, persist the team crest as avatar.
 */
async function syncFavoriteTeamAvatarIfNeeded(user: User): Promise<User> {
  const crest = user.favoriteTeam?.crestUrl;
  const teamId = user.favoriteTeamId ?? user.favoriteTeam?.id ?? null;
  if (teamId == null || !crest) return user;
  const empty = !user.avatar || !String(user.avatar).trim();
  if (!empty) return user;
  try {
    await updateProfile(user.id, { avatar: crest });
    const res = await apiFetch<{ user: User }>(`/api/users/${user.id}`);
    return res.user;
  } catch {
    return user;
  }
}

export async function login(
  email: string,
  password: string
): Promise<User> {
  const res = await apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  storeAuth(res.data.token, res.data.user as User);
  const fresh = await getMe();
  if (!fresh) {
    throw new ApiRequestError({
      status: 401,
      message: "Could not load your profile. Try again.",
    });
  }
  return fresh;
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

  storeAuth(res.data.token, res.data.user as User);
  const fresh = await getMe();
  if (!fresh) {
    throw new ApiRequestError({
      status: 401,
      message: "Could not load your profile. Try again.",
    });
  }
  return fresh;
}

export async function logout(): Promise<void> {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch {
    // clear local state even if server call fails
  }
  clearAuth();
  broadcastAuthChange();
}

export async function getMe(): Promise<User | null> {
  const stored = getStoredUser();
  if (!stored?.id) return null;

  try {
    const res = await apiFetch<{ user: User }>(
      `/api/users/${stored.id}`
    );
    let user = res.user;
    user = await syncFavoriteTeamAvatarIfNeeded(user);
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

export async function getDailyDigest(): Promise<DailyDigest> {
  return apiFetch<DailyDigest>("/api/digest");
}

export async function searchUsers(params: {
  q?: string;
  page?: number;
  limit?: number;
}): Promise<UserSearchResponse> {
  const query = new URLSearchParams();
  const q = (params.q ?? "").trim();
  if (q) query.set("q", q);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query}` : "";
  return apiFetch<UserSearchResponse>(`/api/users${suffix}`);
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

export async function updateProfile(
  userId: number,
  data: { username?: string; avatar?: string | null; favoriteTeamId?: number | null }
): Promise<User> {
  return apiFetch<{ user: User }>(`/api/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  }).then((res) => res.user);
}

export async function getFollowers(
  userId: number,
  page = 1
): Promise<FollowListResponse> {
  return apiFetch<FollowListResponse>(
    `/api/users/${userId}/followers?page=${page}&limit=50`
  );
}

export async function getFollowing(
  userId: number,
  page = 1
): Promise<FollowListResponse> {
  return apiFetch<FollowListResponse>(
    `/api/users/${userId}/following?page=${page}&limit=50`
  );
}

export async function removeFollower(
  userId: number,
  followerId: number
): Promise<void> {
  await apiFetch(`/api/users/${userId}/followers/${followerId}`, {
    method: "DELETE",
  });
}

export async function getTeams(): Promise<TeamStub[]> {
  return apiFetch<{ teams: TeamStub[] }>("/api/teams").then((r) => r.teams);
}
