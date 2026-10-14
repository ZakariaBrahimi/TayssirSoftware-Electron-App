import {
  ArrowRight,
  BarChart3,
  Check,
  CloudOff,
  Download,
  Boxes,
  Mail,
  MessageCircle,
  Phone,
  RefreshCw,
  DatabaseBackup,
  RotateCcw,
  ScanBarcode,
  ShieldCheck,
  Smartphone,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { MizanLogo, MizanMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { localeNames, routing, type Locale } from "@/i18n/routing";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { PlatformSettings } from "@/server/platform/settings";

const FEATURES: { key: string; icon: LucideIcon }[] = [
  { key: "checkout", icon: ScanBarcode },
  { key: "stock", icon: Boxes },
  { key: "credit", icon: Users },
  { key: "suppliers", icon: Truck },
  { key: "cash", icon: Wallet },
  { key: "reports", icon: BarChart3 },
  { key: "returns", icon: RotateCcw },
  { key: "team", icon: ShieldCheck },
  { key: "data", icon: DatabaseBackup },
];

const STEPS: { key: string; icon: LucideIcon }[] = [
  { key: "sell", icon: CloudOff },
  { key: "sync", icon: RefreshCw },
  { key: "check", icon: Smartphone },
];

const SHOPS = [
  "grocery",
  "bakery",
  "books",
  "hardware",
  "cosmetics",
  "clothing",
  "phones",
  "butcher",
];
const FAQ = ["offline", "hardware", "data", "import", "tills", "languages", "payment"];

const container = "mx-auto w-full max-w-6xl px-4 sm:px-6";

/** Example till shown in the hero (illustration, not real data). */
async function TillMock({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "landing.mock" });
  const money = (minor: number) => formatMoney(minor, "DZD", locale);
  const lines = [
    { name: t("item1"), qty: 2, price: 12000 },
    { name: t("item2"), qty: 1, price: 48000 },
    { name: t("item3"), qty: 4, price: 1500 },
  ];
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0);

  return (
    <div className="relative mx-auto w-full max-w-md sm:mb-20" aria-hidden="true">
      <div className="bg-card relative rounded-2xl border shadow-xl shadow-black/5">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <MizanMark size={24} />
          <span className="font-display text-sm font-semibold">{t("store")}</span>
          <span className="text-muted-foreground ms-auto text-xs">{t("till")}</span>
        </div>
        <div className="grid px-4 py-2">
          {lines.map((l) => (
            <div
              key={l.name}
              className="flex items-baseline justify-between gap-3 border-b border-dashed py-2.5 text-sm last:border-0"
            >
              <span>
                {l.name}
                <span className="text-muted-foreground block text-xs tabular-nums">
                  {l.qty} × {money(l.price)}
                </span>
              </span>
              <span className="tabular-nums">{money(l.qty * l.price)}</span>
            </div>
          ))}
        </div>
        <div className="grid gap-3 border-t px-4 pt-3 pb-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="bg-accent rounded-full px-2.5 py-1">{t("customer")}</span>
            <span className="bg-brass text-brass-foreground rounded-full px-2.5 py-1 font-medium">
              {t("promo")}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground">{t("total")}</span>
            <span className="font-display text-2xl font-semibold tabular-nums">{money(total)}</span>
          </div>
          <div className="bg-primary text-primary-foreground rounded-lg py-3 text-center font-semibold">
            {t("charge")}
          </div>
        </div>
      </div>
      <div className="bg-card absolute end-4 -top-4 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs shadow-md">
        <CloudOff className="text-warning size-3.5" />
        {t("offline")}
      </div>
      <div className="bg-card absolute -start-4 top-full -mt-2 hidden w-48 rounded-xl border p-3 shadow-lg sm:block">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Smartphone className="size-3.5" />
          {t("phoneTitle")}
        </div>
        <div className="font-display mt-1 text-lg font-semibold tabular-nums">{money(3645000)}</div>
        <div className="text-muted-foreground text-xs">{t("phoneSales")}</div>
      </div>
    </div>
  );
}

function SectionHead({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="grid max-w-2xl gap-3">
      <span className="text-primary text-sm font-medium">{eyebrow}</span>
      <h2 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {body && <p className="text-muted-foreground text-lg">{body}</p>}
    </div>
  );
}

export async function LandingPage({
  locale,
  settings,
}: {
  locale: Locale;
  /** Prices, trial, download link and contacts, edited in the platform console. */
  settings: PlatformSettings;
}) {
  const t = await getTranslations({ locale, namespace: "landing" });
  const { downloadUrl, trialDays: days } = settings;
  const pricing = { cloudMonthly: settings.cloudMonthly, licenseOneTime: settings.licenseOneTime };
  const contact = {
    phone: settings.contactPhone,
    whatsapp: settings.contactWhatsapp,
    email: settings.contactEmail,
  };
  const price = (amount: number | null) =>
    amount === null ? null : formatMoney(amount * 100, "DZD", locale).replace(/[.,]00(?=\D*$)/, "");

  return (
    <div className="bg-background text-foreground min-h-dvh">
      {/* Header */}
      <header className="bg-background/85 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-40 border-b backdrop-blur">
        <div className={cn(container, "flex h-16 items-center gap-6")}>
          <Link href="/" aria-label="Mizan">
            <MizanLogo size={32} />
          </Link>
          <nav className="text-muted-foreground hidden items-center gap-6 text-sm md:flex">
            <a href="#features" className="hover:text-foreground">
              {t("nav.features")}
            </a>
            <a href="#pricing" className="hover:text-foreground">
              {t("nav.pricing")}
            </a>
            <a href="#faq" className="hover:text-foreground">
              {t("nav.faq")}
            </a>
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/login">{t("nav.signIn")}</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">{t("nav.start")}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section
          className={cn(container, "grid items-center gap-14 py-16 lg:grid-cols-2 lg:py-24")}
        >
          <div className="grid gap-6">
            <span className="text-primary text-sm font-medium">{t("hero.eyebrow")}</span>
            <h1 className="font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              {t("hero.title")}
            </h1>
            <p className="text-muted-foreground max-w-xl text-lg">{t("hero.subtitle")}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/signup">
                  {t("hero.primary", { days })}
                  <ArrowRight className="rtl:rotate-180" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={downloadUrl} rel="noopener">
                  <Download />
                  {t("hero.secondary")}
                </a>
              </Button>
            </div>
            <p className="text-muted-foreground text-sm">{t("hero.note")}</p>
          </div>
          <TillMock locale={locale} />
        </section>

        {/* Offline + sync */}
        <section className="bg-muted/50 border-y">
          <div className={cn(container, "grid gap-10 py-20")}>
            <SectionHead
              eyebrow={t("offline.eyebrow")}
              title={t("offline.title")}
              body={t("offline.body")}
            />
            <ol className="grid gap-4 md:grid-cols-3">
              {STEPS.map(({ key, icon: Icon }, i) => (
                <li key={key} className="bg-card grid gap-3 rounded-xl border p-6">
                  <div className="flex items-center gap-3">
                    <span className="bg-primary text-primary-foreground font-display flex size-8 items-center justify-center rounded-full text-sm font-semibold">
                      {i + 1}
                    </span>
                    <Icon className="text-primary size-5" />
                  </div>
                  <h3 className="font-display text-lg font-semibold">
                    {t(`offline.steps.${key}.title` as "offline.steps.sell.title")}
                  </h3>
                  <p className="text-muted-foreground">
                    {t(`offline.steps.${key}.body` as "offline.steps.sell.body")}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section id="features" className={cn(container, "grid scroll-mt-20 gap-10 py-20")}>
          <SectionHead eyebrow={t("features.eyebrow")} title={t("features.title")} />
          <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ key, icon: Icon }) => (
              <div key={key} className="grid content-start gap-2">
                <div className="bg-accent text-primary flex size-10 items-center justify-center rounded-lg">
                  <Icon className="size-5" />
                </div>
                <h3 className="font-display mt-1 text-lg font-semibold">
                  {t(`features.items.${key}.title` as "features.items.checkout.title")}
                </h3>
                <p className="text-muted-foreground">
                  {t(`features.items.${key}.body` as "features.items.checkout.body")}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Audience */}
        <section className="bg-muted/50 border-y">
          <div className={cn(container, "grid gap-8 py-16")}>
            <SectionHead eyebrow={t("shops.eyebrow")} title={t("shops.title")} />
            <ul className="flex flex-wrap gap-2">
              {SHOPS.map((key) => (
                <li key={key} className="bg-card rounded-full border px-4 py-2 text-sm">
                  {t(`shops.items.${key}` as "shops.items.grocery")}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground">{t("shops.languages")}</p>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className={cn(container, "grid scroll-mt-20 gap-10 py-20")}>
          <SectionHead
            eyebrow={t("pricing.eyebrow")}
            title={t("pricing.title")}
            body={t("pricing.body", { days })}
          />
          <div className="grid gap-6 md:grid-cols-2">
            {(
              [
                {
                  key: "cloud",
                  amount: price(pricing.cloudMonthly),
                  href: "/signup",
                  external: false,
                  highlight: true,
                },
                {
                  key: "license",
                  amount: price(pricing.licenseOneTime),
                  href: downloadUrl,
                  external: true,
                  highlight: false,
                },
              ] as const
            ).map((plan) => (
              <div
                key={plan.key}
                className={cn(
                  "bg-card grid content-start gap-5 rounded-2xl border p-7",
                  plan.highlight && "border-primary ring-primary/20 ring-4",
                )}
              >
                <div className="grid gap-1">
                  <h3 className="font-display text-xl font-semibold">
                    {t(`pricing.${plan.key}.name`)}
                  </h3>
                  <p className="text-muted-foreground">{t(`pricing.${plan.key}.desc`)}</p>
                </div>
                <div className="flex items-baseline gap-2">
                  {plan.amount ? (
                    <>
                      <span className="font-display text-4xl font-semibold tabular-nums">
                        {plan.amount}
                      </span>
                      <span className="text-muted-foreground">{t(`pricing.${plan.key}.per`)}</span>
                    </>
                  ) : (
                    <span className="font-display text-2xl font-semibold">
                      {t("pricing.onRequest")}
                    </span>
                  )}
                </div>
                <ul className="grid gap-2">
                  {(["p1", "p2", "p3", "p4"] as const).map((p) => (
                    <li key={p} className="flex gap-2">
                      <Check className="text-primary mt-1 size-4 shrink-0" />
                      <span>{t(`pricing.${plan.key}.${p}`)}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild size="lg" variant={plan.highlight ? "default" : "outline"}>
                  {plan.external ? (
                    <a href={plan.href} rel="noopener">
                      {t(`pricing.${plan.key}.cta`)}
                    </a>
                  ) : (
                    <Link href={plan.href}>{t(`pricing.${plan.key}.cta`)}</Link>
                  )}
                </Button>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground text-sm">{t("pricing.payment")}</p>
        </section>

        {/* FAQ */}
        <section id="faq" className="bg-muted/50 scroll-mt-20 border-y">
          <div className={cn(container, "grid items-start gap-8 py-20 lg:grid-cols-[1fr_2fr]")}>
            <SectionHead eyebrow={t("faq.eyebrow")} title={t("faq.title")} />
            <div className="bg-card divide-y rounded-xl border">
              {FAQ.map((key) => (
                <details key={key} className="group px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                    {t(`faq.items.${key}.q` as "faq.items.offline.q")}
                    <span className="text-muted-foreground text-xl leading-none transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="text-muted-foreground mt-3">
                    {t(`faq.items.${key}.a` as "faq.items.offline.a")}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final call to action */}
        <section className={cn(container, "py-20")}>
          <div className="bg-primary text-primary-foreground grid justify-items-start gap-5 rounded-3xl px-8 py-12 sm:px-12">
            <h2 className="font-display max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {t("cta.title", { days })}
            </h2>
            <p className="max-w-xl text-lg opacity-90">{t("cta.body")}</p>
            <Button asChild size="lg" variant="secondary">
              <Link href="/signup">
                {t("cta.button")}
                <ArrowRight className="rtl:rotate-180" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className={cn(container, "grid gap-8 py-10 md:grid-cols-[2fr_1fr_1fr]")}>
          <div className="grid content-start gap-3">
            <MizanLogo size={28} />
            <p className="text-muted-foreground max-w-sm text-sm">{t("footer.tagline")}</p>
          </div>
          {(contact.phone || contact.whatsapp || contact.email) && (
            <div className="grid content-start gap-2 text-sm">
              <span className="font-medium">{t("footer.contact")}</span>
              {contact.phone && (
                <span className="text-muted-foreground flex items-center gap-2" dir="ltr">
                  <Phone className="size-4" />
                  {contact.phone}
                </span>
              )}
              {contact.whatsapp && (
                <a
                  href={`https://wa.me/${contact.whatsapp}`}
                  rel="noopener"
                  className="text-muted-foreground hover:text-foreground flex items-center gap-2"
                >
                  <MessageCircle className="size-4" />
                  WhatsApp
                </a>
              )}
              {contact.email && (
                <span className="text-muted-foreground flex items-center gap-2 select-all">
                  <Mail className="size-4" />
                  {contact.email}
                </span>
              )}
            </div>
          )}
          <div className="grid content-start gap-2 text-sm">
            <span className="font-medium">{t("footer.language")}</span>
            {routing.locales.map((l) => (
              <Link
                key={l}
                href="/"
                locale={l}
                aria-current={l === locale ? "true" : undefined}
                className={cn(
                  "text-muted-foreground hover:text-foreground",
                  l === locale && "text-foreground font-medium",
                )}
              >
                {localeNames[l]}
              </Link>
            ))}
          </div>
        </div>
        <div className={cn(container, "text-muted-foreground border-t py-6 text-xs")}>
          © Mizan · <span lang="ar">ميزان</span>
        </div>
      </footer>
    </div>
  );
}
