"use client";

import { useEffect } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useRouter } from "@/i18n/navigation";

/** `/` → dashboard for administrators, point of sale for cashiers. */
export default function HomePage() {
  const { user, isAdmin } = useCurrentUser();
  const router = useRouter();
  useEffect(() => {
    if (user) router.replace(isAdmin ? "/dashboard" : "/pos");
  }, [user, isAdmin, router]);
  return null;
}
