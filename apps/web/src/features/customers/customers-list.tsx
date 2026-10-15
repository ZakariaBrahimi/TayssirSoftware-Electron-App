"use client";

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { Download, Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BalanceAmount } from "@/components/balance-amount";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useMoney } from "@/hooks/use-settings";
import { useRouter } from "@/i18n/navigation";
import { PartyFormDialog } from "../parties/party-form-dialog";
import { type CustomerPage, useCustomerMutations, useCustomers } from "./api";

type Row = CustomerPage["rows"][number];
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, Row>();
const emptyRows: Row[] = [];

export function CustomersList() {
  const t = useTranslations("customers");
  const tc = useTranslations("common");
  const money = useMoney();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const { isAdmin } = useCurrentUser();
  const { create } = useCustomerMutations();
  const [search, setSearch] = useState("");
  const [withBalance, setWithBalance] = useState(false);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const q = useDebouncedValue(search.trim(), 250);
  const query = useCustomers({
    q: q || undefined,
    withBalance: withBalance ? "true" : undefined,
    page,
    pageSize: 20,
  });

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
        helper.accessor("creditLimit", {
          header: t("creditLimit"),
          cell: ({ getValue }) => {
            const v = getValue();
            return (
              <span className="text-muted-foreground tabular-nums">
                {v === null ? t("noLimit") : money.format(v)}
              </span>
            );
          },
        }),
        helper.accessor("balance", {
          header: t("balance"),
          cell: ({ getValue }) => <BalanceAmount value={getValue()} />,
        }),
      ]),
    [t, tc, money],
  );

  const table = useTable({
    features,
    columns,
    data: query.data?.rows ?? emptyRows,
    getRowId: (r) => r.id,
  });

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <>
            {isAdmin && (
              <Button variant="outline" asChild>
                <a href="/api/data/export/customers" download>
                  <Download />
                  {tc("export")}
                </a>
              </Button>
            )}
            <Button onClick={() => setCreating(true)}>
              <Plus />
              {t("new")}
            </Button>
          </>
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
        <div className="flex items-center gap-2">
          <Switch
            id="with-balance"
            checked={withBalance}
            onCheckedChange={(v) => {
              setWithBalance(v);
              setPage(1);
            }}
          />
          <Label htmlFor="with-balance">{t("withBalance")}</Label>
        </div>
        {query.data && (
          <div className="ms-auto text-sm">
            <span className="text-muted-foreground">{t("totalReceivables")}: </span>
            <BalanceAmount value={query.data.totalBalance} />
          </div>
        )}
      </div>
      <DataTable
        table={table}
        isLoading={query.isPending}
        emptyMessage={!q ? t("empty") : undefined}
        onRowClick={(row) => router.push(`/customers/${row.id}`)}
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
        withCreditLimit
        isPending={create.isPending}
        onSubmit={(values) =>
          create.mutate(values, {
            onSuccess: (c) => {
              toast.success(t("created"));
              setCreating(false);
              router.push(`/customers/${c.id}`);
            },
            onError: (err) => toast.error(errorMessage(err)),
          })
        }
      />
    </>
  );
}
