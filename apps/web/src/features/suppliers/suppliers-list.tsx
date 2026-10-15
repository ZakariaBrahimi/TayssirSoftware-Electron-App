"use client";

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminOnly } from "@/components/admin-only";
import { BalanceAmount } from "@/components/balance-amount";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useRouter } from "@/i18n/navigation";
import { PartyFormDialog } from "../parties/party-form-dialog";
import { type SupplierPage, useSupplierMutations, useSuppliers } from "./api";

type Row = SupplierPage["rows"][number];
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, Row>();
const emptyRows: Row[] = [];

export function SuppliersList() {
  const t = useTranslations("suppliers");
  const tc = useTranslations("common");
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const { create } = useSupplierMutations();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const q = useDebouncedValue(search.trim(), 250);
  const query = useSuppliers({ q: q || undefined, page, pageSize: 20 });

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("name", {
          header: tc("name"),
          cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
        }),
        helper.accessor("phone", {
          header: tc("phone"),
          cell: ({ getValue }) => <span dir="ltr">{getValue() ?? "—"}</span>,
        }),
        helper.accessor("balance", {
          header: t("balance"),
          cell: ({ getValue }) => <BalanceAmount value={getValue()} />,
        }),
      ]),
    [t, tc],
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
          <Button onClick={() => setCreating(true)}>
            <Plus />
            {t("new")}
          </Button>
        }
      />
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
        {query.data && (
          <div className="ms-auto text-sm">
            <span className="text-muted-foreground">{t("totalPayables")}: </span>
            <BalanceAmount value={query.data.totalBalance} />
          </div>
        )}
      </div>
      <DataTable
        table={table}
        isLoading={query.isPending}
        emptyMessage={!q ? t("empty") : undefined}
        onRowClick={(row) => router.push(`/suppliers/${row.id}`)}
      />
      {query.data && (
        <Pagination
          page={query.data.page}
          pageCount={query.data.pageCount}
          total={query.data.total}
          onPageChange={setPage}
        />
      )}
      <PartyFormDialog
        open={creating}
        onOpenChange={setCreating}
        title={t("new")}
        isPending={create.isPending}
        onSubmit={(values) =>
          create.mutate(values, {
            onSuccess: () => {
              toast.success(t("created"));
              setCreating(false);
            },
            onError: (err) => toast.error(errorMessage(err)),
          })
        }
      />
    </AdminOnly>
  );
}
