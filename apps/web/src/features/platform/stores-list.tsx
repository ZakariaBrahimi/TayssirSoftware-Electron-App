"use client";

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useRouter } from "@/i18n/navigation";
import { STORE_SORTS, STORE_STATUSES, type StoreStatus } from "@/lib/validators/platform";
import { type StorePage, useStores } from "./api";
import { ALL, RelativeDate, ShortDate, StoreStatusBadge } from "./shared";

type Row = StorePage["rows"][number];
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, Row>();
const emptyRows: Row[] = [];

export function StoresList() {
  const t = useTranslations("platform.stores");
  const ts = useTranslations("platform.status");
  const router = useRouter();
  const params = useSearchParams();
  const initialStatus = params.get("status");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(
    STORE_STATUSES.includes(initialStatus as StoreStatus) ? initialStatus! : ALL,
  );
  const [sort, setSort] = useState<(typeof STORE_SORTS)[number]>("-createdAt");
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim(), 250);
  const query = useStores({
    q: q || undefined,
    status: status === ALL ? undefined : (status as StoreStatus),
    sort,
    page,
    pageSize: 25,
  });

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("name", {
          header: t("store"),
          cell: ({ row }) => (
            <div className="min-w-40">
              <div className="font-medium">{row.original.name}</div>
              <div className="text-muted-foreground text-xs" dir="ltr">
                {row.original.owner ? `@${row.original.owner}` : "—"}
              </div>
            </div>
          ),
        }),
        helper.accessor("status", {
          header: t("status"),
          cell: ({ getValue }) => <StoreStatusBadge status={getValue() as StoreStatus} />,
        }),
        helper.accessor("plan", { header: t("plan") }),
        helper.accessor("renewalAt", {
          header: t("renewal"),
          cell: ({ getValue }) => <ShortDate value={getValue()} />,
        }),
        helper.accessor("lastSeenAt", {
          header: t("lastActivity"),
          cell: ({ getValue }) => <RelativeDate value={getValue()} fallback={t("never")} />,
        }),
        helper.accessor("users", {
          header: t("users"),
          cell: ({ getValue }) => <span className="tabular-nums">{getValue()}</span>,
        }),
        helper.accessor("devices", {
          header: t("devices"),
          cell: ({ getValue }) => <span className="tabular-nums">{getValue()}</span>,
        }),
        helper.accessor("createdAt", {
          header: t("created"),
          cell: ({ getValue }) => <ShortDate value={getValue()} />,
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
          <SelectTrigger className="w-44" aria-label={t("status")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allStatuses")}</SelectItem>
            {STORE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {ts(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="w-48" aria-label={t("sort")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STORE_SORTS.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`sort_${s.replace("-", "desc_")}` as "sort_name")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DataTable
        table={table}
        isLoading={query.isPending}
        emptyMessage={t("empty")}
        onRowClick={(row) => router.push(`/platform/stores/${row.id}`)}
      />
      {query.data && (
        <Pagination
          page={query.data.page}
          pageCount={query.data.pageCount}
          total={query.data.total}
          onPageChange={setPage}
        />
      )}
    </>
  );
}
