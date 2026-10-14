"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CreditCard,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  MonitorSmartphone,
  ScrollText,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api-client";
import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { usePlatformMe } from "./api";

type NavKey = "overview" | "stores" | "licenses" | "devices" | "payments" | "audit" | "security";

const items: { href: string; key: NavKey; icon: LucideIcon }[] = [
  { href: "/platform", key: "overview", icon: LayoutDashboard },
  { href: "/platform/stores", key: "stores", icon: Building2 },
  { href: "/platform/licenses", key: "licenses", icon: KeyRound },
  { href: "/platform/devices", key: "devices", icon: MonitorSmartphone },
  { href: "/platform/payments", key: "payments", icon: CreditCard },
  { href: "/platform/audit", key: "audit", icon: ScrollText },
  { href: "/platform/security", key: "security", icon: ShieldCheck },
];

const SECURITY = "/platform/security";

function Nav({ locked, onNavigate }: { locked: boolean; onNavigate?: () => void }) {
  const t = useTranslations("platform.nav");
  const pathname = usePathname();
  return (
    <nav className="grid gap-1">
      {items.map(({ href, key, icon: Icon }) => {
        const active =
          href === "/platform"
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);
        const disabled = locked && href !== SECURITY;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            aria-disabled={disabled || undefined}
            className={cn(
              "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active && "bg-sidebar-accent text-sidebar-accent-foreground",
              disabled && "pointer-events-none opacity-40",
            )}
          >
            <Icon className="size-4" />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  const t = useTranslations("platform");
  return (
    <div className="flex items-center gap-2 px-3">
      <div className="bg-foreground text-background flex size-8 items-center justify-center rounded-md">
        <ShieldCheck className="size-4" />
      </div>
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-semibold">{t("title")}</span>
        <span className="text-muted-foreground text-xs">Tayssir POS</span>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh items-center justify-center p-4">{children}</div>;
}

/** Layout of the platform owner console (cloud mode, platform admins only). */
export function PlatformShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("platform");
  const tn = useTranslations("nav");
  const me = usePlatformMe();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const status = me.error instanceof ApiError ? me.error.status : null;
  const locked = Boolean(me.data && !me.data.user.twoFactorEnabled);

  useEffect(() => {
    if (status === 401) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);

  useEffect(() => {
    // Until an authenticator app is set up, only the security page is usable.
    if (locked && pathname !== SECURITY) router.replace(SECURITY);
  }, [locked, pathname, router]);

  const logout = async () => {
    await signOut();
    queryClient.clear();
    router.replace("/login");
  };

  if (me.isPending || status === 401) {
    return (
      <Centered>
        <Skeleton className="h-8 w-40" />
      </Centered>
    );
  }
  if (!me.data) {
    // Not a platform admin, or not a cloud deployment: nothing to see here.
    return (
      <Centered>
        <div className="space-y-3 text-center">
          <p className="text-4xl font-semibold">404</p>
          <p className="text-muted-foreground">{t("notFound")}</p>
          <Button asChild variant="outline">
            <Link href="/">{t("backToApp")}</Link>
          </Button>
        </div>
      </Centered>
    );
  }

  const user = me.data.user;
  return (
    <div className="flex min-h-dvh">
      <aside className="bg-sidebar sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-e py-4 lg:flex">
        <Brand />
        <div className="px-3">
          <Nav locked={locked} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/95 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-4 backdrop-blur">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label={tn("menu")}>
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="start" className="bg-sidebar w-72 p-0 pt-4">
              <SheetTitle className="sr-only">{tn("menu")}</SheetTitle>
              <div className="flex flex-col gap-6">
                <Brand />
                <div className="px-3">
                  <Nav locked={locked} onNavigate={() => setOpen(false)} />
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="ms-auto flex items-center gap-3">
            <span className="text-muted-foreground hidden text-sm sm:inline">
              {user.name} · <span dir="ltr">@{user.username}</span>
            </span>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut />
              {tn("signOut")}
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
