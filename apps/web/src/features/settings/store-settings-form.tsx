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
import { Textarea } from "@/components/ui/textarea";
import { useErrorMessage } from "@/hooks/use-error-message";
import type { StoreSettings } from "@/server/services/settings";
import { api, unwrap } from "@/lib/api-client";

const schema = z.object({
  storeName: z.string().trim().min(1, "required").max(120),
  address: z.string().trim().max(300),
  phone: z.string().trim().max(40),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, "invalid_currency"),
  receiptFooter: z.string().trim().max(300),
});

type Values = z.infer<typeof schema>;

export function StoreSettingsForm({ settings }: { settings: Pick<StoreSettings, keyof Values> }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      storeName: settings.storeName,
      address: settings.address ?? "",
      phone: settings.phone ?? "",
      currency: settings.currency,
      receiptFooter: settings.receiptFooter ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (v: Values) =>
      unwrap(
        api.settings.$put({
          json: {
            storeName: v.storeName,
            currency: v.currency.toUpperCase(),
            address: v.address || null,
            phone: v.phone || null,
            receiptFooter: v.receiptFooter || null,
          },
        }),
      ),
    onSuccess: (data) => {
      qc.setQueryData(["settings"], data);
      toast.success(tc("saved"));
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

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
              <FormField
                control={form.control}
                name="storeName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("storeName")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("address")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("phone")}</FormLabel>
                    <FormControl>
                      <Input type="tel" dir="ltr" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
