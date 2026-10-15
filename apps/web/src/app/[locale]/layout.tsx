import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Arabic, Readex_Pro } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Providers } from "@/components/providers";
import { loadMessages } from "@/i18n/request";
import { routing, rtlLocales } from "@/i18n/routing";
import "../globals.css";

const sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });
const arabic = Noto_Sans_Arabic({ variable: "--font-arabic", subsets: ["arabic"] });
// Brand face (logo, headings, big totals): drawn for Arabic and Latin together.
const display = Readex_Pro({ variable: "--font-display", subsets: ["latin", "arabic"] });

export const metadata: Metadata = {
  title: { default: "Mizan", template: "%s · Mizan" },
  description: "Point of sale, inventory and sales reporting for your store.",
  applicationName: "Mizan POS",
  appleWebApp: { capable: true, title: "Mizan", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1716" },
  ],
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const messages = await loadMessages(locale);
  const dir = rtlLocales.includes(locale) ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body
        className={`${sans.variable} ${mono.variable} ${arabic.variable} ${display.variable} min-h-dvh font-sans antialiased`}
      >
        <Providers locale={locale} messages={messages} dir={dir}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
