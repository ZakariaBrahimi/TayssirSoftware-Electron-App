"use client";

import { useSession } from "@/lib/auth-client";

export function useCurrentUser() {
  const { data, isPending, error } = useSession();
  const user = data?.user;
  return {
    user,
    isPending,
    error,
    isAdmin: user?.role === "admin",
  };
}
