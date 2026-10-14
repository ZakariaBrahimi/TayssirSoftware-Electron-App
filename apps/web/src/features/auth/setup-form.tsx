"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useAppInfo } from "@/hooks/use-me";
import { Link, useRouter } from "@/i18n/navigation";
import { api, unwrap } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { usernameSchema } from "@/lib/validators";

const schema = z
  .object({
    storeName: z.string().trim().min(1, "required"),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/, "invalid_currency"),
    name: z.string().trim().min(1, "required"),
    username: usernameSchema.min(3, "username_too_short"),
    password: z.string().min(6, "password_too_short"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "passwords_mismatch",
    path: ["confirmPassword"],
  });

export function SetupForm({ mode = "setup" }: { mode?: "setup" | "signup" }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const info = useAppInfo();

  useEffect(() => {
    if (!info.data) return;
    if (mode === "setup" && !info.data.needsSetup) router.replace("/login");
    if (mode === "signup" && !info.data.signupEnabled) router.replace("/login");
  }, [info.data, mode, router]);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      storeName: "",
      currency: "DZD",
      name: "",
      username: "",
      password: "",
      confirmPassword: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof schema>) => {
      const json = { ...values, currency: values.currency.toUpperCase() };
      await unwrap(mode === "signup" ? api.signup.$post({ json }) : api.setup.$post({ json }));
      // Sign the new administrator in straight away.
      await authClient.signIn.username({ username: values.username, password: values.password });
    },
    onSuccess: () => {
      toast.success(t("setupDone"));
      router.replace("/dashboard");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const field = (
    name: keyof z.infer<typeof schema>,
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
        <CardTitle className="text-xl">
          {mode === "signup" ? t("signupTitle") : t("setupTitle")}
        </CardTitle>
        <CardDescription>
          {mode === "signup"
            ? t("signupDescription", { days: info.data?.trialDays ?? 14 })
            : t("setupDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
              {field("storeName", t("storeName"), { autoFocus: true })}
              {field("currency", t("currency"), { maxLength: 3, className: "uppercase" })}
            </div>
            {field("name", t("fullName"), { autoComplete: "name" })}
            {field("username", t("username"), { autoComplete: "username" })}
            <div className="grid gap-4 sm:grid-cols-2">
              {field("password", t("password"), { type: "password", autoComplete: "new-password" })}
              {field("confirmPassword", t("confirmPassword"), {
                type: "password",
                autoComplete: "new-password",
              })}
            </div>
            <Button type="submit" size="lg" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="animate-spin" />}
              {mode === "signup" ? t("signupAction") : t("createAccount")}
            </Button>
          </form>
        </Form>
        {mode === "signup" && (
          <p className="text-muted-foreground mt-4 text-center text-sm">
            {t("haveAccount")}{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">
              {t("signInLink")}
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
