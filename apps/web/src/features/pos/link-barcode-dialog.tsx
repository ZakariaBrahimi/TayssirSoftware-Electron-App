"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useErrorMessage } from "@/hooks/use-error-message";
import { type Product, useProductMutations } from "../products/api";
import { ProductPicker } from "../products/product-picker";

/** An unknown barcode was scanned: attach it to an existing product. */
export function LinkBarcodeDialog({
  code,
  onClose,
  onLinked,
}: {
  code: string | null;
  onClose: () => void;
  onLinked: (product: Product) => void;
}) {
  const t = useTranslations("pos");
  const errorMessage = useErrorMessage();
  const { addBarcode } = useProductMutations();
  return (
    <Dialog open={code !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("linkBarcodeTitle")}</DialogTitle>
          <DialogDescription>{t("linkBarcodeDescription", { code: code ?? "" })}</DialogDescription>
        </DialogHeader>
        <ProductPicker
          placeholder={t("linkBarcodeSearch")}
          onPick={(p) => {
            if (!code) return;
            addBarcode.mutate(
              { id: p.id, barcode: code },
              {
                onSuccess: (product) => {
                  toast.success(t("barcodeLinked", { code, name: product.name }));
                  onLinked(product);
                },
                onError: (err) => toast.error(errorMessage(err)),
              },
            );
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
