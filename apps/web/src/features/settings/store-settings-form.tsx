"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useErrorMessage } from "@/hooks/use-error-message";
import type { StoreSettings } from "@/hooks/use-settings";
import { api, unwrap } from "@/lib/api-client";

const schema = z.object({
  name: z.string().trim().min(1, "required").max(120),
  address: z.string().trim().max(300),
  phone: z.string().trim().max(40),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, "invalid_currency"),
  receiptFooter: z.string().trim().max(300),
  requireShift: z.boolean(),
  stockAlertDays: z.coerce.number().int().min(1, "range_1_90").max(90, "range_1_90"),
  reorderCoverDays: z.coerce.number().int().min(1, "range_1_180").max(180, "range_1_180"),
});

type Values = z.output<typeof schema>;

export function StoreSettingsForm({ settings }: { settings: StoreSettings }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();

  const form = useForm<z.input<typeof schema>, unknown, Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: settings.name,
      address: settings.address ?? "",
      phone: settings.phone ?? "",
      currency: settings.currency,
      receiptFooter: settings.receiptFooter ?? "",
      requireShift: settings.requireShift,
      stockAlertDays: settings.stockAlertDays,
      reorderCoverDays: settings.reorderCoverDays,
    },
  });

  const mutation = useMutation({
    mutationFn: (v: Values) =>
      unwrap(
        api.settings.$put({
          json: {
            name: v.name,
            currency: v.currency.toUpperCase(),
            address: v.address || null,
            phone: v.phone || null,
            receiptFooter: v.receiptFooter || null,
            requireShift: v.requireShift,
            stockAlertDays: v.stockAlertDays,
            reorderCoverDays: v.reorderCoverDays,
          },
        }),
      ),
    onSuccess: (data) => {
      qc.setQueryData(["settings"], data);
      qc.invalidateQueries({ queryKey: ["me"] });
      form.reset(form.getValues());
      toast.success(tc("saved"));
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const text = (
    name: "name" | "address" | "phone",
    label: string,
    props: React.ComponentProps<"input"> = {},
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input {...props} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("store")}</CardTitle>
        <CardDescription>{t("storeDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
            className="grid max-w-2xl gap-4"
          >
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              {text("name", t("storeName"))}
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("currency")}</FormLabel>
                    <FormControl>
                      <Input maxLength={3} className="uppercase" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormDescription className="-mt-2">{t("currencyHint")}</FormDescription>
            <div className="grid gap-4 sm:grid-cols-2">
              {text("address", t("address"))}
              {text("phone", t("phone"), { type: "tel", dir: "ltr" })}
            </div>
            <FormField
              control={form.control}
              name="receiptFooter"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("receiptFooter")}</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="requireShift"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between gap-4 rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>{t("requireShift")}</FormLabel>
                    <FormDescription>{t("requireShiftHint")}</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <fieldset className="grid gap-3 rounded-lg border p-3">
              <legend className="px-1 text-sm font-medium">{t("stockAlerts")}</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                {(["stockAlertDays", "reorderCoverDays"] as const).map((name) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t(name)}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            className="w-28"
                            {...field}
                            value={field.value as number}
                          />
                        </FormControl>
                        <FormDescription>{t(`${name}Hint`)}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </fieldset>
            <div>
              <Button type="submit" disabled={mutation.isPending || !form.formState.isDirty}>
                {mutation.isPending && <Loader2 className="animate-spin" />}
                {tc("save")}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
