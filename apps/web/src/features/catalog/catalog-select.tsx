"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useErrorMessage } from "@/hooks/use-error-message";
import { type CatalogKind, useCatalogList, useCatalogMutations } from "./api";

const NONE = "none";

/** Select for a category/brand with inline creation of a new entry. */
export function CatalogSelect({
  kind,
  value,
  onChange,
  id,
}: {
  kind: CatalogKind;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  id?: string;
}) {
  const t = useTranslations("products");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const list = useCatalogList(kind);
  const { create } = useCatalogMutations(kind);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!name.trim()) return;
    create.mutate(name.trim(), {
      onSuccess: (row) => {
        onChange(row.id);
        setName("");
        setOpen(false);
      },
      onError: (err) => toast.error(errorMessage(err)),
    });
  };

  return (
    <div className="flex gap-2">
      <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>
            {kind === "categories" ? t("noCategory") : t("noBrand")}
          </SelectItem>
          {list.data?.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={kind === "categories" ? t("newCategory") : t("newBrand")}
          >
            <Plus />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64">
          <form onSubmit={submit} className="grid gap-2">
            <p className="text-sm font-medium">
              {kind === "categories" ? t("newCategory") : t("newBrand")}
            </p>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={80}
            />
            <Button type="submit" size="sm" disabled={create.isPending || !name.trim()}>
              {tc("add")}
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}
