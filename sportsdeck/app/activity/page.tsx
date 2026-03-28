"use client";

import { useState } from "react";
import useSWR from "swr";
import { getFeed } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import ActivityFeed from "@/components/ActivityFeed";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, BellOff, ChevronLeft, ChevronRight } from "lucide-react";

export default function ActivityPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data, error, isLoading } = useSWR(
    user ? `feed-${user.id}-${page}-${unreadOnly}` : null,
    () => getFeed(user!.id, { page, limit: 20, unreadOnly })
  );

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="border-[var(--sd-border-subtle)] bg-[var(--sd-surface)]">
          <CardContent className="py-12 text-center">
            <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="font-body text-muted-foreground mb-4">
              Sign in to see your activity feed
            </p>
            <a href="/login">
              <Button className="bg-[var(--sd-accent)] text-[var(--sd-bg)] hover:bg-[var(--sd-accent)]/90 font-display font-semibold uppercase tracking-wide text-xs">
                Sign in
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-4xl font-bold text-foreground mb-2">
          Activity Feed
        </h1>
        <p className="font-body text-muted-foreground">
          Updates from people and teams you follow
        </p>
      </div>

      {/* Filter Tabs */}
      <Tabs
        value={unreadOnly ? "unread" : "all"}
        onValueChange={(v) => {
          setUnreadOnly(v === "unread");
          setPage(1);
        }}
        className="mb-6"
      >
        <TabsList className="w-full sm:w-auto border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)]">
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-[var(--sd-accent)] data-[state=active]:text-[var(--sd-bg)] font-display font-semibold uppercase tracking-wide text-xs"
          >
            <Bell className="h-4 w-4 mr-1" />
            All Activity
          </TabsTrigger>
          <TabsTrigger
            value="unread"
            className="data-[state=active]:bg-[var(--sd-accent)] data-[state=active]:text-[var(--sd-bg)] font-display font-semibold uppercase tracking-wide text-xs"
          >
            <BellOff className="h-4 w-4 mr-1" />
            Unread
            {data?.unreadCount ? (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-[var(--sd-danger)] text-white text-xs font-bold">
                {data.unreadCount}
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Feed Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card
              key={i}
              className="border-[var(--sd-border-subtle)] bg-[var(--sd-surface)]"
            >
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="border-[var(--sd-border-subtle)] bg-[var(--sd-surface)]">
          <CardContent className="py-12 text-center">
            <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="font-body text-muted-foreground">
              {error.message || "Failed to load activity"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <ActivityFeed events={data?.feed || []} />

          {/* Pagination */}
          {data && data.pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="border-[var(--sd-border-subtle)]"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>

              <span className="font-body text-sm text-muted-foreground">
                Page {page} of {data.pagination.pages}
              </span>

              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.pagination.pages}
                onClick={() => setPage((p) => p + 1)}
                className="border-[var(--sd-border-subtle)]"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
