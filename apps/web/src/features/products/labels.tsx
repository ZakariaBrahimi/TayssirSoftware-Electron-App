"use client";

import { Printer, Settings2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePrint } from "@/hooks/use-print";
import { useSettings } from "@/hooks/use-settings";
import { Link } from "@/i18n/navigation";
import { DEFAULT_LABEL_SETTINGS } from "@/lib/print-settings";
import { type LabelItem, LabelPages, LabelView, labelPage } from "../printing/label";

const clampCopies = (v: number) => Math.max(0, Math.min(500, Math.floor(v) || 0));

/**
 * Prints barcode labels with the shop's label design (Settings → Printing).
 * One product (`product`) or several (`items`, each with its copies).
 */
export function PrintLabelsDialog({
  product,
  items,
  trigger,
  open,
  onOpenChange,
}: {
  product?: LabelItem;
  items?: { item: LabelItem; copies: number }[];
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations("products");
  const tc = useTranslations("common");
  const settings = useSettings().data?.labels ?? DEFAULT_LABEL_SETTINGS;
  const { print, printArea } = usePrint();
  const list = items ?? (product ? [{ item: product, copies: 1 }] : []);
  const [copies, setCopies] = useState<number[] | null>(null);
  const current = copies ?? list.map((l) => l.copies);
  const total = current.reduce((s, c) => s + c, 0);

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) setCopies(null);
          onOpenChange?.(o);
        }}
      >
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("printLabels")}</DialogTitle>
          </DialogHeader>
          {list.length > 0 && (
            <div className="flex justify-center overflow-hidden rounded-md border bg-white p-3">
              <LabelView item={list[0].item} settings={settings} />
            </div>
          )}
          <div className="grid max-h-64 gap-2 overflow-y-auto">
            {list.map((l, i) => (
              <div key={`${l.item.barcode}-${i}`} className="flex items-center gap-3">
                <Label htmlFor={`copies-${i}`} className="min-w-0 flex-1 truncate font-normal">
                  {list.length === 1 ? t("labelCopies") : l.item.name}
                </Label>
                <Input
                  id={`copies-${i}`}
                  type="number"
                  min={0}
                  max={500}
                  className="w-20"
                  value={current[i]}
                  onChange={(e) => {
                    const next = [...current];
                    next[i] = clampCopies(Number(e.target.value));
                    setCopies(next);
                  }}
                />
              </div>
            ))}
          </div>
          <DialogFooter className="sm:justify-between">
            <Button asChild variant="ghost" size="sm">
              <Link href="/settings?tab=printing">
                <Settings2 />
                {t("labelDesign")}
              </Link>
            </Button>
            <Button
              disabled={total === 0}
              onClick={() =>
                print(
                  <LabelPages
                    settings={settings}
                    items={list.map((l, i) => ({ item: l.item, copies: current[i] }))}
                  />,
                  { page: labelPage(settings) },
                )
              }
            >
              <Printer />
              {tc("print")} ({total})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {printArea}
    </>
  );
}
