import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { MizanLogo } from "@/components/brand/logo";
import { LandingPage } from "@/features/landing/landing-page";
import { routing, type Locale } from "@/i18n/routing";

/*
 * Public home page of the cloud deployment. The proxy only lets signed-out
 * visitors of a cloud deployment reach it (see src/proxy.ts).
 */

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "landing.meta" });
  return {
    title: { absolute: t("title") },
    description: t("description"),
    alternates: {
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])),
    },
    openGraph: { title: t("title"), description: t("description"), type: "website" },
  };
}

/** Prices, trial length and contacts come from the platform console. */
async function LandingWithSettings({ locale }: { locale: Locale }) {
  // Read at request time: the settings change without a new deployment,
  // and no database is needed while building.
  await connection();
  const { db } = await import("@/server/db");
  const { getPlatformSettings } = await import("@/server/platform/settings");
  return <LandingPage locale={locale} settings={await getPlatformSettings(db)} />;
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <MizanLogo size={40} />
        </div>
      }
    >
      <LandingWithSettings locale={locale} />
    </Suspense>
  );
}
