"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useMoney } from "@/hooks/use-settings";
import { type ProductPage, useProducts } from "./api";

export type PickedProduct = ProductPage["rows"][number];

/** Product search box (by name or barcode) that reports the chosen product. */
export function ProductPicker({
  onPick,
  placeholder,
  stockedOnly = false,
}: {
  onPick: (p: PickedProduct) => void;
  placeholder: string;
  /** Only products with stock (purchases): no services. */
  stockedOnly?: boolean;
}) {
  const t = useTranslations("pos");
  const money = useMoney();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const q = useDebouncedValue(search.trim(), 200);
  const results = useProducts(
    {
      q,
      includeInactive: "true",
      kind: stockedOnly ? "product" : undefined,
      pageSize: 12,
      sort: "name",
    },
    q.length > 0,
  );

  return (
    <Popover open={open && q.length > 0} onOpenChange={setOpen}>
      <Command shouldFilter={false} className="overflow-visible rounded-md border">
        <PopoverAnchor asChild>
          <div>
            <CommandInput
              value={search}
              onValueChange={(v) => {
                setSearch(v);
                setOpen(true);
              }}
              placeholder={placeholder}
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          className="w-(--radix-popover-trigger-width) min-w-80 p-0"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <CommandList>
            {results.data?.rows.length === 0 && (
              <p className="text-muted-foreground flex items-center gap-2 p-3 text-sm">
                <Search className="size-4" />
                {t("productNotFound", { code: q })}
              </p>
            )}
            <CommandGroup>
              {results.data?.rows.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  onSelect={() => {
                    onPick(p);
                    setSearch("");
                    setOpen(false);
                  }}
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{p.name}</span>
                    <span className="text-muted-foreground font-mono text-xs" dir="ltr">
                      {p.barcode}
                    </span>
                  </div>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {p.stock} · {money.format(p.costPrice)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </PopoverContent>
      </Command>
    </Popover>
  );
}
