"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Boxes, Loader2, Package, Printer, Trash2, Wand2, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Barcode } from "@/components/barcode";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useMoney, useSettings } from "@/hooks/use-settings";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api-client";
import {
  formatWithUnit,
  hasAtMost3Decimals,
  isMeasured,
  UNIT_SYMBOLS,
  UNITS,
  type Unit,
} from "@/lib/quantity";
import { cn } from "@/lib/utils";
import { PRODUCT_KINDS, type ProductKind } from "@/lib/validators";
import { CatalogSelect } from "../catalog/catalog-select";
import { generateBarcode, isBarcodeAvailable, type Product, useProductMutations } from "./api";
import { CameraScanButton } from "../scanner/camera-scanner";
import { BarcodeTags } from "./barcode-tags";
import { PrintLabelsDialog } from "./labels";
import { StockAdjustDialog } from "./stock-dialog";
import { StockHistory } from "./stock-history";

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

const amount = z.preprocess(
  emptyToUndefined,
  z.coerce.number({ message: "required" }).min(0, "must_be_positive").max(1_000_000_000),
);

const schema = z
  .object({
    name: z.string().trim().min(1, "required").max(120),
    barcode: z
      .string()
      .trim()
      .min(1, "required")
      .max(64)
      .regex(/^[A-Za-z0-9\-_.]+$/, "invalid_barcode"),
    extraBarcodes: z.array(z.string()),
    description: z.string().trim().max(1000).optional(),
    costPrice: amount,
    salePrice: amount,
    stock: z.preprocess(
      emptyToUndefined,
      z.coerce.number({ message: "required" }).min(0, "must_be_positive"),
    ),
    lowStockThreshold: z.preprocess(
      emptyToUndefined,
      z.coerce.number({ message: "required" }).min(0, "must_be_positive"),
    ),
    unit: z.enum(UNITS),
    kind: z.enum(PRODUCT_KINDS),
    openPrice: z.boolean(),
    scaleCode: z
      .string()
      .trim()
      .regex(/^(\d{1,5})?$/, "invalid_scale_code"),
    /** Empty: the store's VAT rate. */
    taxRate: z
      .string()
      .trim()
      .regex(/^(\d{1,3}([.,]\d{1,2})?)?$/, "invalid_rate")
      .refine((v) => !v || Number(v.replace(",", ".")) <= 100, "invalid_rate"),
    categoryId: z.string().nullable(),
    brandId: z.string().nullable(),
    isActive: z.boolean(),
  })
  // An open price is only a suggestion.
  .refine((v) => v.openPrice || v.salePrice >= v.costPrice, {
    message: "price_below_cost",
    path: ["salePrice"],
  })
  // Pieces are counted whole; weights and lengths take up to 3 decimals.
  .superRefine((v, ctx) => {
    for (const key of ["stock", "lowStockThreshold"] as const) {
      const ok = isMeasured(v.unit) ? hasAtMost3Decimals(v[key]) : Number.isInteger(v[key]);
      if (!ok) ctx.addIssue({ code: "custom", message: "invalid_type", path: [key] });
    }
  });

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

export function ProductForm({ product }: { product?: Product }) {
  const t = useTranslations("products");
  const tc = useTranslations("common");
  const money = useMoney();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const { create, update, remove } = useProductMutations();
  const [generating, setGenerating] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const isEdit = Boolean(product);

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: product?.name ?? "",
      barcode: product?.barcode ?? "",
      extraBarcodes: product?.extraBarcodes ?? [],
      description: product?.description ?? "",
      costPrice: product ? money.toMajor(product.costPrice) : "",
      salePrice: product ? money.toMajor(product.salePrice) : "",
      stock: product?.stock ?? 0,
      lowStockThreshold: product?.lowStockThreshold ?? 5,
      unit: (product?.unit as Unit | undefined) ?? "piece",
      kind: (product?.kind as ProductKind | undefined) ?? "product",
      openPrice: product?.openPrice ?? false,
      scaleCode: product?.scaleCode ?? "",
      taxRate: product?.taxRate == null ? "" : String(product.taxRate),
      categoryId: product?.categoryId ?? null,
      brandId: product?.brandId ?? null,
      isActive: product?.isActive ?? true,
    },
  });

  const [barcode, cost, price, name, unit, taxRateText, kind] = useWatch({
    control: form.control,
    name: ["barcode", "costPrice", "salePrice", "name", "unit", "taxRate", "kind"],
  });
  const service = kind === "service";
  const store = useSettings().data;
  const taxOn = Boolean(store?.taxEnabled);
  const rate = taxOn
    ? taxRateText
      ? Number(taxRateText.replace(",", ".")) || 0
      : (store?.taxRate ?? 0)
    : 0;
  const measured = isMeasured(unit);
  const perUnit = measured ? ` / ${UNIT_SYMBOLS[unit]}` : "";
  const amountProps = measured
    ? ({ inputMode: "decimal", step: "any" } as const)
    : ({ inputMode: "numeric", step: 1 } as const);
  const costN = Number(cost) || 0;
  // With VAT, the margin is on the price before VAT.
  const priceN = (Number(price) || 0) / (1 + rate / 100);
  const margin = priceN > 0 ? ((priceN - costN) / priceN) * 100 : null;

  const onGenerate = async () => {
    setGenerating(true);
    try {
      form.setValue("barcode", await generateBarcode(), {
        shouldValidate: true,
        shouldDirty: true,
      });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  const checkBarcode = async () => {
    const value = form.getValues("barcode")?.trim();
    if (!value || value === product?.barcode) return;
    try {
      if (!(await isBarcodeAvailable(value, product?.id))) {
        form.setError("barcode", { message: "barcodeTaken" });
      }
    } catch {
      /* the server re-validates on save */
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const payload = {
      name: values.name,
      barcode: values.barcode,
      extraBarcodes: values.extraBarcodes,
      description: values.description || null,
      costPrice: money.toMinor(values.costPrice),
      salePrice: money.toMinor(values.salePrice),
      lowStockThreshold: values.lowStockThreshold,
      unit: values.unit,
      kind: values.kind,
      openPrice: values.openPrice,
      scaleCode: values.scaleCode || null,
      taxRate: values.taxRate ? Number(values.taxRate.replace(",", ".")) : null,
      categoryId: values.categoryId,
      brandId: values.brandId,
      isActive: values.isActive,
    };
    try {
      if (product) {
        await update.mutateAsync({ id: product.id, json: payload });
        toast.success(t("updated"));
      } else {
        await create.mutateAsync({
          ...payload,
          stock: values.kind === "service" ? 0 : values.stock,
        });
        toast.success(t("created"));
      }
      router.push("/products");
    } catch (err) {
      if (err instanceof ApiError && err.code === "BARCODE_TAKEN" && err.details?.barcode) {
        form.setError("extraBarcodes", {
          message: t("otherBarcodeTaken", { code: String(err.details.barcode) }),
        });
      } else if (err instanceof ApiError && err.code === "BARCODE_TAKEN") {
        form.setError("barcode", { message: "barcodeTaken" });
      } else if (err instanceof ApiError && err.details?.reason === "price_below_cost") {
        form.setError("salePrice", { message: "price_below_cost" });
      }
      toast.error(errorMessage(err));
    }
  });

  const barcodeError = form.formState.errors.barcode?.message === "barcodeTaken";

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("details")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("name")}</FormLabel>
                    <FormControl>
                      <Input autoFocus={!isEdit} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="barcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("barcode")}</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input
                          dir="ltr"
                          className="font-mono"
                          {...field}
                          onBlur={() => {
                            field.onBlur();
                            void checkBarcode();
                          }}
                          onKeyDown={(e) => {
                            // Barcode scanners send Enter after the code.
                            if (e.key === "Enter") e.preventDefault();
                          }}
                        />
                      </FormControl>
                      <CameraScanButton
                        className="border"
                        onScan={(code) =>
                          form.setValue("barcode", code, {
                            shouldValidate: true,
                            shouldDirty: true,
                          })
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={onGenerate}
                        disabled={generating}
                      >
                        {generating ? <Loader2 className="animate-spin" /> : <Wand2 />}
                        {t("generateBarcode")}
                      </Button>
                    </div>
                    {barcodeError ? (
                      <p className="text-destructive text-sm">{t("barcodeTaken")}</p>
                    ) : (
                      <>
                        <FormDescription>{t("barcodeHint")}</FormDescription>
                        <FormMessage />
                      </>
                    )}
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="extraBarcodes"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>
                      {t("otherBarcodes")}{" "}
                      <span className="text-muted-foreground font-normal">({tc("optional")})</span>
                    </FormLabel>
                    <BarcodeTags
                      id="extra-barcodes"
                      value={field.value}
                      main={String(barcode || "")}
                      onChange={(v) => {
                        field.onChange(v);
                        form.clearErrors("extraBarcodes");
                      }}
                    />
                    {fieldState.error?.message ? (
                      <p className="text-destructive text-sm">{fieldState.error.message}</p>
                    ) : (
                      <FormDescription>{t("otherBarcodesHint")}</FormDescription>
                    )}
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("kind")}</FormLabel>
                    <div
                      role="radiogroup"
                      aria-label={t("kind")}
                      className="grid gap-2 sm:grid-cols-2"
                    >
                      {PRODUCT_KINDS.map((k) => (
                        <button
                          key={k}
                          type="button"
                          role="radio"
                          aria-checked={field.value === k}
                          onClick={() => field.onChange(k)}
                          className={cn(
                            "hover:bg-accent flex items-start gap-3 rounded-lg border p-3 text-start transition-colors",
                            field.value === k && "border-primary bg-primary/5 ring-primary ring-1",
                          )}
                        >
                          {k === "service" ? (
                            <Wrench className="text-muted-foreground mt-0.5 size-4" />
                          ) : (
                            <Package className="text-muted-foreground mt-0.5 size-4" />
                          )}
                          <span className="grid gap-0.5">
                            <span className="text-sm font-medium">{t(`kind_${k}`)}</span>
                            <span className="text-muted-foreground text-xs">
                              {t(`kind_${k}Hint`)}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("category")}</FormLabel>
                      <CatalogSelect
                        kind="categories"
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="brandId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("brand")}</FormLabel>
                      <CatalogSelect kind="brands" value={field.value} onChange={field.onChange} />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("description")}{" "}
                      <span className="text-muted-foreground font-normal">({tc("optional")})</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("pricing")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem className="sm:col-span-3">
                    <FormLabel>{t("soldBy")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full sm:w-64">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {UNITS.map((u) => (
                          <SelectItem key={u} value={u}>
                            {t(`unit_${u}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isEdit && field.value !== product?.unit && (
                      <FormDescription>{t("unitChangeHint")}</FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              {(["costPrice", "salePrice"] as const).map((name) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t(name)} ({money.currency}
                        {perUnit})
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min={0}
                          {...field}
                          value={field.value as string | number}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              {taxOn && (
                <FormField
                  control={form.control}
                  name="taxRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("vatRate")}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            inputMode="decimal"
                            className="pe-8"
                            placeholder={String(store?.taxRate ?? "")}
                            {...field}
                          />
                          <span className="text-muted-foreground pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm">
                            %
                          </span>
                        </div>
                      </FormControl>
                      <FormDescription>
                        {t("vatRateHint", { rate: store?.taxRate ?? 0 })}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="openPrice"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between gap-4 rounded-lg border p-3 sm:col-span-3">
                    <div className="space-y-0.5">
                      <FormLabel>{t("openPrice")}</FormLabel>
                      <FormDescription>{t("openPriceHint")}</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="grid gap-2">
                <span className="text-sm font-medium">{t("margin")}</span>
                <div className="bg-muted flex h-9 items-center rounded-md px-3 text-sm tabular-nums">
                  {margin === null ? "—" : `${margin.toFixed(1)} %`}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("inventory")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {service ? (
                <p className="text-muted-foreground text-sm sm:col-span-2">{t("serviceNoStock")}</p>
              ) : isEdit ? (
                <div className="grid gap-2">
                  <span className="text-sm font-medium">{t("stock")}</span>
                  <div className="flex items-center gap-2">
                    <div className="bg-muted flex h-9 flex-1 items-center rounded-md px-3 text-sm tabular-nums">
                      {product ? formatWithUnit(product.stock, product.unit) : null}
                    </div>
                    <Button type="button" variant="outline" onClick={() => setStockOpen(true)}>
                      <Boxes />
                      {t("adjustStock")}
                    </Button>
                  </div>
                </div>
              ) : (
                <FormField
                  control={form.control}
                  name="stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("initialStock")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...amountProps}
                          {...field}
                          value={field.value as string | number}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {!service && (
                <FormField
                  control={form.control}
                  name="lowStockThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("lowStockThreshold")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...amountProps}
                          {...field}
                          value={field.value as string | number}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {measured && !service && (
                <FormField
                  control={form.control}
                  name="scaleCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("scaleCode")}</FormLabel>
                      <FormControl>
                        <Input inputMode="numeric" maxLength={5} dir="ltr" {...field} />
                      </FormControl>
                      <FormDescription>{t("scaleCodeHint")}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between gap-4 rounded-lg border p-3 sm:col-span-2">
                    <div className="space-y-0.5">
                      <FormLabel>{t("active")}</FormLabel>
                      <FormDescription>{t("activeHint")}</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {product && !service && <StockHistory productId={product.id} />}
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>{t("barcode")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex min-h-24 items-center justify-center rounded-md border bg-white p-3">
                {barcode ? (
                  <Barcode value={String(barcode)} className="w-full max-w-60" />
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )}
              </div>
              <PrintLabelsDialog
                product={{
                  name: String(name || ""),
                  barcode: String(barcode || ""),
                  salePrice: money.toMinor(Number(price) || 0),
                  unit,
                  categoryName: product?.categoryName,
                  brandName: product?.brandName,
                  familyName: product?.familyName,
                }}
                trigger={
                  <Button type="button" variant="outline" disabled={!barcode}>
                    <Printer />
                    {t("printLabels")}
                  </Button>
                }
              />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
              {isEdit ? tc("save") : tc("create")}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push("/products")}>
              {tc("cancel")}
            </Button>
            {product && (
              <ConfirmDialog
                description={t("deleteConfirm", { name: product.name })}
                confirmLabel={tc("delete")}
                onConfirm={() =>
                  remove.mutate(product.id, {
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
        </div>
      </form>
      {product && (
        <StockAdjustDialog product={product} open={stockOpen} onOpenChange={setStockOpen} />
      )}
    </Form>
  );
}
