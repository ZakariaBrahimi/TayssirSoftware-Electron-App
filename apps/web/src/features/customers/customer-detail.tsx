"use client";

import { Banknote, Pencil, Printer, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { BalanceAmount } from "@/components/balance-amount";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useErrorMessage } from "@/hooks/use-error-message";
import { usePrint } from "@/hooks/use-print";
import { useDateFormat, useMoney, useSettings } from "@/hooks/use-settings";
import { useRouter } from "@/i18n/navigation";
import { PartyFormDialog } from "../parties/party-form-dialog";
import { PaymentDialog } from "../parties/payment-dialog";
import { type StatementEntry, StatementTable } from "../parties/statement-table";
import { type CustomerStatement, useCustomerMutations, useCustomerStatement } from "./api";

function useEntries(data: CustomerStatement | undefined): StatementEntry[] {
  const t = useTranslations("customers");
  const tc = useTranslations("common");
  const money = useMoney();
  return (data?.entries ?? []).map((e) => ({
    id: e.id,
    date: e.date,
    label:
      e.type === "sale"
        ? `${t("entry_sale", { reference: e.reference ?? "" })}${e.voided ? ` (${t("voided")})` : ""}`
        : e.type === "payment"
          ? t("entry_payment")
          : t("entry_return"),
    note:
      e.type === "payment"
        ? e.reference
        : e.type === "sale" && e.total
          ? `${tc("total")}: ${money.format(e.total)}`
          : null,
    amount: e.amount,
    balance: e.balance,
    muted: e.voided,
  }));
}

function PrintableStatement({
  data,
  entries,
}: {
  data: CustomerStatement;
  entries: StatementEntry[];
}) {
  const t = useTranslations("customers");
  const { data: store } = useSettings();
  const dates = useDateFormat();
  return (
    <div className="bg-white p-6 text-sm text-black">
      <div className="mb-4 flex justify-between">
        <div>
          <div className="text-lg font-bold">{store?.name}</div>
          {store?.address && <div>{store.address}</div>}
          {store?.phone && <div dir="ltr">{store.phone}</div>}
        </div>
        <div className="text-end">
          <div className="font-semibold">{t("statementTitle")}</div>
          <div>{dates.date(new Date())}</div>
        </div>
      </div>
      <div className="mb-4">
        <div className="font-semibold">{data.customer.name}</div>
        {data.customer.phone && <div dir="ltr">{data.customer.phone}</div>}
      </div>
      <StatementTable entries={entries} />
      <div className="mt-4 text-end text-base font-bold">
        {t("balance")}: <BalanceAmount value={data.customer.balance} className="text-black" />
      </div>
    </div>
  );
}

export function CustomerDetail() {
  const t = useTranslations("customers");
  const tc = useTranslations("common");
  const money = useMoney();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const { isAdmin } = useCurrentUser();
  const { id } = useParams<{ id: string }>();
  const statement = useCustomerStatement(id);
  const { update, remove, pay } = useCustomerMutations();
  const { print, printArea } = usePrint();
  const [dialog, setDialog] = useState<"edit" | "pay" | null>(null);
  const entries = useEntries(statement.data);

  if (statement.isError) {
    return <p className="text-muted-foreground py-20 text-center">{tc("notFound")}</p>;
  }
  if (!statement.data) return <Skeleton className="h-96 w-full" />;
  const { customer } = statement.data;

  return (
    <>
      <PageHeader
        title={customer.name}
        description={[customer.phone, customer.email].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => print(<PrintableStatement data={statement.data} entries={entries} />)}
            >
              <Printer />
              {t("printStatement")}
            </Button>
            {isAdmin && (
              <Button variant="outline" onClick={() => setDialog("edit")}>
                <Pencil />
                {tc("edit")}
              </Button>
            )}
            <Button onClick={() => setDialog("pay")}>
              <Banknote />
              {t("recordPayment")}
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              {t("balance")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-2xl font-semibold">
            <BalanceAmount value={customer.balance} />
            <p className="text-muted-foreground mt-1 text-xs font-normal">
              {customer.balance > 0
                ? t("owes")
                : customer.balance < 0
                  ? t("storeCredit")
                  : t("settled")}
            </p>
          </CardContent>
        </Card>
        <Card className="gap-2 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              {t("creditLimit")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 text-2xl font-semibold tabular-nums">
            {customer.creditLimit === null ? t("noLimit") : money.format(customer.creditLimit)}
          </CardContent>
        </Card>
        {(customer.address || customer.notes) && (
          <Card className="gap-2 py-4">
            <CardHeader className="px-4">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                {tc("details")}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 text-sm whitespace-pre-line">
              {[customer.address, customer.notes].filter(Boolean).join("\n")}
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("statement")}</CardTitle>
        </CardHeader>
        <CardContent>
          <StatementTable entries={entries} />
        </CardContent>
      </Card>

      {isAdmin && (
        <div className="mt-6">
          <ConfirmDialog
            description={t("deleteConfirm", { name: customer.name })}
            confirmLabel={tc("delete")}
            onConfirm={() =>
              remove.mutate(customer.id, {
                onSuccess: () => {
                  toast.success(tc("deleted"));
                  router.push("/customers");
                },
                onError: (err) => toast.error(errorMessage(err)),
              })
            }
            trigger={
              <Button variant="ghost" className="text-destructive">
                <Trash2 />
                {tc("delete")}
              </Button>
            }
          />
        </div>
      )}

      <PartyFormDialog
        open={dialog === "edit"}
        onOpenChange={(o) => setDialog(o ? "edit" : null)}
        title={t("edit")}
        initial={customer}
        withCreditLimit
        isPending={update.isPending}
        onSubmit={(values) =>
          update.mutate(
            { id: customer.id, json: values },
            {
              onSuccess: () => {
                toast.success(t("updated"));
                setDialog(null);
              },
              onError: (err) => toast.error(errorMessage(err)),
            },
          )
        }
      />
      <PaymentDialog
        open={dialog === "pay"}
        onOpenChange={(o) => setDialog(o ? "pay" : null)}
        title={t("recordPayment")}
        description={customer.name}
        suggested={customer.balance}
        isPending={pay.isPending}
        onSubmit={(json) =>
          pay.mutate(
            { id: customer.id, json },
            {
              onSuccess: () => {
                toast.success(t("paymentRecorded"));
                setDialog(null);
              },
              onError: (err) => toast.error(errorMessage(err)),
            },
          )
        }
      />
      {printArea}
    </>
  );
}
