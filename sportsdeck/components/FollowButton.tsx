"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, UserMinus, Loader2 } from "lucide-react";
import { followUser, unfollowUser } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

interface FollowButtonProps {
  userId: number;
  initialIsFollowing?: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
  className?: string;
}

export default function FollowButton({
  userId,
  initialIsFollowing = false,
  onFollowChange,
  className,
}: FollowButtonProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [loading, setLoading] = useState(false);

  if (!user) {
    return (
      <Button
        variant="outline"
        size="sm"
        className={className}
        onClick={() => router.push("/login")}
      >
        <UserPlus className="h-4 w-4 mr-1" />
        Follow
      </Button>
    );
  }

  if (user.id === userId) {
    return null;
  }

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (isFollowing) {
        await unfollowUser(userId);
        setIsFollowing(false);
        toast.success("Unfollowed");
        onFollowChange?.(false);
      } else {
        await followUser(userId);
        setIsFollowing(true);
        toast.success("Following");
        onFollowChange?.(true);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to update";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={isFollowing ? "outline" : "default"}
      size="sm"
      className={className}
      onClick={handleToggle}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isFollowing ? (
        <>
          <UserMinus className="h-4 w-4 mr-1" />
          Unfollow
        </>
      ) : (
        <>
          <UserPlus className="h-4 w-4 mr-1" />
          Follow
        </>
      )}
    </Button>
  );
}
