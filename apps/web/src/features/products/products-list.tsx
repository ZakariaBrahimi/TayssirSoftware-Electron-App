"use client";

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Boxes,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  Wrench,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useMoney, useSettings } from "@/hooks/use-settings";
import { usesVariants } from "@/lib/shop-types";
import { Link, useRouter } from "@/i18n/navigation";
import type { PRODUCT_SORTS, PRODUCT_STOCK_FILTERS } from "@/lib/validators";
import { useCatalogList } from "../catalog/api";
import { type ProductPage, useProductMutations, useProducts } from "./api";
import { PrintLabelsDialog } from "./labels";
import { StockAdjustDialog } from "./stock-dialog";
import { StockBadge } from "./stock-badge";

type Row = ProductPage["rows"][number];
type Sort = (typeof PRODUCT_SORTS)[number];
type SortKey = "name" | "stock" | "salePrice";

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, Row>();
const emptyRows: Row[] = [];

function SortButton({
  label,
  column,
  sort,
  onSort,
}: {
  label: string;
  column: SortKey;
  sort: Sort;
  onSort: (s: Sort) => void;
}) {
  const active = sort.replace(/^-/, "") === column;
  const desc = sort.startsWith("-");
  const Icon = !active ? ArrowUpDown : desc ? ArrowDown : ArrowUp;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ms-3 h-8"
      onClick={() => onSort(active && !desc ? (`-${column}` as Sort) : column)}
    >
      {label}
      <Icon className="size-3.5" />
    </Button>
  );
}

function RowActions({ product }: { product: Row }) {
  const t = useTranslations("products");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const { remove } = useProductMutations();
  const [dialog, setDialog] = useState<"stock" | "labels" | "delete" | null>(null);

  return (
    <div onClick={(e) => e.stopPropagation()} className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={tc("actions")}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() =>
              router.push(
                product.familyId
                  ? `/products/families/${product.familyId}`
                  : `/products/${product.id}`,
              )
            }
          >
            <Pencil />
            {tc("edit")}
          </DropdownMenuItem>
          {product.kind !== "service" && (
            <DropdownMenuItem onSelect={() => setDialog("stock")}>
              <Boxes />
              {t("adjustStock")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setDialog("labels")}>
            <Printer />
            {t("printLabels")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
            <Trash2 />
            {tc("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <StockAdjustDialog
        product={product}
        open={dialog === "stock"}
        onOpenChange={(o) => setDialog(o ? "stock" : null)}
      />
      <PrintLabelsDialog
        product={product}
        open={dialog === "labels"}
        onOpenChange={(o) => setDialog(o ? "labels" : null)}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(o) => setDialog(o ? "delete" : null)}
        description={t("deleteConfirm", { name: product.name })}
        confirmLabel={tc("delete")}
        onConfirm={() =>
          remove.mutate(product.id, {
            onSuccess: () => toast.success(tc("deleted")),
            onError: (err) => toast.error(errorMessage(err)),
          })
        }
      />
    </div>
  );
}

export function ProductsList() {
  const t = useTranslations("products");
  const tv = useTranslations("variants");
  const money = useMoney();
  // Clothing shops mostly create products with sizes and colours.
  const variantsFirst = usesVariants(useSettings().data?.shopType);
  const router = useRouter();
  const { isAdmin } = useCurrentUser();
  const categories = useCatalogList("categories");

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [stock, setStock] = useState<(typeof PRODUCT_STOCK_FILTERS)[number]>("all");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [sort, setSort] = useState<Sort>("name");
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim(), 250);

  const resetPage =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      fn(v);
      setPage(1);
    };

  const query = useProducts({
    q: q || undefined,
    categoryId: categoryId === "all" ? undefined : categoryId,
    stock,
    includeInactive: includeInactive ? "true" : undefined,
    sort,
    page,
    pageSize: 20,
  });

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("name", {
          header: () => (
            <SortButton label={t("name")} column="name" sort={sort} onSort={resetPage(setSort)} />
          ),
          cell: ({ row }) => (
            <div className="flex min-w-48 flex-col">
              <span className="flex items-center gap-2 font-medium">
                {row.original.name}
                {!row.original.isActive && <Badge variant="outline">{t("inactive")}</Badge>}
                {row.original.familyId && (
                  <Badge variant="secondary" className="gap-1 font-normal">
                    <Layers className="size-3" />
                    {tv("variant")}
                  </Badge>
                )}
              </span>
              <span className="text-muted-foreground font-mono text-xs" dir="ltr">
                {row.original.barcode}
              </span>
            </div>
          ),
        }),
        helper.accessor("categoryName", {
          header: t("category"),
          cell: ({ getValue }) => getValue() ?? <span className="text-muted-foreground">—</span>,
        }),
        helper.accessor("stock", {
          header: () => (
            <SortButton label={t("stock")} column="stock" sort={sort} onSort={resetPage(setSort)} />
          ),
          cell: ({ row }) =>
            row.original.kind === "service" ? (
              <Badge variant="secondary" className="font-normal">
                <Wrench className="size-3" />
                {t("kind_service")}
              </Badge>
            ) : (
              <StockBadge stock={row.original.stock} threshold={row.original.lowStockThreshold} />
            ),
        }),
        helper.accessor("salePrice", {
          header: () => (
            <SortButton
              label={t("salePrice")}
              column="salePrice"
              sort={sort}
              onSort={resetPage(setSort)}
            />
          ),
          cell: ({ row }) =>
            row.original.openPrice && row.original.salePrice === 0 ? (
              <span className="text-muted-foreground text-sm">{t("priceAtTill")}</span>
            ) : (
              <span className="tabular-nums">{money.format(row.original.salePrice)}</span>
            ),
        }),
        ...(isAdmin
          ? [
              helper.accessor("costPrice", {
                header: t("costPrice"),
                cell: ({ getValue }) => (
                  <span className="text-muted-foreground tabular-nums">
                    {money.format(getValue())}
                  </span>
                ),
              }),
              helper.display({
                id: "actions",
                header: () => <span className="sr-only">actions</span>,
                cell: ({ row }) => <RowActions product={row.original} />,
              }),
            ]
          : []),
      ]),
    [t, tv, money, sort, isAdmin],
  );

  const table = useTable({
    features,
    columns,
    data: query.data?.rows ?? emptyRows,
    getRowId: (row) => String(row.id),
  });

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          isAdmin && (
            <>
              <Button asChild variant={variantsFirst ? "default" : "outline"}>
                <Link href="/products/families/new">
                  <Layers />
                  {tv("newShort")}
                </Link>
              </Button>
              <Button asChild variant={variantsFirst ? "outline" : "default"}>
                <Link href="/products/new">
                  <Plus />
                  {t("new")}
                </Link>
              </Button>
            </>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => resetPage(setSearch)(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="ps-9"
          />
        </div>
        <Select value={categoryId} onValueChange={resetPage(setCategoryId)}>
          <SelectTrigger className="w-44" aria-label={t("filterCategory")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allCategories")}</SelectItem>
            {categories.data?.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stock} onValueChange={resetPage((v: string) => setStock(v as typeof stock))}>
          <SelectTrigger className="w-40" aria-label={t("filterStock")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterStock")}: —</SelectItem>
            <SelectItem value="low">{t("lowStock")}</SelectItem>
            <SelectItem value="out">{t("outOfStock")}</SelectItem>
          </SelectContent>
        </Select>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Switch
              id="include-inactive"
              checked={includeInactive}
              onCheckedChange={resetPage(setIncludeInactive)}
            />
            <Label htmlFor="include-inactive">{t("showInactive")}</Label>
          </div>
        )}
      </div>

      <DataTable
        table={table}
        isLoading={query.isPending}
        emptyMessage={!q && categoryId === "all" && stock === "all" ? t("empty") : undefined}
        onRowClick={
          isAdmin
            ? (row) =>
                router.push(
                  row.familyId ? `/products/families/${row.familyId}` : `/products/${row.id}`,
                )
            : undefined
        }
      />
      {query.data && (
        <Pagination
          page={query.data.page}
          pageCount={query.data.pageCount}
          total={query.data.total}
          onPageChange={setPage}
        />
      )}
    </>
  );
}
