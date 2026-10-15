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
import { authClient } from "@/lib/auth-client";
import { useAppInfo } from "@/hooks/use-me";
import { Link, useRouter } from "@/i18n/navigation";

/** Second step of the sign-in for accounts with two-factor authentication. */
function TwoFactorStep({
  onDone,
  onBack,
}: {
  onDone: (role: string | undefined) => void;
  onBack: () => void;
}) {
  const t = useTranslations("auth");
  const [useBackup, setUseBackup] = useState(false);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const value = code.trim();
    const { data, error } = useBackup
      ? await authClient.twoFactor.verifyBackupCode({ code: value })
      : await authClient.twoFactor.verifyTotp({ code: value });
    setPending(false);
    if (error || !data) {
      setError(
        t(
          error?.status === 429 || error?.code === "TOO_MANY_ATTEMPTS"
            ? "tooManyAttempts"
            : "invalidCode",
        ),
      );
      return;
    }
    onDone((data as { user?: { role?: string } }).user?.role);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("twoFactorTitle")}</CardTitle>
        <CardDescription>
          {useBackup ? t("twoFactorBackupDescription") : t("twoFactorDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4">
          <Input
            aria-label={t("code")}
            value={code}
            onChange={(e) =>
              setCode(useBackup ? e.target.value : e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            inputMode={useBackup ? "text" : "numeric"}
            autoComplete="one-time-code"
            autoFocus
            dir="ltr"
            className="h-12 text-center font-mono text-lg tracking-[0.3em]"
          />
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <Button
            type="submit"
            size="lg"
            disabled={pending || (useBackup ? code.trim().length < 6 : code.length !== 6)}
          >
            {pending && <Loader2 className="animate-spin" />}
            {t("verify")}
          </Button>
          <div className="flex justify-between text-sm">
            <button
              type="button"
              className="text-muted-foreground hover:underline"
              onClick={onBack}
            >
              {t("back")}
            </button>
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => {
                setUseBackup(!useBackup);
                setCode("");
                setError(null);
              }}
            >
              {useBackup ? t("useAuthenticator") : t("useBackupCode")}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

const schema = z.object({
  username: z.string().trim().min(1, "required"),
  password: z.string().min(1, "required"),
});

export function LoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const params = useSearchParams();
  const info = useAppInfo();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "" },
  });

  useEffect(() => {
    if (info.data?.needsSetup) router.replace("/setup");
  }, [info.data, router]);

  const [twoFactor, setTwoFactor] = useState(false);

  const goHome = (role: string | undefined) => {
    const next = params.get("next");
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
    const home = role === "platform" ? "/platform" : role === "admin" ? "/dashboard" : "/pos";
    router.replace(safeNext ?? home);
  };

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
    // Accounts with an authenticator app confirm with a code first.
    if ("twoFactorRedirect" in data && data.twoFactorRedirect) {
      setTwoFactor(true);
      return;
    }
    goHome((data as { user?: { role?: string } }).user?.role);
  });

  if (twoFactor) {
    return <TwoFactorStep onDone={goHome} onBack={() => setTwoFactor(false)} />;
  }

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
        {info.data?.signupEnabled && (
          <p className="text-muted-foreground mt-4 text-center text-sm">
            {t("noAccount")}{" "}
            <Link href="/signup" className="text-primary font-medium hover:underline">
              {t("signupLink")}
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
