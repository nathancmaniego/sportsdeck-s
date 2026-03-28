// Prompt: Define TypeScript types for all entities based on the Prisma schema in schema.prisma.
// Fields match the Prisma model definitions exactly. Includes User, Post, Thread, Poll,
// PollOption, Match, Team, Standing, Report, FeedEvent, Vote, Appeal, Tag, ThreadTag,
// Season, DailyDigest, ThreadSentiment, Translation, PostEdit, Follow, OAuthAccount,
// RefreshToken, ApiCache, and ApiError.
// Claude claude-4.6-opus-high-thinking

export type UserRole = "user" | "admin";

export type MatchStatus =
  | "SCHEDULED"
  | "TIMED"
  | "IN_PLAY"
  | "PAUSED"
  | "FINISHED"
  | "POSTPONED"
  | "SUSPENDED"
  | "CANCELLED";

export type ReportStatus = "pending" | "dismissed" | "approved";

export type AppealStatus = "pending" | "approved" | "rejected";

export type SentimentMood = "positive" | "negative" | "mixed" | "neutral";

export type FeedEventType =
  | "new_post"
  | "new_reply"
  | "new_match"
  | "new_thread"
  | "match_score"
  | "match_status";

export interface User {
  id: number;
  email: string;
  password?: string;
  username: string;
  avatar?: string | null;
  role: UserRole;
  isBanned: boolean;
  favoriteTeamId?: number | null;
  createdAt: string;
  updatedAt: string;
  favoriteTeam?: Team | null;
  isFollowedByMe?: boolean;
}

export interface Team {
  id: number;
  externalId: number;
  name: string;
  shortName: string;
  tla: string;
  crestUrl?: string | null;
  venue?: string | null;
  founded?: number | null;
  clubColors?: string | null;
  website?: string | null;
  createdAt: string;
}

export interface Season {
  id: number;
  externalId: number;
  startDate: string;
  endDate: string;
  currentMatchday?: number | null;
  winner?: string | null;
  createdAt: string;
}

export interface Match {
  id: number;
  externalId: number;
  seasonId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeScore?: number | null;
  awayScore?: number | null;
  halfTimeHome?: number | null;
  halfTimeAway?: number | null;
  utcDate: string;
  status: MatchStatus;
  matchday?: number | null;
  stage: string;
  seasonLabel?: string | null;
  createdAt: string;
  updatedAt: string;
  lastUpdated?: string | null;
  season?: Pick<Season, "id" | "currentMatchday">;
  homeTeam?: Team;
  awayTeam?: Team;
  thread?: Thread | null;
}

export interface Thread {
  id: number;
  title: string;
  authorId: number;
  teamId?: number | null;
  matchId?: number | null;
  isMatchThread: boolean;
  isAutoCreated: boolean;
  isHidden: boolean;
  openAt: string;
  closeAt?: string | null;
  createdAt: string;
  updatedAt: string;
  author?: User;
  team?: Team | null;
  match?: Match | null;
  posts?: Post[];
  tags?: ThreadTag[];
  sentiment?: ThreadSentiment | null;
}

export interface Post {
  id: number;
  threadId: number;
  authorId: number;
  parentId?: number | null;
  content: string;
  isHidden: boolean;
  isFlagged: boolean;
  flagReason?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  author?: User;
  thread?: Thread;
  parent?: Post | null;
  replies?: Post[];
  editHistory?: PostEdit[];
  poll?: Poll | null;
  translations?: Translation[];
}

export type Reply = Post & { parentId: number };

export interface PostEdit {
  id: number;
  postId: number;
  content: string;
  editedAt: string;
}

export interface Translation {
  id: number;
  postId: number;
  language: string;
  content: string;
  createdAt: string;
}

export interface Tag {
  id: number;
  name: string;
}

export interface ThreadTag {
  threadId: number;
  tagId: number;
  tag?: Tag;
}

export interface Poll {
  id: number;
  postId: number;
  question: string;
  deadline: string;
  createdAt: string;
  options?: PollOption[];
  votes?: Vote[];
}

export interface PollOption {
  id: number;
  pollId: number;
  text: string;
  votes?: Vote[];
}

export interface Vote {
  id: number;
  userId: number;
  pollId: number;
  pollOptionId: number;
  createdAt: string;
}

export interface Report {
  id: number;
  reporterId: number;
  reason: string;
  status: ReportStatus;
  postId?: number | null;
  threadId?: number | null;
  aiVerdict?: string | null;
  aiScore?: number | null;
  createdAt: string;
  updatedAt: string;
  reporter?: User;
  post?: Post | null;
  thread?: Thread | null;
}

export interface Appeal {
  id: number;
  userId: number;
  reason: string;
  status: AppealStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Follow {
  followerId: number;
  followingId: number;
  createdAt: string;
  follower?: User;
  following?: User;
}

export interface FeedEvent {
  id: number;
  userId: number;
  actorId: number;
  type: FeedEventType;
  threadId?: number | null;
  postId?: number | null;
  matchId?: number | null;
  groupKey?: string | null;
  isRead: boolean;
  createdAt: string;
  actor?: User;
  thread?: Thread | null;
  post?: Post | null;
  match?: Match | null;
}

export interface ThreadSentiment {
  id: number;
  threadId: number;
  overallMood: SentimentMood;
  homeTeamMood?: string | null;
  awayTeamMood?: string | null;
  calculatedAt: string;
}

export interface DailyDigest {
  id: number;
  content: string;
  date: string;
}

export interface OAuthAccount {
  id: number;
  provider: string;
  providerId: string;
  userId: number;
  createdAt: string;
}

export interface RefreshToken {
  id: string;
  token: string;
  userId: number;
  expiresAt: string;
  createdAt: string;
}

export interface ApiCache {
  id: number;
  key: string;
  data: string;
  cachedAt: string;
  expiresAt: string;
}

export interface Standing {
  position: number;
  team: {
    id: number;
    name: string;
    crest: string;
  };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export interface ApiError {
  status: number;
  message: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    token: string;
    user: Pick<User, "id" | "email" | "username" | "role">;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total?: number;
  hasMore?: boolean;
}
