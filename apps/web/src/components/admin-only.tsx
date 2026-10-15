"use client";

import { useEffect } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useRouter } from "@/i18n/navigation";

/** Client-side guard for admin pages (the API enforces it as well). */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { isAdmin, user } = useCurrentUser();
  const router = useRouter();
  useEffect(() => {
    if (user && !isAdmin) router.replace("/pos");
  }, [user, isAdmin, router]);
  return isAdmin ? children : null;
}
