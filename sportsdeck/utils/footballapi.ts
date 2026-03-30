const BASE_URL = "https://api.football-data.org/v4";

function getHeaders(): HeadersInit {
  const token = process.env.FOOTBALL_DATA_API_KEY;
  if (!token) {
    throw new Error("FOOTBALL_DATA_API_KEY is not set");
  }
  return { "X-Auth-Token": token };
}

async function apiFetch<T>(path: string): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, { headers: getHeaders() });

  if (!res.ok) {
    throw new Error(`football-data.org error: ${res.status} on ${path}`);
  }

  return res.json() as Promise<T>;
}

export interface ApiSeason {
  id: number;
  startDate: string;
  endDate: string;
  currentMatchday: number | null;
  winner: { name: string } | null;
}

export interface CompetitionResponse {
  currentSeason: ApiSeason;
}

export async function fetchCompetition(): Promise<CompetitionResponse> {
  return apiFetch<CompetitionResponse>("/competitions/PL");
}

export interface ApiTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
  venue?: string | null;
  founded?: number | null;
  clubColors?: string | null;
  website?: string | null;
}

export async function fetchTeams(): Promise<ApiTeam[]> {
  const data = await apiFetch<{ teams: ApiTeam[] }>("/competitions/PL/teams");
  return data.teams;
}

export interface ApiMatchTeam {
  id: number;
  name: string;
  tla: string;
  crest: string;
}

export interface ApiMatchScore {
  fullTime: { home: number | null; away: number | null };
  halfTime: { home: number | null; away: number | null };
}

export interface ApiMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number | null;
  stage: string;
  homeTeam: ApiMatchTeam;
  awayTeam: ApiMatchTeam;
  score: ApiMatchScore;
  lastUpdated: string;
}

export async function fetchAllMatches(): Promise<ApiMatch[]> {
  const data = await apiFetch<{ matches: ApiMatch[] }>("/competitions/PL/matches");
  return data.matches;
}

export async function fetchMatchesByMatchday(matchday: number): Promise<ApiMatch[]> {
  const data = await apiFetch<{ matches: ApiMatch[] }>(
    `/competitions/PL/matches?matchday=${matchday}`
  );
  return data.matches;
}

export interface StandingTableRow {
  position: number;
  team: { id: number; name: string; crest: string };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export interface StandingsResponse {
  standings: Array<{ type: string; table: StandingTableRow[] }>;
}

export async function fetchStandings(): Promise<StandingTableRow[]> {
  const data = await apiFetch<StandingsResponse>("/competitions/PL/standings");
  const total = data.standings.find((s) => s.type === "TOTAL");
  if (!total) throw new Error("No TOTAL standings in API response");
  return total.table;
}
