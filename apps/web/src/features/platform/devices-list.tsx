"use client";

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Link } from "@/i18n/navigation";
import { DEVICE_FILTERS } from "@/lib/validators/platform";
import { type DevicePage, useDeviceMutations, useDevices } from "./api";
import { ALL, DeviceStatusBadge, RelativeDate, ShortDate } from "./shared";

type Row = DevicePage["rows"][number];
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, Row>();
const emptyRows: Row[] = [];

function RevokeButton({ device }: { device: Row }) {
  const t = useTranslations("platform.devices");
  const errorMessage = useErrorMessage();
  const { revoke } = useDeviceMutations();
  if (device.revokedAt) return null;
  return (
    <ConfirmDialog
      title={t("revokeTitle", { name: device.name })}
      description={t("revokeHint")}
      confirmLabel={t("revoke")}
      onConfirm={() =>
        revoke.mutate(device.id, {
          onSuccess: () => toast.success(t("revoked")),
          onError: (err) => toast.error(errorMessage(err)),
        })
      }
      trigger={
        <Button variant="ghost" size="sm" className="text-destructive">
          {t("revoke")}
        </Button>
      }
    />
  );
}

export function DevicesList() {
  const t = useTranslations("platform.devices");
  const td = useTranslations("platform.deviceStatus");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim(), 250);
  const query = useDevices({
    q: q || undefined,
    status: status === ALL ? undefined : (status as (typeof DEVICE_FILTERS)[number]),
    page,
    pageSize: 25,
  });

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("name", {
          header: t("device"),
          cell: ({ row }) => (
            <div>
              <div className="font-medium">{row.original.name}</div>
              <div className="text-muted-foreground text-xs">{row.original.deviceCode}</div>
            </div>
          ),
        }),
        helper.accessor("storeName", {
          header: t("store"),
          cell: ({ row }) => (
            <Link
              href={`/platform/stores/${row.original.storeId}`}
              className="hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {row.original.storeName ?? "—"}
            </Link>
          ),
        }),
        helper.accessor("status", {
          header: t("status"),
          cell: ({ getValue }) => <DeviceStatusBadge status={getValue()} />,
        }),
        helper.accessor("appVersion", {
          header: t("version"),
          cell: ({ getValue }) => <span dir="ltr">{getValue() ?? "—"}</span>,
        }),
        helper.accessor("lastSeenAt", {
          header: t("lastSync"),
          cell: ({ getValue }) => <RelativeDate value={getValue()} />,
        }),
        helper.accessor("createdAt", {
          header: t("linked"),
          cell: ({ getValue }) => <ShortDate value={getValue()} />,
        }),
        helper.display({
          id: "actions",
          header: "",
          cell: ({ row }) => (
            <div className="text-end">
              <RevokeButton device={row.original} />
            </div>
          ),
        }),
      ]),
    [t],
  );
  const table = useTable({
    features,
    columns,
    data: query.data?.rows ?? emptyRows,
    getRowId: (r) => r.id,
  });

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {query.data && query.data.versions.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t("versions")}:</span>
          {query.data.versions.map((v) => (
            <button
              key={v.version ?? "unknown"}
              type="button"
              onClick={() => {
                setSearch(v.version ?? "");
                setPage(1);
              }}
              className="bg-muted hover:bg-accent rounded-md px-2 py-0.5"
              dir="ltr"
            >
              {v.version ?? t("unknownVersion")} · {v.devices}
            </button>
          ))}
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t("searchPlaceholder")}
            className="ps-9"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40" aria-label={t("status")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allStatuses")}</SelectItem>
            {DEVICE_FILTERS.map((s) => (
              <SelectItem key={s} value={s}>
                {td(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DataTable table={table} isLoading={query.isPending} emptyMessage={t("empty")} />
      {query.data && (
        <Pagination
          page={query.data.page}
          pageCount={query.data.pageCount}
          total={query.data.total}
          onPageChange={setPage}
        />
      )}
      <p className="text-muted-foreground mt-2 text-xs">{t("staleHint")}</p>
    </>
  );
}
