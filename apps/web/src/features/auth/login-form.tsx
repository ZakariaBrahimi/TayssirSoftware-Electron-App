"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { useSetupStatus } from "./api";

const schema = z.object({
  username: z.string().trim().min(1, "required"),
  password: z.string().min(1, "required"),
});

export function LoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const params = useSearchParams();
  const setup = useSetupStatus();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "" },
  });

  useEffect(() => {
    if (setup.data?.needsSetup) router.replace("/setup");
  }, [setup.data, router]);

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const { data, error } = await authClient.signIn.username({
      username: values.username,
      password: values.password,
    });
    if (error || !data) {
      setError(t("invalidCredentials"));
      return;
    }
    const role = (data.user as { role?: string }).role;
    const next = params.get("next");
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
    router.replace(safeNext ?? (role === "admin" ? "/dashboard" : "/pos"));
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("signInTitle")}</CardTitle>
        <CardDescription>{t("signInDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="grid gap-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("username")}</FormLabel>
                  <FormControl>
                    <Input autoComplete="username" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("password")}</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
              {form.formState.isSubmitting ? t("signingIn") : t("signIn")}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
