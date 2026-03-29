"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy route — feed lives at /activity */
export default function FeedRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/activity");
  }, [router]);
  return null;
}
