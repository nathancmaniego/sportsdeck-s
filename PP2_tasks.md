# SportsDeck Part 2 — Dev Split & Frontend Architecture

**Deadline:** Sunday, March 29 @ 22:00  
**Team:** Nate + Partner

---

## Developer Split

### 🔵 Nate

#### Infrastructure
- [x] Migrate Prisma schema to PostgreSQL, redo migrations
- [x] Write `Dockerfile` for Next.js (production build)
- [x] Write `docker-compose.yaml` (Next.js + Postgres + Nginx)
- [ ] Add Redis standalone cache server to Docker Compose *(+bonus)*
- [x] Generate seed data + write `import-data.sh`
- [x] Migrate frontend codebase fully to TypeScript *(+bonus)*
- [x] Write `start.sh` and `stop.sh` scripts

#### Frontend — Matches & League
- [x] Matches page — upcoming & recent, team logos, scores
- [x] League standings/table page
- [x] Matchday browser — view matches by matchday/stage
- [x] Match detail page + auto-created discussion thread link

#### Frontend — Your Backend Features
- [x] Polls UI — create, vote, view results, deadline display
- [x] Follow / unfollow button + following/followers lists
- [x] Public user profile page + activity chart
- [x] Activity feed — grouped events, followed users + team updates
- [x] Match thread sentiment indicator (overall + per-team)
- [x] Daily digest display on home/dashboard
- [x] OAuth (Google) sign-in button + flow

#### Deployment
- [ ] Deploy to cloud VM, verify public access, write `url.txt`
- [ ] HTTPS via Nginx + Let's Encrypt *(+bonus)*
- 

---

### 🟢 Partner

#### Frontend — Auth & Profile
- [x] Landing page — hero section, sports vibe, league imagery
- [x] Navbar — all sections, user dropdown (profile, logout)
- [x] Sign up / login pages with frontend validation
- [x] Edit profile page — username, avatar, favorite team

#### Frontend — Forums & Threads
- [x] Forum/threads list — general + team-specific
- [x] Thread search — by title, author, team, tag
- [x] Thread detail page — posts, replies, edit history accessible
- [x] Create thread form — title, body, tags (create new inline)
- [x] Reply form — inline, auth-gated
- [x] Edit / delete own posts, replies, threads
- [x] Translate post/comment button — inline result


#### Frontend — Moderation
- [x] Report post/thread form with reason field
- [x] Admin moderation queue — sorted by AI verdict + report count
- [x] Admin review panel — AI verdict display, dismiss/approve/hide
- [x] Admin ban/unban user UI
- [x] User appeal form — submit unban request

---

### ⚡ Shared — Coordinate on Day 1

These must be agreed on before either person builds their pages. One person implements, both consume.

- [x] **Auth context** — JWT storage (httpOnly cookie recommended), `useAuth()` hook that exposes `user`, `login()`, `logout()`, and an `isLoading` state. Every page reads from this, never from raw localStorage.
- [x] **Dark/light mode toggle** — implement via `next-themes` or a Tailwind `dark:` class strategy on `<html>`. Set it up once in the root layout.
- [x] **Shared UI component library** — agree on and build: `Button`, `Card`, `Modal`, `Avatar`, `Badge`, `Spinner`, `Toast/Snackbar`. Both use these; no diverging styles.
- [x] **Global error + loading patterns** — agree on how async states look across the app (skeleton loaders vs spinners, toast vs inline error). Consistent behaviour is part of the UX grade.

---

## Frontend Architecture

SportsDeck must be a **Single Page Application (SPA)** — the browser never does a full page reload during navigation. Here is how that works in Next.js App Router.

### How SPA Navigation Works in Next.js

Next.js App Router uses **client-side navigation by default**. When a user clicks a `<Link>`, Next.js fetches only the new page's data and swaps the content in-place — the browser URL updates, the navbar stays mounted, and no full reload happens. This satisfies the handout's requirement for URL-based navigation with browser back/forward support.

The key rule: **never use `<a href="...">` for internal links**. Always use Next.js `<Link href="...">`. A plain anchor tag causes a full reload and breaks the SPA experience.

---

### Directory Structure

```
src/
├── app/                          # Next.js App Router — one folder = one route
│   ├── layout.tsx                # Root layout — navbar, auth provider, theme provider
│   ├── page.tsx                  # Landing page (/)
│   ├── (auth)/                   # Route group — no layout segment in URL
│   │   ├── login/page.tsx        # /login
│   │   └── signup/page.tsx       # /signup
│   ├── matches/
│   │   ├── page.tsx              # /matches — list of upcoming/recent
│   │   └── [matchId]/page.tsx    # /matches/123 — match detail
│   ├── standings/page.tsx        # /standings
│   ├── forums/
│   │   ├── page.tsx              # /forums — all forums
│   │   └── [teamId]/
│   │       ├── page.tsx          # /forums/arsenal — team forum thread list
│   │       └── [threadId]/
│   │           └── page.tsx      # /forums/arsenal/456 — thread detail
│   ├── threads/
│   │   └── new/page.tsx          # /threads/new — create thread
│   ├── profile/
│   │   ├── page.tsx              # /profile — own profile / edit
│   │   └── [username]/page.tsx   # /profile/nate — public profile
│   ├── feed/page.tsx             # /feed — personal activity feed
│   ├── admin/
│   │   ├── page.tsx              # /admin — moderation queue
│   │   └── [reportId]/page.tsx   # /admin/789 — review specific report
│   └── api/                      # All your existing backend routes live here
│       └── ...
│
├── components/
│   ├── ui/                       # Shared primitives (Button, Card, Modal, etc.)
│   ├── layout/
│   │   ├── Navbar.tsx            # Persistent top nav — always mounted
│   │   └── Sidebar.tsx           # Optional sidebar for forums
│   ├── matches/                  # Match-specific components
│   ├── forums/                   # Thread/post/reply components
│   ├── polls/                    # Poll create/vote/results
│   ├── feed/                     # Feed event cards
│   └── admin/                    # Moderation UI components
│
├── context/
│   └── AuthContext.tsx           # Global auth state — useAuth() hook
│
├── hooks/
│   ├── useAuth.ts                # Reads from AuthContext
│   ├── useFetch.ts               # Generic data fetching with loading/error state
│   └── useDebounce.ts            # For search inputs
│
├── lib/
│   ├── api.ts                    # Typed fetch wrapper — all API calls go through here
│   └── utils.ts                  # Date formatting, truncation, etc.
│
└── types/
    └── index.ts                  # Shared TypeScript types (User, Post, Thread, etc.)
```

---

### Root Layout — The SPA Shell

`app/layout.tsx` is the persistent shell that wraps every page. The navbar mounts here once and **never unmounts** during navigation. This is what makes it feel like a real SPA.

```tsx
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>          {/* dark/light mode */}
          <AuthProvider>         {/* JWT auth context */}
            <Navbar />           {/* always mounted, never reloads */}
            <main>{children}</main>
            <Toaster />          {/* global toast notifications */}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

---

### Auth Context

Every component that needs to know if the user is logged in reads from `useAuth()`. Never fetch `/api/me` individually in each component.

```tsx
// context/AuthContext.tsx
const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // On mount, verify the JWT cookie and hydrate user state
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => { setUser(data?.user ?? null); setIsLoading(false); });
  }, []);

  const login = async (email: string, password: string) => { /* ... */ };
  const logout = async () => { await fetch('/api/auth/logout', { method: 'POST' }); setUser(null); };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext)!;
```

---

### Data Fetching Pattern

For client-side data fetching, use a consistent pattern. Every async action should handle loading and error states — this is explicitly graded.

```tsx
// Example: Thread detail page
'use client';

export default function ThreadPage({ params }: { params: { threadId: string } }) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/threads/${params.threadId}`)
      .then(r => r.ok ? r.json() : Promise.reject('Failed to load'))
      .then(setThread)
      .catch(err => setError(err))
      .finally(() => setIsLoading(false));
  }, [params.threadId]);

  if (isLoading) return <ThreadSkeleton />;
  if (error)    return <ErrorCard message={error} />;
  if (!thread)  return <ErrorCard message="Thread not found" />;

  return <ThreadView thread={thread} />;
}
```

Alternatively, use a library like **SWR** (`npm install swr`) which handles caching, revalidation, and loading/error states automatically — strongly recommended to save time.

---

### Protected Routes

Use a `<ProtectedRoute>` wrapper for any page that requires login. Redirect to `/login` if the user is not authenticated.

```tsx
// components/ProtectedRoute.tsx
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading]);

  if (isLoading) return <PageSpinner />;
  if (!user) return null;
  return <>{children}</>;
}
```

Admin pages additionally check `user.role === 'ADMIN'` and redirect otherwise.

---

### Navigation

The navbar must always reflect the current auth state and highlight the active route.

```tsx
// components/layout/Navbar.tsx
'use client';

export function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  return (
    <nav>
      <Link href="/">SportsDeck</Link>
      <Link href="/matches"    className={pathname === '/matches'    ? 'active' : ''}>Matches</Link>
      <Link href="/standings"  className={pathname === '/standings'  ? 'active' : ''}>Standings</Link>
      <Link href="/forums"     className={pathname === '/forums'     ? 'active' : ''}>Forums</Link>
      {user ? (
        <UserDropdown user={user} onLogout={logout} />
      ) : (
        <Link href="/login">Sign in</Link>
      )}
    </nav>
  );
}
```

---

### Recommended Libraries

| Purpose | Library |
|---|---|
| Data fetching + caching | `swr` |
| Dark/light mode | `next-themes` |
| Toast notifications | `react-hot-toast` or `sonner` |
| Forms + validation | `react-hook-form` + `zod` |
| Date formatting | `date-fns` |
| Charts (activity graph) | `recharts` |
| Icons | `lucide-react` |

---

### Key Rules — Avoid These Mistakes

1. **Never use `<a href>` for internal links** — always `<Link href>` from `next/link`.
2. **Never call `/api/auth/me` in multiple components** — read from `useAuth()` context instead.
3. **Never hardcode colours** — use Tailwind classes so dark mode works automatically.
4. **Never block render on a slow API** — always show a skeleton/spinner while fetching.
5. **Never redirect with `window.location.href`** — use `useRouter().push()` to keep the SPA intact.
6. **Keep API logic out of components** — put all `fetch()` calls in `lib/api.ts` so both developers use the same typed functions.