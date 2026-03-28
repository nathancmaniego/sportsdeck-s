// Prompt: Full Navbar for SportsDeck — sticky, backdrop-blur, gradient bottom border,
// "SPORTSDECK" wordmark in font-display, nav links (Matches, Standings, Forums) with
// active route accent indicator, dark/light toggle, auth dropdown with avatar, mobile
// Sheet hamburger. All internal links use next/link. Uses render prop (base-ui v4).
// Claude claude-4.6-opus-high-thinking

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import useSWR from "swr";
import {
  Sun,
  Moon,
  Menu,
  LogOut,
  User as UserIcon,
  Rss,
  Settings,
  Shield,
  Bell,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getFeed } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/matches", label: "Matches" },
  { href: "/standings", label: "Standings" },
  { href: "/forums", label: "Forums" },
] as const;

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  // Fetch unread count for activity feed badge
  const { data: feedData } = useSWR(
    user ? `feed-unread-${user.id}` : null,
    () => getFeed(user!.id, { page: 1, limit: 1 }),
    { refreshInterval: 30000 } // refresh every 30s
  );

  const unreadCount = feedData?.unreadCount ?? 0;

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-[var(--sd-bg)]/80 gradient-border-bottom">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Wordmark + Nav */}
        <div className="flex items-center gap-8">
          <Link href="/" className="font-display text-2xl font-bold tracking-tight uppercase text-foreground">
            SportsDeck
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "nav-link text-sm font-medium transition-colors",
                  isActive(link.href)
                    ? "nav-link--active"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right: Activity + Theme toggle + Auth */}
        <div className="flex items-center gap-3">
          {/* Activity Feed (only when logged in) */}
          {user && (
            <Link href="/activity" className="relative">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "text-muted-foreground hover:text-foreground",
                  isActive("/activity") && "text-[var(--sd-accent)]"
                )}
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-[var(--sd-danger)] text-white text-xs font-bold flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
                <span className="sr-only">Activity feed</span>
              </Button>
            </Link>
          )}

          {/* Dark/Light toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="text-muted-foreground hover:text-foreground"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* Desktop Auth */}
          <div className="hidden md:flex items-center">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" className="relative h-9 w-9 rounded-full" />
                  }
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user.avatar ?? undefined} alt={user.username} />
                    <AvatarFallback className="bg-[var(--sd-accent-muted)] text-[var(--sd-accent)] font-display font-bold text-sm">
                      {user.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-[var(--sd-surface-raised)] border-[var(--sd-border-subtle)]">
                  <DropdownMenuItem render={<Link href={`/users/${user.id}`} />} className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4" />
                    My Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link href="/activity" />} className="flex items-center gap-2 relative">
                    <Bell className="h-4 w-4" />
                    Activity
                    {unreadCount > 0 && (
                      <span className="ml-auto px-2 py-0.5 rounded-full bg-[var(--sd-danger)] text-white text-xs font-bold">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link href="/profile" />} className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  {user.role === "admin" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem render={<Link href="/admin" />} className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Moderation
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-[var(--sd-danger)]"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                render={<Link href="/login" />}
                nativeButton={false}
                variant="default"
                size="sm"
                className="bg-[var(--sd-accent)] text-[var(--sd-bg)] hover:bg-[var(--sd-accent)]/90 font-display font-semibold uppercase tracking-wide text-xs"
              >
                Sign in
              </Button>
            )}
          </div>

          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" className="md:hidden text-muted-foreground" />
              }
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </SheetTrigger>
            <SheetContent side="right" className="bg-[var(--sd-surface)] border-[var(--sd-border-subtle)] w-72">
              <SheetHeader>
                <SheetTitle className="font-display text-xl font-bold tracking-tight uppercase">
                  SportsDeck
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-8 flex flex-col gap-4">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      isActive(link.href)
                        ? "accent-border-left bg-[var(--sd-accent-muted)] text-[var(--sd-accent)]"
                        : "text-muted-foreground hover:text-foreground hover:bg-[var(--sd-surface-raised)]"
                    )}
                  >
                    {link.label}
                  </Link>
                ))}

                <div className="my-2 h-px bg-[var(--sd-border-subtle)]" />

                {user ? (
                  <>
                    <Link
                      href={`/users/${user.id}`}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <UserIcon className="h-4 w-4" />
                      My Profile
                    </Link>
                    <Link
                      href="/activity"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <Bell className="h-4 w-4" />
                      Activity
                      {unreadCount > 0 && (
                        <span className="ml-auto px-2 py-0.5 rounded-full bg-[var(--sd-danger)] text-white text-xs font-bold">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </Link>
                    {user.role === "admin" && (
                      <Link
                        href="/admin"
                        className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                      >
                        <Shield className="h-4 w-4" />
                        Moderation
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--sd-danger)] hover:bg-[var(--sd-danger-muted)] rounded-md transition-colors text-left"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    className="mx-3 mt-2 flex items-center justify-center rounded-md bg-[var(--sd-accent)] px-4 py-2 text-sm font-display font-semibold uppercase tracking-wide text-[var(--sd-bg)]"
                  >
                    Sign in
                  </Link>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
