"use client";

import { Check, ChevronsUpDown, UserPlus, UserRound, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useMoney } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";
import { type CustomerOption, useCustomerMutations, useCustomerOptions } from "./api";

export type PickedCustomer = Pick<CustomerOption, "id" | "name" | "balance" | "creditLimit">;

/** Searchable customer selector with quick creation (used at the till). */
export function CustomerPicker({
  value,
  onChange,
  className,
}: {
  value: PickedCustomer | null;
  onChange: (customer: PickedCustomer | null) => void;
  className?: string;
}) {
  const t = useTranslations("customers");
  const tp = useTranslations("pos");
  const money = useMoney();
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search.trim(), 200);
  const options = useCustomerOptions(q);
  const { create } = useCustomerMutations();

  const pick = (c: PickedCustomer) => {
    onChange(c);
    setOpen(false);
    setSearch("");
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="flex-1 justify-between font-normal"
          >
            <span className="flex min-w-0 items-center gap-2">
              <UserRound className="text-muted-foreground size-4 shrink-0" />
              {value ? (
                <span className="truncate">
                  {value.name}
                  {value.balance !== 0 && (
                    <span
                      className={cn(
                        "ms-2 text-xs",
                        value.balance > 0 ? "text-destructive" : "text-success",
                      )}
                    >
                      {money.format(value.balance)}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-muted-foreground truncate">{tp("chooseCustomer")}</span>
              )}
            </span>
            <ChevronsUpDown className="size-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder={t("searchPlaceholder")}
            />
            <CommandList>
              <CommandEmpty>{tp("productNotFound", { code: search })}</CommandEmpty>
              <CommandGroup>
                {options.data?.map((c) => (
                  <CommandItem key={c.id} value={c.id} onSelect={() => pick(c)}>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{c.name}</span>
                      {c.phone && (
                        <span className="text-muted-foreground text-xs" dir="ltr">
                          {c.phone}
                        </span>
                      )}
                    </div>
                    {c.balance !== 0 && (
                      <span
                        className={cn(
                          "text-xs tabular-nums",
                          c.balance > 0 ? "text-destructive" : "text-success",
                        )}
                      >
                        {money.format(c.balance)}
                      </span>
                    )}
                    {value?.id === c.id && <Check className="size-4" />}
                  </CommandItem>
                ))}
              </CommandGroup>
              {search.trim().length > 1 && (
                <CommandGroup>
                  <CommandItem
                    value="__create"
                    disabled={create.isPending}
                    onSelect={() =>
                      create.mutate(
                        { name: search.trim() },
                        {
                          onSuccess: (c) =>
                            pick({
                              id: c.id,
                              name: c.name,
                              balance: c.balance,
                              creditLimit: c.creditLimit,
                            }),
                          onError: (err) => toast.error(errorMessage(err)),
                        },
                      )
                    }
                  >
                    <UserPlus className="size-4" />
                    {t("quickAdd", { name: search.trim() })}
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onChange(null)}
          aria-label={tp("removeCustomer")}
        >
          <X />
        </Button>
      )}
    </div>
  );
}
