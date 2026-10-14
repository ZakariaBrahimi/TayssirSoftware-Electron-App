"use client";

import { Ban, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useErrorMessage } from "@/hooks/use-error-message";
import { usePrint } from "@/hooks/use-print";
import { useDateFormat, useMoney } from "@/hooks/use-settings";
import { useSale, useVoidSale } from "./api";
import { Receipt } from "./receipt";

export function SaleDetailSheet({
  saleId,
  onClose,
}: {
  saleId: number | null;
  onClose: () => void;
}) {
  const t = useTranslations("sales");
  const tp = useTranslations("pos");
  const money = useMoney();
  const dates = useDateFormat();
  const errorMessage = useErrorMessage();
  const { isAdmin } = useCurrentUser();
  const { data: sale, isPending } = useSale(saleId);
  const voidSale = useVoidSale();
  const { print, printArea } = usePrint();

  return (
    <>
      <Sheet open={saleId !== null} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="end" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {t("detailTitle", { id: saleId ?? 0 })}
              {sale && (
                <Badge variant={sale.status === "voided" ? "destructive" : "success"}>
                  {t(sale.status)}
                </Badge>
              )}
            </SheetTitle>
            <SheetDescription>
              {sale &&
                `${dates.dateTime(sale.createdAt)}${sale.cashierName ? ` · ${sale.cashierName}` : ""}`}
            </SheetDescription>
          </SheetHeader>

          {isPending || !sale ? (
            <div className="grid gap-2 px-4">
              <Skeleton className="h-6" />
              <Skeleton className="h-6" />
              <Skeleton className="h-6" />
            </div>
          ) : (
            <div className="grid gap-4 px-4 pb-4 text-sm">
              <ul className="divide-y rounded-lg border">
                {sale.items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.productName}</p>
                      <p className="text-muted-foreground text-xs tabular-nums">
                        {item.quantity} × {money.format(item.unitPrice)}
                        {item.discount > 0 && ` · −${money.format(item.discount)}`}
                      </p>
                    </div>
                    <span className="font-medium tabular-nums">{money.format(item.lineTotal)}</span>
                  </li>
                ))}
              </ul>

              <div className="grid gap-1.5">
                <Row label={tp("subtotal")} value={money.format(sale.subtotal)} />
                {sale.discount > 0 && (
                  <Row label={tp("discount")} value={`−${money.format(sale.discount)}`} />
                )}
                <Row label={tp("total")} value={money.format(sale.total)} strong />
                <Separator className="my-1" />
                <Row
                  label={`${t("payment")} (${tp(sale.paymentMethod)})`}
                  value={money.format(sale.amountPaid)}
                />
                {sale.changeDue > 0 && (
                  <Row label={t("change")} value={money.format(sale.changeDue)} />
                )}
                {isAdmin && (
                  <Row label={t("profit")} value={money.format(sale.total - sale.totalCost)} />
                )}
              </div>
              {sale.note && (
                <p className="bg-muted text-muted-foreground rounded-md p-3">{sale.note}</p>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => print(<Receipt sale={sale} />)}
                >
                  <Printer />
                  {tp("printReceipt")}
                </Button>
                {isAdmin && sale.status === "completed" && (
                  <ConfirmDialog
                    description={t("voidConfirm")}
                    confirmLabel={t("void")}
                    onConfirm={() =>
                      voidSale.mutate(sale.id, {
                        onSuccess: () => toast.success(t("voidedToast")),
                        onError: (err) => toast.error(errorMessage(err)),
                      })
                    }
                    trigger={
                      <Button
                        variant="destructive"
                        className="flex-1"
                        disabled={voidSale.isPending}
                      >
                        <Ban />
                        {t("void")}
                      </Button>
                    }
                  />
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
      {printArea}
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={strong ? "flex justify-between text-base font-semibold" : "flex justify-between"}
    >
      <span className={strong ? undefined : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
