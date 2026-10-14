"use client";

import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api-client";

export function useSetupStatus() {
  return useQuery({
    queryKey: ["setup"],
    queryFn: () => unwrap(api.setup.$get()),
    staleTime: 0,
  });
}
