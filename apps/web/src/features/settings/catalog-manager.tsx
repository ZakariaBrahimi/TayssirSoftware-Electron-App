"use client";

import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useErrorMessage } from "@/hooks/use-error-message";
import { type CatalogKind, useCatalogList, useCatalogMutations } from "../catalog/api";

export function CatalogManager({ kind }: { kind: CatalogKind }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const list = useCatalogList(kind);
  const { create, update, remove } = useCatalogMutations(kind);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const onError = (err: unknown) => toast.error(errorMessage(err));

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate(name.trim(), { onSuccess: () => setName(""), onError });
  };

  const saveEdit = () => {
    if (!editing?.name.trim()) return;
    update.mutate(
      { id: editing.id, name: editing.name.trim() },
      { onSuccess: () => setEditing(null), onError },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t(kind)}</CardTitle>
      </CardHeader>
      <CardContent className="grid max-w-2xl gap-4">
        <form onSubmit={add} className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            maxLength={80}
          />
          <Button type="submit" disabled={!name.trim() || create.isPending}>
            <Plus />
            {tc("add")}
          </Button>
        </form>
        {list.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : !list.data?.length ? (
          <p className="text-muted-foreground text-sm">{tc("noResults")}</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {list.data.map((item) => (
              <li key={item.id} className="flex items-center gap-2 px-3 py-2">
                {editing?.id === item.id ? (
                  <form
                    className="flex flex-1 gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveEdit();
                    }}
                  >
                    <Input
                      autoFocus
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      className="h-8"
                    />
                    <Button type="submit" size="icon-sm" aria-label={tc("save")}>
                      <Check />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => setEditing(null)}
                      aria-label={tc("cancel")}
                    >
                      <X />
                    </Button>
                  </form>
                ) : (
                  <>
                    <div className="flex flex-1 flex-col">
                      <span className="text-sm font-medium">{item.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {t("productsCount", { count: Number(item.productCount) })}
                      </span>
                    </div>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => setEditing({ id: item.id, name: item.name })}
                      aria-label={tc("edit")}
                    >
                      <Pencil />
                    </Button>
                    <ConfirmDialog
                      description={t("deleteEntityConfirm", { name: item.name })}
                      confirmLabel={tc("delete")}
                      onConfirm={() => remove.mutate(item.id, { onError })}
                      trigger={
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-destructive"
                          aria-label={tc("delete")}
                        >
                          <Trash2 />
                        </Button>
                      }
                    />
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
