"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, Languages, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useTransition } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePathname, useRouter } from "@/i18n/navigation";
import { localeNames, routing, type Locale } from "@/i18n/routing";
import { signOut } from "@/lib/auth-client";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function UserMenu() {
  const t = useTranslations("nav");
  const { user, isAdmin } = useCurrentUser();
  const { theme, setTheme } = useTheme();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [, startTransition] = useTransition();

  const changeLocale = (next: string) => {
    startTransition(() => router.replace(pathname, { locale: next as Locale }));
  };

  const logout = async () => {
    await signOut();
    queryClient.clear();
    router.replace("/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 gap-2 px-2" aria-label={user?.name ?? ""}>
          <Avatar>
            <AvatarFallback>{initials(user?.name ?? "?")}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">
            {user?.name}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate">{user?.name}</span>
          <span className="text-muted-foreground text-xs font-normal">
            {isAdmin ? t("roleAdmin") : t("roleCashier")}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Languages />
            {t("language")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={locale} onValueChange={changeLocale}>
              {routing.locales.map((l) => (
                <DropdownMenuRadioItem key={l} value={l}>
                  {localeNames[l]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Sun className="dark:hidden" />
            <Moon className="hidden dark:block" />
            {t("theme")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {(
              [
                ["light", Sun],
                ["dark", Moon],
                ["system", Monitor],
              ] as const
            ).map(([value, Icon]) => (
              <DropdownMenuItem key={value} onSelect={() => setTheme(value)}>
                <Icon />
                {t(value)}
                {theme === value && <Check className="ms-auto" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={logout}>
          <LogOut />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
