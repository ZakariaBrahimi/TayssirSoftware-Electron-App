"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { ThemeProvider } from "next-themes";
import { Direction } from "radix-ui";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Locale } from "@/i18n/routing";
import { getQueryClient } from "@/lib/query-client";

export function Providers({
  children,
  locale,
  messages,
  dir,
}: {
  children: React.ReactNode;
  locale: Locale;
  messages: AbstractIntlMessages;
  dir: "ltr" | "rtl";
}) {
  const queryClient = getQueryClient();

  useEffect(() => {
    // Offline shell + installability (PWA). Only in production builds.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
    >
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <Direction.Provider dir={dir}>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              {children}
              <Toaster position={dir === "rtl" ? "bottom-left" : "bottom-right"} />
            </TooltipProvider>
            <ReactQueryDevtools buttonPosition="bottom-left" />
          </QueryClientProvider>
        </Direction.Provider>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
