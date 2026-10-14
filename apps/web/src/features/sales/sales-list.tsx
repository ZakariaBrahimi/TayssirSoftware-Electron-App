"use client";

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useDateFormat, useMoney } from "@/hooks/use-settings";
import { dayEndIso, dayStartIso, presetRange } from "@/lib/dates";
import { type SalePage, useSales } from "./api";
import { SaleDetailSheet } from "./sale-detail";

type Row = SalePage["rows"][number];
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, Row>();
const emptyRows: Row[] = [];

export function SalesList() {
  const t = useTranslations("sales");
  const tp = useTranslations("pos");
  const tc = useTranslations("common");
  const money = useMoney();
  const dates = useDateFormat();
  const { isAdmin } = useCurrentUser();

  const initial = presetRange("last30");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [status, setStatus] = useState<"all" | "completed" | "voided">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const q = useDebouncedValue(search.trim(), 300);

  const query = useSales({
    from: from ? dayStartIso(from) : undefined,
    to: to ? dayEndIso(to) : undefined,
    status: status === "all" ? undefined : status,
    q: /^\d+$/.test(q) ? Number(q) : undefined,
    page,
    pageSize: 20,
  });

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("id", {
          header: t("number"),
          cell: ({ getValue }) => <span className="font-mono">#{getValue()}</span>,
        }),
        helper.accessor("createdAt", {
          header: t("date"),
          cell: ({ getValue }) => dates.dateTime(getValue()),
        }),
        helper.accessor("cashierName", {
          header: t("cashier"),
          cell: ({ getValue }) => getValue() ?? "—",
        }),
        helper.accessor("itemCount", {
          header: t("items"),
          cell: ({ getValue }) => <span className="tabular-nums">{getValue()}</span>,
        }),
        helper.accessor("paymentMethod", {
          header: t("payment"),
          cell: ({ getValue }) => tp(getValue()),
        }),
        helper.accessor("total", {
          header: t("total"),
          cell: ({ getValue }) => (
            <span className="font-medium tabular-nums">{money.format(getValue())}</span>
          ),
        }),
        ...(isAdmin
          ? [
              helper.display({
                id: "profit",
                header: t("profit"),
                cell: ({ row }) => (
                  <span className="text-muted-foreground tabular-nums">
                    {row.original.status === "voided"
                      ? "—"
                      : money.format(row.original.total - row.original.totalCost)}
                  </span>
                ),
              }),
            ]
          : []),
        helper.accessor("status", {
          header: t("status"),
          cell: ({ getValue }) => (
            <Badge variant={getValue() === "voided" ? "destructive" : "success"}>
              {t(getValue())}
            </Badge>
          ),
        }),
      ]),
    [t, tp, money, dates, isAdmin],
  );

  const table = useTable({
    features,
    columns,
    data: query.data?.rows ?? emptyRows,
    getRowId: (row) => String(row.id),
  });

  const onFilter =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      fn(v);
      setPage(1);
    };

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="from">{t("from")}</Label>
          <Input
            id="from"
            type="date"
            value={from}
            max={to}
            onChange={(e) => onFilter(setFrom)(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="to">{t("to")}</Label>
          <Input
            id="to"
            type="date"
            value={to}
            min={from}
            onChange={(e) => onFilter(setTo)(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>{t("status")}</Label>
          <Select
            value={status}
            onValueChange={onFilter((v: string) => setStatus(v as typeof status))}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tc("all")}</SelectItem>
              <SelectItem value="completed">{t("completed")}</SelectItem>
              <SelectItem value="voided">{t("voided")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="relative min-w-44 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            inputMode="numeric"
            value={search}
            onChange={(e) => onFilter(setSearch)(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="ps-9"
          />
        </div>
      </div>

      <DataTable
        table={table}
        isLoading={query.isPending}
        emptyMessage={t("empty")}
        onRowClick={(row) => setSelected(row.id)}
      />
      {query.data && (
        <Pagination
          page={query.data.page}
          pageCount={query.data.pageCount}
          total={query.data.total}
          onPageChange={setPage}
        />
      )}
      <SaleDetailSheet saleId={selected} onClose={() => setSelected(null)} />
    </>
  );
}
