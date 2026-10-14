"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function Pagination({
  page,
  pageCount,
  total,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const t = useTranslations("common");
  return (
    <div className="text-muted-foreground flex items-center justify-between gap-2 py-3 text-sm">
      <span>{t("results", { count: total })}</span>
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline">{t("pageOf", { page, pageCount })}</span>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label={t("previous")}
        >
          <ChevronLeft className="rtl:rotate-180" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label={t("next")}
        >
          <ChevronRight className="rtl:rotate-180" />
        </Button>
      </div>
    </div>
  );
}
