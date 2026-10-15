"use client";

import { Boxes, Loader2, Plus, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useMoney } from "@/hooks/use-settings";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api-client";
import { formatWithUnit, hasAtMost3Decimals, isMeasured, UNITS, type Unit } from "@/lib/quantity";
import { cn } from "@/lib/utils";
import type { FamilyInput } from "@/lib/validators";
import { CatalogSelect } from "../catalog/catalog-select";
import { type Family, useFamilyMutations } from "./api";
import { StockAdjustDialog } from "./stock-dialog";

type Option = { name: string; values: string[]; draft: string };

/** One line of the variants table, kept per combination of values. */
type Row = {
  id?: string;
  barcode: string;
  cost: string;
  price: string;
  stock: string;
  threshold: string;
  enabled: boolean;
  currentStock?: number;
};

const MAX_OPTIONS = 3;
const keyOf = (values: string[]) => values.join("\u0000");

/** Every combination of the options' values (Size × Colour...). */
function combinations(options: Option[]): string[][] {
  const used = options.filter((o) => o.values.length > 0);
  if (!used.length || used.length !== options.length) return [];
  return used.reduce<string[][]>(
    (acc, o) => acc.flatMap((prefix) => o.values.map((v) => [...prefix, v])),
    [[]],
  );
}

const num = (v: string) => Number(v.replace(",", "."));

export function FamilyForm({ family }: { family?: Family }) {
  const t = useTranslations("variants");
  const tp = useTranslations("products");
  const tc = useTranslations("common");
  const money = useMoney();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const { create, update, remove } = useFamilyMutations();

  const [name, setName] = useState(family?.name ?? "");
  const [unit, setUnit] = useState<Unit>((family?.unit as Unit | undefined) ?? "piece");
  const [categoryId, setCategoryId] = useState<string | null>(family?.categoryId ?? null);
  const [brandId, setBrandId] = useState<string | null>(family?.brandId ?? null);
  const [options, setOptions] = useState<Option[]>(
    family?.options.map((o) => ({ ...o, draft: "" })) ?? [
      { name: t("presetSize"), values: [], draft: "" },
      { name: t("presetColour"), values: [], draft: "" },
    ],
  );
  const [rows, setRows] = useState<Record<string, Row>>(() => {
    const initial: Record<string, Row> = {};
    if (!family) return initial;
    // Combinations the family doesn't sell yet start switched off.
    for (const values of combinations(family.options.map((o) => ({ ...o, draft: "" })))) {
      initial[keyOf(values)] = {
        barcode: "",
        cost: "",
        price: "",
        stock: "",
        threshold: "5",
        enabled: false,
      };
    }
    for (const v of family.variants) {
      initial[keyOf(v.values)] = {
        id: v.id,
        barcode: v.barcode,
        cost: String(money.toMajor(v.costPrice)),
        price: String(money.toMajor(v.salePrice)),
        stock: "",
        threshold: String(v.lowStockThreshold),
        enabled: true,
        currentStock: v.stock,
      };
    }
    return initial;
  });
  const [all, setAll] = useState({ cost: "", price: "", stock: "", threshold: "5" });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adjusting, setAdjusting] = useState<{ id: string; name: string; stock: number } | null>(
    null,
  );

  const measured = isMeasured(unit);
  const combos = useMemo(() => combinations(options), [options]);
  const emptyRow = (): Row => ({
    barcode: "",
    cost: all.cost,
    price: all.price,
    stock: all.stock,
    threshold: all.threshold || "5",
    enabled: true,
  });
  const rowOf = (values: string[]) => rows[keyOf(values)] ?? emptyRow();
  const setRow = (values: string[], patch: Partial<Row>) =>
    setRows((r) => ({ ...r, [keyOf(values)]: { ...rowOf(values), ...patch } }));

  const amountOk = (v: string, decimals: boolean) => {
    if (v.trim() === "") return false;
    const n = num(v);
    return Number.isFinite(n) && n >= 0 && (decimals ? hasAtMost3Decimals(n) : Number.isInteger(n));
  };
  const rowErrors = (row: Row) => ({
    cost: !amountOk(row.cost, true),
    price: !amountOk(row.price, true) || num(row.price) < num(row.cost),
    stock: !row.id && row.stock.trim() !== "" && !amountOk(row.stock, measured),
    threshold: !amountOk(row.threshold, measured),
    barcode: row.barcode.trim() !== "" && !/^[A-Za-z0-9\-_.]+$/.test(row.barcode.trim()),
  });

  /* --------------------------- options editing --------------------------- */

  const setOption = (i: number, patch: Partial<Option>) =>
    setOptions((o) => o.map((opt, k) => (k === i ? { ...opt, ...patch } : opt)));

  const addValues = (i: number) => {
    const opt = options[i];
    // "S, M, L" adds three values at once.
    const fresh = opt.draft
      .split(/[,،;]/)
      .map((v) => v.trim().slice(0, 30))
      .filter((v) => v && !opt.values.some((x) => x.toLowerCase() === v.toLowerCase()));
    setOption(i, { values: [...opt.values, ...new Set(fresh)], draft: "" });
  };

  const removeOption = (i: number) => setOptions((o) => o.filter((_, k) => k !== i));

  /* ------------------------------- saving -------------------------------- */

  const enabledCombos = combos.filter((values) => rowOf(values).enabled);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const optionNames = options.map((o) => o.name.trim().toLowerCase());
    if (!name.trim()) return toast.error(t("errorName"));
    if (!options.length || options.some((o) => !o.name.trim() || !o.values.length)) {
      return toast.error(t("errorOptions"));
    }
    if (new Set(optionNames).size !== optionNames.length) return toast.error(t("errorOptions"));
    if (!enabledCombos.length) return toast.error(t("errorNoVariant"));
    const invalid = enabledCombos.some((values) =>
      Object.values(rowErrors(rowOf(values))).some(Boolean),
    );
    if (invalid) return toast.error(t("errorRows"));

    const json: FamilyInput = {
      name: name.trim(),
      unit,
      categoryId,
      brandId,
      options: options.map((o) => ({ name: o.name.trim(), values: o.values })),
      variants: enabledCombos.map((values) => {
        const row = rowOf(values);
        return {
          id: row.id,
          values,
          barcode: row.barcode.trim() || null,
          costPrice: money.toMinor(num(row.cost)),
          salePrice: money.toMinor(num(row.price)),
          stock: row.id || row.stock.trim() === "" ? 0 : num(row.stock),
          lowStockThreshold: num(row.threshold),
        };
      }),
    };
    setSaving(true);
    try {
      if (family) {
        await update.mutateAsync({ id: family.id, json });
        toast.success(t("updated"));
      } else {
        await create.mutateAsync(json);
        toast.success(t("created", { count: json.variants.length }));
      }
      router.push("/products");
    } catch (err) {
      if (err instanceof ApiError && err.code === "BARCODE_TAKEN") {
        toast.error(t("barcodeTaken", { barcode: String(err.details?.barcode ?? "") }));
      } else {
        toast.error(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  };

  const removed =
    family?.variants.filter(
      (v) => !rowOf(v.values).enabled || !combos.some((c) => keyOf(c) === keyOf(v.values)),
    ) ?? [];

  return (
    <form onSubmit={onSubmit} className="grid gap-6 xl:grid-cols-[1fr_18rem]">
      <div className="grid min-w-0 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{tp("details")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="family-name">{tp("name")}</Label>
              <Input
                id="family-name"
                autoFocus={!family}
                value={name}
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={submitted && !name.trim()}
                placeholder={t("namePlaceholder")}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label>{tp("category")}</Label>
                <CatalogSelect kind="categories" value={categoryId} onChange={setCategoryId} />
              </div>
              <div className="grid gap-2">
                <Label>{tp("brand")}</Label>
                <CatalogSelect kind="brands" value={brandId} onChange={setBrandId} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="family-unit">{tp("soldBy")}</Label>
                <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
                  <SelectTrigger id="family-unit" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {tp(`unit_${u}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("options")}</CardTitle>
            <CardDescription>{t("optionsHint")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {options.map((opt, i) => (
              <div
                key={i}
                className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[10rem_1fr_auto]"
              >
                <Input
                  aria-label={t("optionName")}
                  value={opt.name}
                  maxLength={30}
                  onChange={(e) => setOption(i, { name: e.target.value })}
                  aria-invalid={submitted && !opt.name.trim()}
                />
                <div className="grid gap-2">
                  {opt.values.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {opt.values.map((v) => (
                        <Badge key={v} variant="secondary" className="gap-1 ps-2 pe-1">
                          {v}
                          <button
                            type="button"
                            className="hover:bg-muted-foreground/20 rounded-sm p-0.5"
                            aria-label={`${tc("delete")} ${v}`}
                            onClick={() =>
                              setOption(i, { values: opt.values.filter((x) => x !== v) })
                            }
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <Input
                    aria-label={`${opt.name || t("optionName")}: ${t("optionValues")}`}
                    value={opt.draft}
                    placeholder={t("valuesPlaceholder")}
                    onChange={(e) => setOption(i, { draft: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addValues(i);
                      }
                    }}
                    onBlur={() => opt.draft.trim() && addValues(i)}
                    aria-invalid={submitted && !opt.values.length}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("removeOption")}
                  disabled={options.length === 1}
                  onClick={() => removeOption(i)}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            {options.length < MAX_OPTIONS && (
              <Button
                type="button"
                variant="outline"
                className="justify-self-start"
                onClick={() => setOptions((o) => [...o, { name: "", values: [], draft: "" }])}
              >
                <Plus />
                {t("addOption")}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("variantsTitle", { count: enabledCombos.length })}</CardTitle>
            <CardDescription>{t("variantsHint")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {combos.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("noVariants")}</p>
            ) : (
              <>
                <div className="bg-muted/40 grid gap-3 rounded-lg p-3 sm:grid-cols-[repeat(4,minmax(0,1fr))_auto] sm:items-end">
                  <AllField
                    label={tp("costPrice")}
                    value={all.cost}
                    onChange={(cost) => setAll((a) => ({ ...a, cost }))}
                  />
                  <AllField
                    label={tp("salePrice")}
                    value={all.price}
                    onChange={(price) => setAll((a) => ({ ...a, price }))}
                  />
                  <AllField
                    label={t("openingStock")}
                    value={all.stock}
                    onChange={(stock) => setAll((a) => ({ ...a, stock }))}
                  />
                  <AllField
                    label={t("alertAt")}
                    value={all.threshold}
                    onChange={(threshold) => setAll((a) => ({ ...a, threshold }))}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      setRows((r) => {
                        const next = { ...r };
                        for (const values of combos) {
                          const row = next[keyOf(values)] ?? emptyRow();
                          next[keyOf(values)] = {
                            ...row,
                            ...(all.cost !== "" && { cost: all.cost }),
                            ...(all.price !== "" && { price: all.price }),
                            ...(all.threshold !== "" && { threshold: all.threshold }),
                            // Opening stock only applies to new variants.
                            ...(all.stock !== "" && !row.id && { stock: all.stock }),
                          };
                        }
                        return next;
                      })
                    }
                  >
                    {t("applyAll")}
                  </Button>
                </div>

                <div className="-mx-6 overflow-x-auto px-6">
                  <table className="w-full min-w-[42rem] text-sm">
                    <thead>
                      <tr className="text-muted-foreground border-b text-start text-xs">
                        <th className="w-10 py-2" />
                        <th className="py-2 text-start font-medium">{t("variant")}</th>
                        <th className="py-2 text-start font-medium">{tp("barcode")}</th>
                        <th className="py-2 text-start font-medium">{tp("costPrice")}</th>
                        <th className="py-2 text-start font-medium">{tp("salePrice")}</th>
                        <th className="py-2 text-start font-medium">{tp("stock")}</th>
                        <th className="py-2 text-start font-medium">{t("alertAt")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {combos.map((values) => {
                        const row = rowOf(values);
                        const err = submitted && row.enabled ? rowErrors(row) : null;
                        const label = values.join(" / ");
                        return (
                          <tr
                            key={keyOf(values)}
                            className={cn("border-b last:border-0", !row.enabled && "opacity-50")}
                          >
                            <td className="py-1.5">
                              <Switch
                                checked={row.enabled}
                                onCheckedChange={(enabled) => setRow(values, { enabled })}
                                aria-label={t("sellVariant", { name: label })}
                              />
                            </td>
                            <td className="py-1.5 pe-2 font-medium whitespace-nowrap">{label}</td>
                            <td className="py-1.5 pe-2">
                              <Input
                                dir="ltr"
                                className="h-8 w-36 font-mono text-xs placeholder:font-sans"
                                value={row.barcode}
                                placeholder={t("barcodeAuto")}
                                disabled={!row.enabled}
                                aria-label={`${label}: ${tp("barcode")}`}
                                aria-invalid={err?.barcode}
                                onChange={(e) => setRow(values, { barcode: e.target.value })}
                                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                              />
                            </td>
                            <td className="py-1.5 pe-2">
                              <CellInput
                                value={row.cost}
                                label={`${label}: ${tp("costPrice")}`}
                                invalid={err?.cost}
                                disabled={!row.enabled}
                                onChange={(cost) => setRow(values, { cost })}
                              />
                            </td>
                            <td className="py-1.5 pe-2">
                              <CellInput
                                value={row.price}
                                label={`${label}: ${tp("salePrice")}`}
                                invalid={err?.price}
                                disabled={!row.enabled}
                                onChange={(price) => setRow(values, { price })}
                              />
                            </td>
                            <td className="py-1.5 pe-2">
                              {row.id ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 tabular-nums"
                                  title={tp("adjustStock")}
                                  onClick={() =>
                                    setAdjusting({
                                      id: row.id!,
                                      name: `${name} — ${label}`,
                                      stock: row.currentStock ?? 0,
                                    })
                                  }
                                >
                                  <Boxes className="size-3.5" />
                                  {formatWithUnit(row.currentStock ?? 0, unit)}
                                </Button>
                              ) : (
                                <CellInput
                                  value={row.stock}
                                  label={`${label}: ${t("openingStock")}`}
                                  invalid={err?.stock}
                                  disabled={!row.enabled}
                                  placeholder="0"
                                  onChange={(stock) => setRow(values, { stock })}
                                />
                              )}
                            </td>
                            <td className="py-1.5">
                              <CellInput
                                value={row.threshold}
                                label={`${label}: ${t("alertAt")}`}
                                invalid={err?.threshold}
                                disabled={!row.enabled}
                                onChange={(threshold) => setRow(values, { threshold })}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {removed.length > 0 && (
              <p className="text-warning text-sm">
                {t("willRemove", { names: removed.map((v) => v.values.join(" / ")).join(", ") })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-2 xl:sticky xl:top-20 xl:self-start">
        <Button type="submit" size="lg" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          {family ? tc("save") : t("createCount", { count: enabledCombos.length })}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/products")}>
          {tc("cancel")}
        </Button>
        {family && (
          <ConfirmDialog
            description={t("deleteConfirm", { name: family.name, count: family.variants.length })}
            confirmLabel={tc("delete")}
            onConfirm={() =>
              remove.mutate(family.id, {
                onSuccess: () => {
                  toast.success(tc("deleted"));
                  router.push("/products");
                },
                onError: (err) => toast.error(errorMessage(err)),
              })
            }
            trigger={
              <Button type="button" variant="ghost" className="text-destructive">
                <Trash2 />
                {tc("delete")}
              </Button>
            }
          />
        )}
      </div>

      {adjusting && (
        <StockAdjustDialog
          product={{ ...adjusting, unit }}
          open
          onOpenChange={(open) => {
            if (!open) setAdjusting(null);
          }}
        />
      )}
    </form>
  );
}

function AllField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        inputMode="decimal"
        className="h-9 tabular-nums"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function CellInput({
  value,
  label,
  invalid,
  disabled,
  placeholder,
  onChange,
}: {
  value: string;
  label: string;
  invalid?: boolean;
  disabled?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      inputMode="decimal"
      className="h-8 w-20 tabular-nums"
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={label}
      aria-invalid={invalid || undefined}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
    />
  );
}
