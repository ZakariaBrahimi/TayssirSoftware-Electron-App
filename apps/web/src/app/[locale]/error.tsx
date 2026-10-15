"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("common");
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-lg font-medium">{t("somethingWentWrong")}</p>
      <Button onClick={reset}>{t("retry")}</Button>
    </div>
  );
}
