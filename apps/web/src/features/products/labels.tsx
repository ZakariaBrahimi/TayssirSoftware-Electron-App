"use client";

import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Barcode } from "@/components/barcode";
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
import { useMoney } from "@/hooks/use-settings";
import { usePrint } from "@/hooks/use-print";

type LabelProduct = { name: string; barcode: string; salePrice: number };

export function ProductLabel({ product }: { product: LabelProduct }) {
  const money = useMoney();
  return (
    <div className="flex w-[50mm] break-inside-avoid flex-col items-center gap-0.5 overflow-hidden p-1 text-center text-black">
      <div className="w-full truncate text-[9pt] font-semibold">{product.name}</div>
      <div className="text-[10pt] font-bold">{money.format(product.salePrice)}</div>
      <Barcode value={product.barcode} height={10} className="w-full" />
    </div>
  );
}

export function PrintLabelsDialog({
  product,
  trigger,
  open,
  onOpenChange,
}: {
  product: LabelProduct;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations("products");
  const tc = useTranslations("common");
  const [copies, setCopies] = useState(1);
  const { print, printArea } = usePrint();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("printLabels")}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center rounded-md border bg-white p-3">
            <ProductLabel product={product} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="copies">{t("labelCopies")}</Label>
            <Input
              id="copies"
              type="number"
              min={1}
              max={500}
              value={copies}
              onChange={(e) => setCopies(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() =>
                print(
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: copies }).map((_, i) => (
                      <ProductLabel key={i} product={product} />
                    ))}
                  </div>,
                )
              }
            >
              <Printer />
              {tc("print")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {printArea}
    </>
  );
}
