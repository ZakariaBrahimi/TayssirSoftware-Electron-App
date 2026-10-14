import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
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

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  return <LandingPage locale={locale} />;
}
