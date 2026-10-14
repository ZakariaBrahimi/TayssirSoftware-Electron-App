"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Loader2, ScanBarcode, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useMoney } from "@/hooks/use-settings";
import { ApiError, api, unwrap } from "@/lib/api-client";
import {
  formatQuantity,
  formatWithUnit,
  hasAtMost3Decimals,
  isMeasured,
  round3,
} from "@/lib/quantity";
import { cn } from "@/lib/utils";
import { fetchProductByBarcode } from "../products/api";
import { type PickedProduct, ProductPicker } from "../products/product-picker";
import { CameraScanButton } from "../scanner/camera-scanner";

/*
 * Stock count: walk the shelves, scan each item (or type the quantity),
 * then apply. Products not counted keep their stock. The count in
 * progress is kept on this device until it is applied or cleared.
 */

type Line = {
  id: string;
  name: string;
  barcode: string;
  unit: string;
  expected: number;
  /** Text typed in the field (kept as typed, e.g. "1,5"). */
  counted: string;
};

const KEY = "mizan.stock-count";

function load(): Line[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Line[]) : [];
  } catch {
    return [];
  }
}

const parse = (v: string) => Number(v.replace(",", ".").trim());

export function StockCountScreen() {
  const t = useTranslations("stockCount");
  const tc = useTranslations("common");
  const money = useMoney();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [lines, setLines] = useState<Line[]>(() => (typeof window === "undefined" ? [] : load()));
  const [code, setCode] = useState("");
  const [looking, setLooking] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      /* storage unavailable */
    }
  }, [lines]);

  const valid = (l: Line) => {
    if (l.counted.trim() === "") return false;
    const n = parse(l.counted);
    return (
      Number.isFinite(n) &&
      n >= 0 &&
      (isMeasured(l.unit) ? hasAtMost3Decimals(n) : Number.isInteger(n))
    );
  };

  /** A scanned product: +1 for pieces, ready to type for weighed ones. */
  const count = (p: Pick<PickedProduct, "id" | "name" | "barcode" | "unit" | "stock" | "kind">) => {
    if (p.kind === "service") {
      toast.error(t("serviceNoStock", { name: p.name }));
      return;
    }
    navigator.vibrate?.(40);
    setLines((all) => {
      const existing = all.find((l) => l.id === p.id);
      if (existing) {
        if (isMeasured(existing.unit)) return all;
        const next = String(
          (Number.isFinite(parse(existing.counted)) ? parse(existing.counted) : 0) + 1,
        );
        // Move it to the top so the last scanned item is in view.
        return [{ ...existing, counted: next }, ...all.filter((l) => l.id !== p.id)];
      }
      return [
        {
          id: p.id,
          name: p.name,
          barcode: p.barcode,
          unit: p.unit,
          expected: p.stock,
          counted: isMeasured(p.unit) ? "" : "1",
        },
        ...all,
      ];
    });
  };

  const lookUp = async (value: string) => {
    const barcode = value.trim();
    if (!barcode) return;
    setLooking(true);
    try {
      count(await fetchProductByBarcode(barcode));
      setCode("");
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.code === "NOT_FOUND"
          ? t("notFound", { code: barcode })
          : errorMessage(err),
      );
    } finally {
      setLooking(false);
      inputRef.current?.focus();
    }
  };

  const apply = useMutation({
    mutationFn: () =>
      unwrap(
        api.stock.count.$post({
          json: {
            items: lines.map((l) => ({ productId: l.id, counted: round3(parse(l.counted)) })),
          },
        }),
      ),
    onSuccess: (result) => {
      toast.success(t("applied", { count: result.adjusted, value: money.format(result.value) }));
      setLines([]);
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const ready = lines.length > 0 && lines.every(valid);
  const differences = lines.filter((l) => valid(l) && round3(parse(l.counted) - l.expected) !== 0);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="grid min-w-0 content-start gap-4">
          <form
            className="relative"
            onSubmit={(e) => {
              e.preventDefault();
              void lookUp(code);
            }}
          >
            <ScanBarcode className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2" />
            <Input
              ref={inputRef}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t("scanPlaceholder")}
              aria-label={t("scanPlaceholder")}
              className="h-12 ps-11 pe-12 text-base"
            />
            <div className="absolute end-1.5 top-1/2 -translate-y-1/2">
              {looking ? (
                <Loader2 className="text-muted-foreground me-2 size-5 animate-spin" />
              ) : (
                <CameraScanButton onScan={(c) => void lookUp(c)} />
              )}
            </div>
          </form>
          <ProductPicker stockedOnly placeholder={t("searchPlaceholder")} onPick={count} />

          {lines.length === 0 ? (
            <Card>
              <CardContent className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-center text-sm">
                <ClipboardCheck className="size-8" />
                {t("empty")}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="divide-y p-0">
                {lines.map((l) => {
                  const ok = valid(l);
                  const diff = ok ? round3(parse(l.counted) - l.expected) : null;
                  return (
                    <div key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{l.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {t("expected", { amount: formatWithUnit(l.expected, l.unit) })}
                        </p>
                      </div>
                      <Input
                        inputMode="decimal"
                        aria-label={t("countedFor", { name: l.name })}
                        aria-invalid={!ok || undefined}
                        className="h-9 w-24 text-center tabular-nums"
                        value={l.counted}
                        onChange={(e) =>
                          setLines((all) =>
                            all.map((x) => (x.id === l.id ? { ...x, counted: e.target.value } : x)),
                          )
                        }
                      />
                      <span
                        className={cn(
                          "w-16 text-end text-sm font-semibold tabular-nums",
                          diff === null
                            ? "text-muted-foreground"
                            : diff < 0
                              ? "text-destructive"
                              : diff > 0
                                ? "text-success"
                                : "text-muted-foreground",
                        )}
                      >
                        {diff === null
                          ? "—"
                          : diff > 0
                            ? `+${formatQuantity(diff)}`
                            : formatQuantity(diff)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={tc("delete")}
                        onClick={() => setLines((all) => all.filter((x) => x.id !== l.id))}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="lg:sticky lg:top-20 lg:self-start">
          <CardContent className="grid gap-3 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("countedProducts")}</span>
              <span className="font-semibold tabular-nums">{lines.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("withDifference")}</span>
              <span className="font-semibold tabular-nums">{differences.length}</span>
            </div>
            <p className="text-muted-foreground text-xs">{t("applyHint")}</p>
            <ConfirmDialog
              title={t("applyTitle")}
              description={t("applyConfirm", { count: differences.length })}
              confirmLabel={t("apply")}
              onConfirm={() => apply.mutate()}
              trigger={
                <Button size="lg" disabled={!ready || apply.isPending}>
                  {apply.isPending && <Loader2 className="animate-spin" />}
                  {t("apply")}
                </Button>
              }
            />
            {lines.length > 0 && (
              <ConfirmDialog
                description={t("clearConfirm")}
                confirmLabel={t("clear")}
                destructive
                onConfirm={() => setLines([])}
                trigger={
                  <Button variant="ghost" className="text-destructive">
                    {t("clear")}
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
