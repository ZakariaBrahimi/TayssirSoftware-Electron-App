"use client";

import { Banknote, Pencil, Trash2, Truck } from "lucide-react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { AdminOnly } from "@/components/admin-only";
import { BalanceAmount } from "@/components/balance-amount";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useMoney } from "@/hooks/use-settings";
import { Link, useRouter } from "@/i18n/navigation";
import { PartyFormDialog } from "../parties/party-form-dialog";
import { PaymentDialog } from "../parties/payment-dialog";
import { StatementTable } from "../parties/statement-table";
import { useSupplierMutations, useSupplierStatement } from "./api";

export function SupplierDetail() {
  const t = useTranslations("suppliers");
  const tc = useTranslations("common");
  const money = useMoney();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const { id } = useParams<{ id: string }>();
  const statement = useSupplierStatement(id);
  const { update, remove, pay } = useSupplierMutations();
  const [dialog, setDialog] = useState<"edit" | "pay" | null>(null);

  if (statement.isError)
    return <p className="text-muted-foreground py-20 text-center">{tc("notFound")}</p>;
  if (!statement.data) return <Skeleton className="h-96 w-full" />;
  const { supplier, entries } = statement.data;

  return (
    <AdminOnly>
      <PageHeader
        title={supplier.name}
        description={[supplier.phone, supplier.email].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            <Button variant="outline" onClick={() => setDialog("edit")}>
              <Pencil />
              {tc("edit")}
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/purchases/new?supplier=${supplier.id}`}>
                <Truck />
                {t("newPurchase")}
              </Link>
            </Button>
            <Button onClick={() => setDialog("pay")}>
              <Banknote />
              {t("recordPayment")}
            </Button>
          </>
        }
      />
      <Card className="mb-6 max-w-sm gap-2 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-muted-foreground text-sm font-medium">
            {t("balance")}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 text-2xl font-semibold">
          <BalanceAmount value={supplier.balance} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("statement")}</CardTitle>
        </CardHeader>
        <CardContent>
          <StatementTable
            entries={entries.map((e) => ({
              id: e.id,
              date: e.date,
              label:
                e.type === "purchase"
                  ? `${t("entry_purchase")}${e.reference ? ` · ${e.reference}` : ""}`
                  : t("entry_payment"),
              note:
                e.type === "purchase" ? `${tc("total")}: ${money.format(e.total)}` : e.reference,
              amount: e.amount,
              balance: e.balance,
            }))}
          />
        </CardContent>
      </Card>
      <div className="mt-6">
        <ConfirmDialog
          description={t("deleteConfirm", { name: supplier.name })}
          confirmLabel={tc("delete")}
          onConfirm={() =>
            remove.mutate(supplier.id, {
              onSuccess: () => {
                toast.success(tc("deleted"));
                router.push("/suppliers");
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
      <PartyFormDialog
        open={dialog === "edit"}
        onOpenChange={(o) => setDialog(o ? "edit" : null)}
        title={t("edit")}
        initial={supplier}
        isPending={update.isPending}
        onSubmit={(values) =>
          update.mutate(
            { id: supplier.id, json: values },
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
        description={supplier.name}
        suggested={supplier.balance}
        isPending={pay.isPending}
        onSubmit={(json) =>
          pay.mutate(
            { id: supplier.id, json },
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
    </AdminOnly>
  );
}
