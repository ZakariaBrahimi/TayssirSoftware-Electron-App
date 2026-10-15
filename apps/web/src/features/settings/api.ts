"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { api, ApiError, unwrap } from "@/lib/api-client";
import type { SyncLinkInput, UserCreateInput, UserUpdateInput } from "@/lib/validators";

export type StoreUser = InferResponseType<typeof api.users.$get, 200>[number];
export type SyncStatus = InferResponseType<(typeof api)["sync-client"]["$get"], 200>;
export type BackupList = InferResponseType<typeof api.backup.$get, 200>;
export type ImportReport = InferResponseType<(typeof api.data.import.products)["$post"], 200>;

export function useUsers() {
  return useQuery({ queryKey: ["users"], queryFn: () => unwrap(api.users.$get()) });
}

export function useUserMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["users"] });
  return {
    create: useMutation({
      mutationFn: (json: UserCreateInput) => unwrap(api.users.$post({ json })),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, json }: { id: string; json: UserUpdateInput }) =>
        unwrap(api.users[":id"].$patch({ param: { id }, json })),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => unwrap(api.users[":id"].$delete({ param: { id } })),
      onSuccess: invalidate,
    }),
  };
}

export function useLicenseMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["me"] });
  return {
    activate: useMutation({
      mutationFn: (key: string) => unwrap(api.license.activate.$post({ json: { key } })),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: () => unwrap(api.license.$delete()),
      onSuccess: refresh,
    }),
  };
}

export function useBackups() {
  return useQuery({ queryKey: ["backups"], queryFn: () => unwrap(api.backup.$get()) });
}

export function useBackupMutations() {
  const qc = useQueryClient();
  return {
    create: useMutation({
      mutationFn: () => unwrap(api.backup.$post()),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["backups"] }),
    }),
    restoreNamed: useMutation({
      mutationFn: async (name: string) => {
        const res = await fetch("/api/backup/restore", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const body = (await res.json().catch(() => null)) as {
          error?: { code: string; message: string };
        } | null;
        if (!res.ok)
          throw new ApiError(
            res.status,
            body?.error?.code ?? "INTERNAL_ERROR",
            body?.error?.message ?? "",
          );
        return body;
      },
    }),
    restoreFile: useMutation({
      mutationFn: async (file: File) => {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/backup/restore", { method: "POST", body: form });
        const body = (await res.json().catch(() => null)) as {
          error?: { code: string; message: string };
        } | null;
        if (!res.ok)
          throw new ApiError(
            res.status,
            body?.error?.code ?? "INTERNAL_ERROR",
            body?.error?.message ?? "",
          );
        return body;
      },
    }),
  };
}

export async function importProductsCsv(text: string, dryRun: boolean): Promise<ImportReport> {
  const res = await fetch(`/api/data/import/products?dryRun=${dryRun}`, {
    method: "POST",
    headers: { "content-type": "text/csv" },
    body: text,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok)
    throw new ApiError(
      res.status,
      body?.error?.code ?? "INTERNAL_ERROR",
      body?.error?.message ?? "",
    );
  return body as ImportReport;
}

export function useSyncStatus(enabled: boolean) {
  return useQuery({
    queryKey: ["sync-status"],
    queryFn: () => unwrap(api["sync-client"].$get()),
    enabled,
    refetchInterval: 15_000,
  });
}

export function useSyncMutations() {
  const qc = useQueryClient();
  const done = (data: SyncStatus) => {
    qc.setQueryData(["sync-status"], data);
    // New data may have arrived from the cloud.
    qc.invalidateQueries();
  };
  return {
    link: useMutation({
      mutationFn: (json: SyncLinkInput) => unwrap(api["sync-client"].link.$post({ json })),
      onSuccess: done,
    }),
    now: useMutation({
      mutationFn: () => unwrap(api["sync-client"].now.$post()),
      onSuccess: done,
    }),
    unlink: useMutation({
      mutationFn: () => unwrap(api["sync-client"].unlink.$post()),
      onSuccess: done,
    }),
  };
}

export function useSyncDevices(enabled: boolean) {
  return useQuery({
    queryKey: ["sync-devices"],
    queryFn: () => unwrap(api["sync-devices"].$get()),
    enabled,
  });
}

export function useRevokeDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(api["sync-devices"][":id"].$delete({ param: { id } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sync-devices"] }),
  });
}
