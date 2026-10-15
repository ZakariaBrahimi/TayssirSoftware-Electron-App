"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api-client";

export type CatalogKind = "categories" | "brands";

export function useCatalogList(kind: CatalogKind) {
  return useQuery({
    queryKey: [kind],
    queryFn: () => unwrap(api[kind].$get()),
    staleTime: 60_000,
  });
}

export function useCatalogMutations(kind: CatalogKind) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [kind] });
    qc.invalidateQueries({ queryKey: ["products"] });
  };
  return {
    create: useMutation({
      mutationFn: (name: string) => unwrap(api[kind].$post({ json: { name } })),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, name }: { id: string; name: string }) =>
        unwrap(api[kind][":id"].$patch({ param: { id }, json: { name } })),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => unwrap(api[kind][":id"].$delete({ param: { id } })),
      onSuccess: invalidate,
    }),
  };
}
