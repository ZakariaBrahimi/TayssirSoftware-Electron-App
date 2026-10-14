"use client";

import { ArrowLeft, ArrowRight, Loader2, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useMoney } from "@/hooks/use-settings";
import { QUICK_COLORS, type QuickColor } from "@/lib/quick-keys";
import { cn } from "@/lib/utils";
import { QUICK_COLOR_CLASSES } from "../pos/quick-keys-panel";
import { type QuickKeys, useQuickKeys, useSaveQuickKeys } from "../products/api";
import { ProductPicker } from "../products/product-picker";

type Key = QuickKeys["pages"][number]["keys"][number];
type Page = { name: string; keys: Key[] };

/** Settings → Quick buttons: pages of buttons shown on the till. */
export function QuickKeysEditor() {
  const quick = useQuickKeys();
  if (!quick.data) return <Skeleton className="h-80 w-full" />;
  return <Editor initial={quick.data.pages} />;
}

const DOT: Record<QuickColor, string> = {
  teal: "bg-teal-500",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
  rose: "bg-rose-500",
  amber: "bg-amber-500",
  lime: "bg-lime-500",
  orange: "bg-orange-500",
  slate: "bg-slate-500",
};

function Editor({ initial }: { initial: Page[] }) {
  const t = useTranslations("quickKeys");
  const tc = useTranslations("common");
  const money = useMoney();
  const errorMessage = useErrorMessage();
  const save = useSaveQuickKeys();
  const [pages, setPages] = useState<Page[]>(
    initial.length ? initial : [{ name: t("defaultPage"), keys: [] }],
  );
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const page = pages[Math.min(current, pages.length - 1)];
  const key = selected !== null ? page.keys[selected] : undefined;

  const updatePage = (patch: Partial<Page>) =>
    setPages((all) => all.map((p, i) => (i === current ? { ...p, ...patch } : p)));
  const updateKey = (index: number, patch: Partial<Key>) =>
    updatePage({ keys: page.keys.map((k, i) => (i === index ? { ...k, ...patch } : k)) });
  const moveKey = (index: number, by: number) => {
    const to = index + by;
    if (to < 0 || to >= page.keys.length) return;
    const keys = [...page.keys];
    [keys[index], keys[to]] = [keys[to], keys[index]];
    updatePage({ keys });
    setSelected(to);
  };

  const onSave = () =>
    save.mutate(
      {
        pages: pages
          .filter((p) => p.name.trim())
          .map((p) => ({
            name: p.name.trim(),
            keys: p.keys.map((k) => ({ productId: k.productId, label: k.label, color: k.color })),
          })),
      },
      {
        onSuccess: () => toast.success(tc("saved")),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="flex flex-wrap items-center gap-1.5">
          {pages.map((p, i) => (
            <Button
              key={i}
              size="sm"
              variant={i === current ? "default" : "outline"}
              onClick={() => {
                setCurrent(i);
                setSelected(null);
              }}
            >
              {p.name || t("untitled")}
              <span className="opacity-60">({p.keys.length})</span>
            </Button>
          ))}
          {pages.length < 10 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setPages((all) => [
                  ...all,
                  { name: t("newPage", { n: all.length + 1 }), keys: [] },
                ]);
                setCurrent(pages.length);
                setSelected(null);
              }}
            >
              <Plus />
              {t("addPage")}
            </Button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="qk-page-name">{t("pageName")}</Label>
            <Input
              id="qk-page-name"
              maxLength={30}
              value={page.name}
              onChange={(e) => updatePage({ name: e.target.value })}
            />
          </div>
          <Button
            variant="ghost"
            className="text-destructive"
            disabled={pages.length === 1}
            onClick={() => {
              setPages((all) => all.filter((_, i) => i !== current));
              setCurrent(Math.max(0, current - 1));
              setSelected(null);
            }}
          >
            <Trash2 />
            {t("deletePage")}
          </Button>
        </div>

        <div className="grid gap-1.5">
          <Label>{t("addButton")}</Label>
          <ProductPicker
            placeholder={t("searchProduct")}
            onPick={(p) => {
              if (page.keys.length >= 48) return;
              updatePage({
                keys: [...page.keys, { productId: p.id, label: "", color: "teal", product: p }],
              });
              setSelected(page.keys.length);
            }}
          />
        </div>

        {page.keys.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            {t("empty")}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
            {page.keys.map((k, i) => (
              <button
                key={`${k.productId}-${i}`}
                type="button"
                onClick={() => setSelected(i)}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-0.5 rounded-lg border-2 px-2 text-center font-semibold",
                  QUICK_COLOR_CLASSES[k.color],
                  selected === i && "ring-primary ring-2 ring-offset-2",
                )}
              >
                <span className="line-clamp-2 text-sm leading-tight">
                  {k.label || k.product.name}
                </span>
                <span className="text-[11px] font-normal tabular-nums opacity-75">
                  {money.format(k.product.salePrice)}
                </span>
              </button>
            ))}
          </div>
        )}

        {key && selected !== null && (
          <div className="bg-muted/40 grid gap-4 rounded-lg border p-4">
            <p className="text-sm">
              <span className="text-muted-foreground">{t("product")}:</span>{" "}
              <span className="font-medium">{key.product.name}</span>
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="qk-label">{t("label")}</Label>
                <Input
                  id="qk-label"
                  maxLength={24}
                  value={key.label}
                  placeholder={key.product.name.slice(0, 24)}
                  onChange={(e) => updateKey(selected, { label: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <span className="text-sm font-medium">{t("color")}</span>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("color")}>
                  {QUICK_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={key.color === c}
                      aria-label={c}
                      onClick={() => updateKey(selected, { color: c })}
                      className={cn(
                        "size-8 rounded-full border-2 border-transparent",
                        DOT[c],
                        key.color === c && "border-foreground ring-background ring-2 ring-inset",
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={selected === 0}
                onClick={() => moveKey(selected, -1)}
              >
                <ArrowLeft className="rtl:rotate-180" />
                {t("moveBefore")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={selected === page.keys.length - 1}
                onClick={() => moveKey(selected, 1)}
              >
                {t("moveAfter")}
                <ArrowRight className="rtl:rotate-180" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive ms-auto"
                onClick={() => {
                  updatePage({ keys: page.keys.filter((_, i) => i !== selected) });
                  setSelected(null);
                }}
              >
                <Trash2 />
                {t("removeButton")}
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={onSave} disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />}
            {tc("save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
