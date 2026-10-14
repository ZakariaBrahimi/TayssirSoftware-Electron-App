"use client";

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { AdminOnly } from "@/components/admin-only";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDateFormat, useMoney } from "@/hooks/use-settings";
import { Link } from "@/i18n/navigation";
import { type PurchasePage, usePurchase, usePurchases } from "./api";

type Row = PurchasePage["rows"][number];
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, Row>();
const emptyRows: Row[] = [];

function PurchaseSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const t = useTranslations("purchases");
  const money = useMoney();
  const dates = useDateFormat();
  const { data } = usePurchase(id);
  return (
    <Sheet open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="end" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {t("detailTitle")}
            {data?.reference ? ` · ${data.reference}` : ""}
          </SheetTitle>
          <SheetDescription>
            {data &&
              [
                dates.dateTime(data.createdAt),
                data.supplierName,
                data.userName && t("receivedBy", { name: data.userName }),
              ]
                .filter(Boolean)
                .join(" · ")}
          </SheetDescription>
        </SheetHeader>
        {!data ? (
          <Skeleton className="mx-4 h-40" />
        ) : (
          <div className="grid gap-4 px-4 pb-4 text-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("items")}</TableHead>
                  <TableHead className="text-end">{t("quantity")}</TableHead>
                  <TableHead className="text-end">{t("unitCost")}</TableHead>
                  <TableHead className="text-end">{t("lineTotal")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="max-w-40 truncate">{i.productName}</TableCell>
                    <TableCell className="text-end tabular-nums">{i.quantity}</TableCell>
                    <TableCell className="text-end tabular-nums">
                      {money.format(i.unitCost)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {money.format(i.lineTotal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="grid gap-1">
              <div className="flex justify-between font-semibold">
                <span>{t("total")}</span>
                <span className="tabular-nums">{money.format(data.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("amountPaid")}</span>
                <span className="tabular-nums">{money.format(data.amountPaid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("remaining")}</span>
                <span className="tabular-nums">{money.format(data.total - data.amountPaid)}</span>
              </div>
            </div>
            {data.note && (
              <p className="bg-muted text-muted-foreground rounded-md p-3">{data.note}</p>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function PurchasesList() {
  const t = useTranslations("purchases");
  const money = useMoney();
  const dates = useDateFormat();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const query = usePurchases({ page, pageSize: 20 });

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("createdAt", {
          header: t("detailTitle"),
          cell: ({ getValue }) => dates.dateTime(getValue()),
        }),
        helper.accessor("supplierName", {
          header: t("supplier"),
          cell: ({ getValue }) => getValue() ?? "—",
        }),
        helper.accessor("reference", {
          header: t("reference"),
          cell: ({ getValue }) => getValue() ?? "—",
        }),
        helper.accessor("itemCount", {
          header: t("quantity"),
          cell: ({ getValue }) => <span className="tabular-nums">{getValue()}</span>,
        }),
        helper.accessor("total", {
          header: t("total"),
          cell: ({ getValue }) => (
            <span className="font-medium tabular-nums">{money.format(getValue())}</span>
          ),
        }),
        helper.display({
          id: "remaining",
          header: t("remaining"),
          cell: ({ row }) => (
            <span className="text-muted-foreground tabular-nums">
              {money.format(row.original.total - row.original.amountPaid)}
            </span>
          ),
        }),
      ]),
    [t, money, dates],
  );
  const table = useTable({
    features,
    columns,
    data: query.data?.rows ?? emptyRows,
    getRowId: (r) => r.id,
  });

  return (
    <AdminOnly>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button asChild>
            <Link href="/purchases/new">
              <Plus />
              {t("new")}
            </Link>
          </Button>
        }
      />
      <DataTable
        table={table}
        isLoading={query.isPending}
        emptyMessage={t("empty")}
        onRowClick={(r) => setSelected(r.id)}
      />
      {query.data && (
        <Pagination
          page={query.data.page}
          pageCount={query.data.pageCount}
          total={query.data.total}
          onPageChange={setPage}
        />
      )}
      <PurchaseSheet id={selected} onClose={() => setSelected(null)} />
    </AdminOnly>
  );
}
