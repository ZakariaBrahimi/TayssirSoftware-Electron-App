"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useMoney } from "@/hooks/use-settings";

const schema = z.object({
  name: z.string().trim().min(1, "required").max(120),
  phone: z.string().trim().max(40),
  email: z
    .string()
    .trim()
    .max(120)
    .refine((v) => v === "" || z.email().safeParse(v).success, "invalid_email"),
  address: z.string().trim().max(300),
  notes: z.string().trim().max(1000),
  creditLimit: z
    .string()
    .trim()
    .refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0), "must_be_positive"),
});
type Values = z.infer<typeof schema>;

export type PartyValues = {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  creditLimit?: number | null;
};

/** Create/edit form shared by customers and suppliers. */
export function PartyFormDialog({
  open,
  onOpenChange,
  title,
  initial,
  withCreditLimit,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initial?: Partial<PartyValues>;
  withCreditLimit?: boolean;
  isPending: boolean;
  onSubmit: (values: PartyValues) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {open && (
          <PartyForm
            initial={initial}
            withCreditLimit={withCreditLimit}
            isPending={isPending}
            onCancel={() => onOpenChange(false)}
            onSubmit={onSubmit}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PartyForm({
  initial,
  withCreditLimit,
  isPending,
  onCancel,
  onSubmit,
}: {
  initial?: Partial<PartyValues>;
  withCreditLimit?: boolean;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (values: PartyValues) => void;
}) {
  const t = useTranslations("common");
  const tc = useTranslations("customers");
  const money = useMoney();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      phone: initial?.phone ?? "",
      email: initial?.email ?? "",
      address: initial?.address ?? "",
      notes: initial?.notes ?? "",
      creditLimit:
        initial?.creditLimit === null || initial?.creditLimit === undefined
          ? ""
          : String(money.toMajor(initial.creditLimit)),
    },
  });

  const submit = form.handleSubmit((v) =>
    onSubmit({
      name: v.name,
      phone: v.phone || null,
      email: v.email || null,
      address: v.address || null,
      notes: v.notes || null,
      ...(withCreditLimit
        ? { creditLimit: v.creditLimit === "" ? null : money.toMinor(Number(v.creditLimit)) }
        : {}),
    }),
  );

  const text = (
    name: "name" | "phone" | "email" | "address",
    props: React.ComponentProps<"input"> = {},
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t(name)}</FormLabel>
          <FormControl>
            <Input {...props} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Form {...form}>
      <form onSubmit={submit} className="grid gap-4">
        {text("name", { autoFocus: true })}
        <div className="grid gap-4 sm:grid-cols-2">
          {text("phone", { type: "tel", dir: "ltr" })}
          {text("email", { type: "email", dir: "ltr" })}
        </div>
        {text("address")}
        {withCreditLimit && (
          <FormField
            control={form.control}
            name="creditLimit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {tc("creditLimit")} ({money.currency})
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    placeholder={tc("noLimit")}
                    {...field}
                  />
                </FormControl>
                <FormDescription>{tc("creditLimitHint")}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("notes")}</FormLabel>
              <FormControl>
                <Textarea rows={2} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="animate-spin" />}
            {t("save")}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
