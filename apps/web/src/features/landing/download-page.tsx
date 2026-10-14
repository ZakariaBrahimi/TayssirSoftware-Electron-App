import {
  ArrowLeft,
  CheckCircle2,
  CloudOff,
  Download,
  Globe,
  MonitorDown,
  RefreshCw,
  ShieldAlert,
  Store,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { MizanLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { DESKTOP_RELEASES_URL, type PlatformSettings } from "@/server/platform/settings";

const container = "mx-auto w-full max-w-5xl px-4 sm:px-6";

/** Mock of the Windows warning, so people recognise it and know where to click. */
function SmartScreenMock({ title, more, run }: { title: string; more: string; run: string }) {
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-md border bg-[#0b4e9a] text-start text-white shadow-sm"
    >
      <div className="grid gap-2 p-4">
        <p className="text-lg font-light">{title}</p>
        <p className="text-xs opacity-90">
          <bdi dir="ltr">Microsoft Defender SmartScreen…</bdi>
        </p>
        <p className="text-brass text-xs font-semibold underline">{more}</p>
      </div>
      <div className="flex justify-end gap-2 bg-[#093f7d] px-4 py-2">
        <span className="ring-brass rounded-sm border border-white/60 px-3 py-1 text-xs ring-2">
          {run}
        </span>
      </div>
    </div>
  );
}

export async function DownloadPage({
  locale,
  settings,
}: {
  locale: Locale;
  settings: PlatformSettings;
}) {
  const t = await getTranslations({ locale, namespace: "download" });
  const steps = [
    { key: "s1", icon: Download },
    { key: "s2", icon: ShieldAlert },
    { key: "s3", icon: MonitorDown },
    { key: "s4", icon: Store },
  ] as const;

  return (
    <div className="bg-background text-foreground min-h-dvh">
      <header className="border-b">
        <div className={cn(container, "flex h-16 items-center gap-4")}>
          <Link href="/" aria-label="Mizan">
            <MizanLogo size={32} />
          </Link>
          <Button asChild variant="ghost" size="sm" className="ms-auto">
            <Link href="/">
              <ArrowLeft className="rtl:rotate-180" />
              {t("back")}
            </Link>
          </Button>
        </div>
      </header>

      <main className={cn(container, "grid gap-14 py-12 sm:py-16")}>
        {/* Download */}
        <section className="grid items-center gap-10 md:grid-cols-[3fr_2fr]">
          <div className="grid gap-5">
            <span className="text-primary text-sm font-medium">{t("eyebrow")}</span>
            <h1 className="font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              {t("title")}
            </h1>
            <p className="text-muted-foreground text-lg">{t("subtitle")}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-12 px-6 text-base">
                <a href={settings.downloadUrl} rel="noopener">
                  <Download />
                  {t("cta")}
                </a>
              </Button>
              <span className="text-muted-foreground text-sm">{t("requirements")}</span>
            </div>
            <ul className="text-muted-foreground grid gap-2 text-sm sm:grid-cols-2">
              {(["b1", "b2", "b3", "b4"] as const).map((b) => (
                <li key={b} className="flex gap-2">
                  <CheckCircle2 className="text-primary mt-0.5 size-4 shrink-0" />
                  {t(b)}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-card grid gap-4 rounded-2xl border p-6">
            <div className="flex items-center gap-3">
              <CloudOff className="text-primary size-5" />
              <p className="font-medium">{t("offlineTitle")}</p>
            </div>
            <p className="text-muted-foreground text-sm">{t("offlineBody")}</p>
            <div className="flex items-center gap-3">
              <RefreshCw className="text-primary size-5" />
              <p className="font-medium">{t("updatesTitle")}</p>
            </div>
            <p className="text-muted-foreground text-sm">{t("updatesBody")}</p>
          </div>
        </section>

        {/* Install steps */}
        <section className="grid gap-6">
          <h2 className="font-display text-2xl font-semibold">{t("stepsTitle")}</h2>
          <ol className="grid gap-4 md:grid-cols-2">
            {steps.map(({ key, icon: Icon }, i) => (
              <li key={key} className="bg-card grid content-start gap-3 rounded-xl border p-5">
                <div className="flex items-center gap-3">
                  <span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-full text-sm font-semibold">
                    {i + 1}
                  </span>
                  <Icon className="text-primary size-5" />
                  <h3 className="font-medium">{t(`${key}Title`)}</h3>
                </div>
                <p className="text-muted-foreground text-sm">
                  {t.rich(`${key}Body`, {
                    file: (chunks) => (
                      <code dir="ltr" className="text-foreground font-mono whitespace-nowrap">
                        {chunks}
                      </code>
                    ),
                  })}
                </p>
                {key === "s2" && (
                  <SmartScreenMock
                    title={t("smartTitle")}
                    more={t("moreInfo")}
                    run={t("runAnyway")}
                  />
                )}
              </li>
            ))}
          </ol>
        </section>

        {/* Alternatives and help */}
        <section className="grid gap-4 md:grid-cols-2">
          <div className="grid content-start gap-3 rounded-xl border p-5">
            <div className="flex items-center gap-3">
              <Globe className="text-primary size-5" />
              <h3 className="font-medium">{t("onlineTitle")}</h3>
            </div>
            <p className="text-muted-foreground text-sm">{t("onlineBody")}</p>
            <Button asChild variant="outline" className="justify-self-start">
              <Link href="/signup">{t("onlineCta")}</Link>
            </Button>
          </div>
          <div className="grid content-start gap-3 rounded-xl border p-5">
            <h3 className="font-medium">{t("otherTitle")}</h3>
            <p className="text-muted-foreground text-sm">{t("otherBody")}</p>
            <Button asChild variant="outline" className="justify-self-start">
              <a href={DESKTOP_RELEASES_URL} rel="noopener">
                {t("otherCta")}
              </a>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
