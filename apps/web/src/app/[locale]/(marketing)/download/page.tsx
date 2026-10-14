import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { MizanLogo } from "@/components/brand/logo";
import { DownloadPage } from "@/features/landing/download-page";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/download">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "download" });
  return { title: { absolute: t("metaTitle") }, description: t("subtitle") };
}

/** The download link comes from the platform console (Website settings). */
async function WithSettings({ locale }: { locale: Locale }) {
  await connection();
  const { db } = await import("@/server/db");
  const { getPlatformSettings } = await import("@/server/platform/settings");
  return <DownloadPage locale={locale} settings={await getPlatformSettings(db)} />;
}

export default async function Page({ params }: PageProps<"/[locale]/download">) {
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
      <WithSettings locale={locale} />
    </Suspense>
  );
}
