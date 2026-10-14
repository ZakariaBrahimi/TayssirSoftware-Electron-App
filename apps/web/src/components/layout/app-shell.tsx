"use client";

import { Menu, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSettings } from "@/hooks/use-settings";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { navItems } from "./nav-items";
import { UserMenu } from "./user-menu";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { isAdmin } = useCurrentUser();

  return (
    <nav className="grid gap-1">
      {navItems
        .filter((item) => !item.adminOnly || isAdmin)
        .map(({ href, key, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active && "bg-sidebar-accent text-sidebar-accent-foreground",
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
  const { data: settings } = useSettings();
  return (
    <div className="flex items-center gap-2 px-3">
      <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
        <Store className="size-4" />
      </div>
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-semibold">
          {settings?.storeName ?? "Tayssir POS"}
        </span>
        <span className="text-muted-foreground text-xs">Tayssir POS</span>
      </div>
    </div>
  );
}

/** Authenticated layout: sidebar on desktop, drawer on mobile. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const { user, isPending } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !user) router.replace("/login");
  }, [isPending, user, router]);

  if (isPending || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Skeleton className="h-8 w-40" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh">
      <aside className="bg-sidebar sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-e py-4 lg:flex print:hidden">
        <Brand />
        <div className="px-3">
          <NavLinks />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/95 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-4 backdrop-blur print:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t("menu")}>
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="start" className="bg-sidebar w-72 p-0 pt-4">
              <SheetTitle className="sr-only">{t("menu")}</SheetTitle>
              <div className="flex flex-col gap-6">
                <Brand />
                <div className="px-3">
                  <NavLinks onNavigate={() => setOpen(false)} />
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="ms-auto">
            <UserMenu />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
