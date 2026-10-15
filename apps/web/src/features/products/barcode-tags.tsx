"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { barcodeSchema } from "@/lib/validators";

/** The product's other barcodes: scan or type one and press Enter. */
export function BarcodeTags({
  id,
  value,
  onChange,
  main,
}: {
  id?: string;
  value: string[];
  onChange: (value: string[]) => void;
  /** The main barcode, which isn't repeated here. */
  main: string;
}) {
  const t = useTranslations("products");
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);

  const add = () => {
    const code = draft.trim();
    if (!code) return;
    if (!barcodeSchema.safeParse(code).success) {
      setInvalid(true);
      return;
    }
    if (code !== main && !value.includes(code) && value.length < 20) onChange([...value, code]);
    setDraft("");
    setInvalid(false);
  };

  return (
    <div className="grid gap-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((code) => (
            <Badge key={code} variant="secondary" className="gap-1 ps-2 pe-1 font-mono" dir="ltr">
              {code}
              <button
                type="button"
                className="hover:bg-muted-foreground/20 rounded-sm p-0.5"
                aria-label={t("removeBarcode", { code })}
                onClick={() => onChange(value.filter((c) => c !== code))}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input
        id={id}
        dir="ltr"
        className="font-mono"
        value={draft}
        placeholder={t("otherBarcodesPlaceholder")}
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          setDraft(e.target.value);
          setInvalid(false);
        }}
        onKeyDown={(e) => {
          // Scanners send Enter after the code.
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
      />
    </div>
  );
}
