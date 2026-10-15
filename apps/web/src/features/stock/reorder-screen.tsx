"use client";

import { CheckCircle2, Lock, ShoppingCart, Wand2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { useHasFeature } from "@/components/plan-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useMoney } from "@/hooks/use-settings";
import { Link, useRouter } from "@/i18n/navigation";
import { lineAmount } from "@/lib/quantity";
import { cn } from "@/lib/utils";
import {
  PURCHASE_PREFILL_KEY,
  type PurchasePrefill,
  type StockAlertItem,
  useSetThresholds,
  useStockAlerts,
} from "./api";
import { DaysLeft, StockStatusBadge } from "./days-left";

const NO_SUPPLIER = "none";

type Group = {
  key: string;
  supplierId: string | null;
  name: string | null;
  items: StockAlertItem[];
};

function groupBySupplier(items: StockAlertItem[]): Group[] {
  const groups = new Map<string, Group>();
  for (const item of items) {
    const key = item.supplierId ?? NO_SUPPLIER;
    const group = groups.get(key) ?? {
      key,
      supplierId: item.supplierId,
      name: item.supplierName,
      items: [],
    };
    group.items.push(item);
    groups.set(key, group);
  }
  // Suppliers first (most urgent first), products without a supplier last.
  return [...groups.values()].sort(
    (a, b) => Number(a.key === NO_SUPPLIER) - Number(b.key === NO_SUPPLIER),
  );
}

function SupplierGroup({
  group,
  quantities,
  setQuantity,
}: {
  group: Group;
  quantities: Record<string, string>;
  setQuantity: (id: string, value: string) => void;
}) {
  const t = useTranslations("stock");
  const money = useMoney();
  const router = useRouter();
  const canBuy = useHasFeature("suppliers");
  const qty = (i: StockAlertItem) =>
    Math.max(0, Number(quantities[i.id] ?? i.suggestedQuantity) || 0);
  const unitCost = (i: StockAlertItem) => i.lastCost ?? i.costPrice;
  const total = group.items.reduce((s, i) => s + lineAmount(unitCost(i), qty(i)), 0);
  const lines = group.items.filter((i) => qty(i) > 0);

  const createPurchase = () => {
    const prefill: PurchasePrefill = lines.map((i) => ({
      productId: i.id,
      name: i.name,
      currentCost: i.costPrice,
      quantity: qty(i),
      unitCost: unitCost(i),
      unit: i.unit,
    }));
    try {
      sessionStorage.setItem(PURCHASE_PREFILL_KEY, JSON.stringify(prefill));
    } catch {
      // Private mode: the purchase opens empty.
    }
    router.push(
      group.supplierId ? `/purchases/new?supplier=${group.supplierId}` : "/purchases/new",
    );
  };

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="flex flex-row flex-wrap items-center gap-3 border-b px-4 py-3 [.border-b]:pb-3">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-base">{group.name ?? t("noSupplier")}</CardTitle>
          <p className="text-muted-foreground text-xs">
            {t("groupSummary", { count: group.items.length, total: money.format(total) })}
          </p>
        </div>
        {canBuy ? (
          <Button size="sm" onClick={createPurchase} disabled={lines.length === 0}>
            <ShoppingCart />
            {t("createPurchase")}
          </Button>
        ) : (
          <Button size="sm" variant="outline" asChild>
            <Link href="/subscription">
              <Lock />
              {t("purchaseInPlan")}
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground bg-muted/40 text-xs">
              <tr className="text-start">
                <th className="px-4 py-2 text-start font-medium">{t("product")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("stock")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("perDay")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("runsOut")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("alertAt")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("order")}</th>
                <th className="px-4 py-2 text-end font-medium">{t("cost")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {group.items.map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{i.name}</span>
                      <StockStatusBadge status={i.status} />
                    </div>
                    <span className="text-muted-foreground font-mono text-xs" dir="ltr">
                      {i.barcode}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-end tabular-nums">{i.stock}</td>
                  <td className="px-3 py-2 text-end tabular-nums">
                    {i.dailyRate > 0 ? i.dailyRate : "—"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <DaysLeft item={i} />
                  </td>
                  <td className="px-3 py-2 text-end whitespace-nowrap tabular-nums">
                    {i.lowStockThreshold}
                    {i.suggestedThreshold !== null &&
                      i.suggestedThreshold !== i.lowStockThreshold && (
                        <span className="text-primary ms-1 text-xs" title={t("suggestedHint")}>
                          → {i.suggestedThreshold}
                        </span>
                      )}
                  </td>
                  <td className="px-3 py-2 text-end">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={quantities[i.id] ?? String(i.suggestedQuantity)}
                      onChange={(e) => setQuantity(i.id, e.target.value)}
                      className="ms-auto h-8 w-20 text-center tabular-nums"
                      aria-label={t("orderOf", { name: i.name })}
                    />
                  </td>
                  <td className="px-4 py-2 text-end tabular-nums">
                    {qty(i) > 0 ? money.format(lineAmount(unitCost(i), qty(i))) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function ReorderScreen() {
  const t = useTranslations("stock");
  const errorMessage = useErrorMessage();
  const { data, isPending } = useStockAlerts();
  const setThresholds = useSetThresholds();
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const groups = useMemo(() => groupBySupplier(data?.items ?? []), [data]);
  const suggestions = (data?.items ?? []).filter(
    (i) => i.suggestedThreshold !== null && i.suggestedThreshold !== i.lowStockThreshold,
  );

  const applySuggestions = () =>
    setThresholds.mutate(
      {
        items: suggestions.map((i) => ({ productId: i.id, threshold: i.suggestedThreshold! })),
      },
      {
        onSuccess: (res) => {
          toast.success(t("thresholdsApplied", { count: res.updated }));
          setConfirming(false);
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          suggestions.length > 0 ? (
            <Button variant="outline" onClick={() => setConfirming(true)}>
              <Wand2 />
              {t("applySuggested", { count: suggestions.length })}
            </Button>
          ) : undefined
        }
      />
      {isPending || !data ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {(["out", "low", "soon"] as const).map((s) => (
              <span
                key={s}
                className={cn(
                  "rounded-full border px-3 py-1",
                  data.summary[s] > 0 && s === "out" && "border-destructive text-destructive",
                )}
              >
                {t(`count_${s}`, { count: data.summary[s] })}
              </span>
            ))}
            <span className="text-muted-foreground ms-auto">
              {t("rules", { alert: data.options.alertDays, cover: data.options.coverDays })}{" "}
              <Link href="/settings" className="text-primary hover:underline">
                {t("change")}
              </Link>
            </span>
          </div>
          {groups.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <CheckCircle2 className="text-primary size-8" />
                <p className="font-medium">{t("allGood")}</p>
                <p className="text-muted-foreground max-w-md text-sm">{t("allGoodHint")}</p>
              </CardContent>
            </Card>
          ) : (
            groups.map((g) => (
              <SupplierGroup
                key={g.key}
                group={g}
                quantities={quantities}
                setQuantity={(id, value) => setQuantities((q) => ({ ...q, [id]: value }))}
              />
            ))
          )}
          <p className="text-muted-foreground text-xs">{t("howItWorks")}</p>
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("applyTitle", { count: suggestions.length })}
        description={t("applyHint", { days: data?.options.alertDays ?? 7 })}
        confirmLabel={t("apply")}
        destructive={false}
        onConfirm={applySuggestions}
      />
    </>
  );
}
