"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminOnly } from "@/components/admin-only";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useMoney } from "@/hooks/use-settings";
import { useRouter } from "@/i18n/navigation";
import { type PickedProduct, ProductPicker } from "../products/product-picker";
import { useSuppliers } from "../suppliers/api";
import { PURCHASE_PREFILL_KEY, type PurchasePrefill } from "../stock/api";
import { useCreatePurchase } from "./api";
import { isMeasured, lineAmount, round3 } from "@/lib/quantity";

type Line = {
  productId: string;
  name: string;
  currentCost: number;
  quantity: string;
  unitCost: string;
  unit?: string;
};
const NONE = "none";

/** Whole pieces, or up to 3 decimals for weighed / measured products. */
const lineQuantity = (l: Line) => {
  const n = Math.max(0, Number(l.quantity.replace(",", ".")) || 0);
  return isMeasured(l.unit) ? round3(n) : Math.floor(n);
};

export function PurchaseForm() {
  const t = useTranslations("purchases");
  const tc = useTranslations("common");
  const money = useMoney();
  const router = useRouter();
  const params = useSearchParams();
  const errorMessage = useErrorMessage();
  const suppliers = useSuppliers({ page: 1, pageSize: 200 });
  const create = useCreatePurchase();

  const [supplierId, setSupplierId] = useState<string>(params.get("supplier") ?? NONE);
  // Clear the reorder prefill once it is in the form.
  useEffect(() => {
    try {
      sessionStorage.removeItem(PURCHASE_PREFILL_KEY);
    } catch {
      // Storage unavailable: nothing to clear.
    }
  }, []);
  const [reference, setReference] = useState("");
  // Lines prepared on the reorder page, read once. The form only renders
  // in the browser (after the session loads), so storage is available.
  const [lines, setLines] = useState<Line[]>(() => {
    try {
      const raw = sessionStorage.getItem(PURCHASE_PREFILL_KEY);
      if (!raw) return [];
      return (JSON.parse(raw) as PurchasePrefill).map((p) => ({
        productId: p.productId,
        name: p.name,
        currentCost: p.currentCost,
        quantity: String(p.quantity),
        unit: p.unit,
        unitCost: String(money.toMajor(p.unitCost)),
      }));
    } catch {
      return [];
    }
  });
  const [paid, setPaid] = useState("");
  const [note, setNote] = useState("");

  const lineTotal = (l: Line) =>
    lineAmount(money.toMinor(Number(l.unitCost) || 0), lineQuantity(l));
  const total = lines.reduce((s, l) => s + lineTotal(l), 0);
  const paidMinor =
    paid === "" ? (supplierId === NONE ? total : 0) : money.toMinor(Number(paid) || 0);
  const remaining = Math.max(0, total - paidMinor);

  const add = (p: PickedProduct) =>
    setLines((ls) =>
      ls.some((l) => l.productId === p.id)
        ? ls.map((l) =>
            l.productId === p.id ? { ...l, quantity: String((Number(l.quantity) || 0) + 1) } : l,
          )
        : [
            ...ls,
            {
              productId: p.id,
              name: p.name,
              currentCost: p.costPrice,
              quantity: "1",
              unit: p.unit,
              unitCost: String(money.toMajor(p.costPrice)),
            },
          ],
    );
  const update = (id: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.productId === id ? { ...l, ...patch } : l)));

  const submit = () => {
    if (lines.length === 0) return toast.error(t("noItems"));
    if (remaining > 0 && supplierId === NONE) return toast.error(t("supplierRequired"));
    create.mutate(
      {
        supplierId: supplierId === NONE ? null : supplierId,
        reference: reference.trim() || undefined,
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: lineQuantity(l) || 1,
          unitCost: money.toMinor(Number(l.unitCost) || 0),
        })),
        amountPaid: Math.min(paidMinor, total),
        note: note.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(t("created"));
          router.push("/purchases");
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <AdminOnly>
      <PageHeader title={t("newTitle")} description={t("newDescription")} />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader>
            <CardTitle>{t("items")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ProductPicker stockedOnly onPick={add} placeholder={t("addProduct")} />
            {lines.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("items")}</TableHead>
                    <TableHead className="w-24">{t("quantity")}</TableHead>
                    <TableHead className="w-32">
                      {t("unitCost")} ({money.currency})
                    </TableHead>
                    <TableHead className="text-end">{t("lineTotal")}</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => (
                    <TableRow key={l.productId}>
                      <TableCell className="whitespace-normal">
                        <div className="font-medium">{l.name}</div>
                        <div className="text-muted-foreground text-xs">
                          {t("currentCost", { cost: money.format(l.currentCost) })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          inputMode={isMeasured(l.unit) ? "decimal" : "numeric"}
                          step={isMeasured(l.unit) ? "any" : 1}
                          min={0}
                          value={l.quantity}
                          onChange={(e) => update(l.productId, { quantity: e.target.value })}
                          className="h-8 tabular-nums"
                          aria-label={t("quantity")}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.01"
                          value={l.unitCost}
                          onChange={(e) => update(l.productId, { unitCost: e.target.value })}
                          className="h-8 tabular-nums"
                          aria-label={t("unitCost")}
                        />
                      </TableCell>
                      <TableCell className="text-end font-medium tabular-nums">
                        {money.format(lineTotal(l))}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() =>
                            setLines((ls) => ls.filter((x) => x.productId !== l.productId))
                          }
                          aria-label={tc("delete")}
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label>{t("supplier")}</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("noSupplier")}</SelectItem>
                    {suppliers.data?.rows.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reference">{t("reference")}</Label>
                <Input
                  id="reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  maxLength={60}
                />
              </div>
              <div className="flex justify-between text-lg font-semibold">
                <span>{t("total")}</span>
                <span className="tabular-nums">{money.format(total)}</span>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="paid">
                  {t("amountPaid")} ({money.currency})
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="paid"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    placeholder={String(money.toMajor(supplierId === NONE ? total : 0))}
                    value={paid}
                    onChange={(e) => setPaid(e.target.value)}
                    className="tabular-nums"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPaid(String(money.toMajor(total)))}
                  >
                    {t("payInFull")}
                  </Button>
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("remaining")}</span>
                <span className="font-medium tabular-nums">{money.format(remaining)}</span>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="note">{tc("notes")}</Label>
                <Textarea
                  id="note"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                />
              </div>
            </CardContent>
          </Card>
          <Button size="lg" onClick={submit} disabled={create.isPending || lines.length === 0}>
            {create.isPending && <Loader2 className="animate-spin" />}
            {t("save")}
          </Button>
          <Button variant="outline" onClick={() => router.push("/purchases")}>
            {tc("cancel")}
          </Button>
        </div>
      </div>
    </AdminOnly>
  );
}
