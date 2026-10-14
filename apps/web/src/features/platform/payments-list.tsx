"use client";

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { Ban, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Link } from "@/i18n/navigation";
import { PLATFORM_PAYMENT_METHODS, type PlatformPaymentMethod } from "@/lib/validators/platform";
import { type PaymentPage, usePaymentMutations, usePayments, usePlatformMoney } from "./api";
import { FormDialog, whenOpen } from "./form-dialog";
import { RecordPaymentDialog } from "./record-payment-dialog";
import { ALL, ShortDate } from "./shared";

type Row = PaymentPage["rows"][number];
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, Row>();
const emptyRows: Row[] = [];

function VoidDialogBody({
  payment,
  open,
  onOpenChange,
}: {
  payment: Row;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("platform.payments");
  const money = usePlatformMoney();
  const errorMessage = useErrorMessage();
  const { void: voidPayment } = usePaymentMutations();
  const [reason, setReason] = useState("");
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("voidTitle", { amount: money.format(payment.amount) })}
      description={t("voidHint")}
      destructive
      submitLabel={t("void")}
      isPending={voidPayment.isPending}
      onSubmit={() =>
        voidPayment.mutate(
          { id: payment.id, reason: reason.trim() },
          {
            onSuccess: () => {
              toast.success(t("voidedDone"));
              onOpenChange(false);
            },
            onError: (err) => toast.error(errorMessage(err)),
          },
        )
      }
    >
      <div className="grid gap-2">
        <Label htmlFor="void-reason">{t("reason")}</Label>
        <Input
          id="void-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={300}
          autoFocus
        />
      </div>
    </FormDialog>
  );
}
const VoidDialog = whenOpen(VoidDialogBody);

export function PaymentsList() {
  const t = useTranslations("platform.payments");
  const tm = useTranslations("platform.methods");
  const money = usePlatformMoney();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [method, setMethod] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [recording, setRecording] = useState(false);
  const [voiding, setVoiding] = useState<Row | null>(null);
  const query = usePayments({
    from: from || undefined,
    to: to || undefined,
    method: method === ALL ? undefined : (method as PlatformPaymentMethod),
    page,
    pageSize: 25,
  });

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("createdAt", {
          header: t("date"),
          cell: ({ getValue }) => <ShortDate value={getValue()} />,
        }),
        helper.display({
          id: "for",
          header: t("for"),
          cell: ({ row }) => {
            const p = row.original;
            return p.storeId ? (
              <Link href={`/platform/stores/${p.storeId}`} className="font-medium hover:underline">
                {p.storeName ?? "—"}
              </Link>
            ) : (
              <Link href={`/platform/licenses?id=${p.licenseId}`} className="hover:underline">
                <span className="font-medium">{p.licenseCustomer ?? t("license")}</span>{" "}
                <span className="text-muted-foreground font-mono text-xs" dir="ltr">
                  …{p.licenseHint}
                </span>
              </Link>
            );
          },
        }),
        helper.accessor("amount", {
          header: t("amount"),
          cell: ({ row }) => (
            <span className="flex items-center gap-2 tabular-nums">
              <span className={row.original.voidedAt ? "line-through opacity-60" : "font-medium"}>
                {money.format(row.original.amount)}
              </span>
              {row.original.voidedAt && <Badge variant="destructive">{t("voided")}</Badge>}
            </span>
          ),
        }),
        helper.accessor("method", {
          header: t("method"),
          cell: ({ row }) => (
            <div>
              {tm(row.original.method)}
              {row.original.reference && (
                <div className="text-muted-foreground text-xs">{row.original.reference}</div>
              )}
            </div>
          ),
        }),
        helper.accessor("months", {
          header: t("period"),
          cell: ({ row }) =>
            row.original.months > 0 ? (
              <span>
                {t("monthsCount", { count: row.original.months })}
                {row.original.periodEnd && (
                  <span className="text-muted-foreground block text-xs">
                    → <ShortDate value={row.original.periodEnd} />
                  </span>
                )}
              </span>
            ) : (
              "—"
            ),
        }),
        helper.accessor("recordedByName", {
          header: t("recordedBy"),
          cell: ({ getValue }) => <span dir="ltr">{getValue() ?? "—"}</span>,
        }),
        helper.display({
          id: "actions",
          header: "",
          cell: ({ row }) =>
            row.original.voidedAt ? null : (
              <div className="text-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setVoiding(row.original)}
                >
                  <Ban />
                  {t("void")}
                </Button>
              </div>
            ),
        }),
      ]),
    [t, tm, money],
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
          <Button onClick={() => setRecording(true)}>
            <Plus />
            {t("record")}
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <Label htmlFor="pay-from" className="text-muted-foreground text-xs">
            {t("from")}
          </Label>
          <Input
            id="pay-from"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="w-40"
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="pay-to" className="text-muted-foreground text-xs">
            {t("to")}
          </Label>
          <Input
            id="pay-to"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="w-40"
          />
        </div>
        <Select
          value={method}
          onValueChange={(v) => {
            setMethod(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44" aria-label={t("method")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allMethods")}</SelectItem>
            {PLATFORM_PAYMENT_METHODS.map((m) => (
              <SelectItem key={m} value={m}>
                {tm(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {query.data && (
          <div className="ms-auto text-sm">
            <span className="text-muted-foreground">{t("total")}: </span>
            <span className="font-semibold tabular-nums">{money.format(query.data.amount)}</span>
          </div>
        )}
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
      <RecordPaymentDialog open={recording} onOpenChange={setRecording} />
      {voiding && (
        <VoidDialog
          payment={voiding}
          open={Boolean(voiding)}
          onOpenChange={(open) => !open && setVoiding(null)}
        />
      )}
    </>
  );
}
