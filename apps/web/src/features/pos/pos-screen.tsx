"use client";

import { Layers, Loader2, Printer, ScanBarcode, ShoppingCart, Wallet, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useMoney } from "@/hooks/use-settings";
import { ApiError } from "@/lib/api-client";
import { Link, useRouter } from "@/i18n/navigation";
import { RECEIPT_NUMBER } from "@/lib/print-settings";
import { usePrintReceipt } from "../sales/use-print-receipt";
import { cn } from "@/lib/utils";
import { CustomerPicker, type PickedCustomer } from "../customers/customer-picker";
import { fetchProductByBarcode, useProducts } from "../products/api";
import { type Sale, useCreateSale } from "../sales/api";
import { Receipt } from "../sales/receipt";
import { useCurrentShift } from "../shifts/api";
import { CartPanel } from "./cart-panel";
import { CheckoutDialog } from "./checkout-dialog";
import { useCurrentUser } from "@/hooks/use-current-user";
import { LinkBarcodeDialog } from "./link-barcode-dialog";
import { PriceDialog } from "./price-dialog";
import { QuickKeysPanel } from "./quick-keys-panel";
import { CameraScanButton } from "../scanner/camera-scanner";
import { type CartProduct, isService, quantityInCart, useCart } from "./use-cart";
import { VariantPicker } from "./variant-picker";
import { WeightDialog } from "./weight-dialog";
import {
  formatQuantity,
  formatWithUnit,
  isMeasured,
  round3,
  UNIT_SYMBOLS,
  type Unit,
} from "@/lib/quantity";

export function PosScreen() {
  const t = useTranslations("pos");
  const tb = useTranslations("banner");
  const money = useMoney();
  const shift = useCurrentShift();
  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const errorMessage = useErrorMessage();
  const cart = useCart();
  const createSale = useCreateSale();
  const { printReceipt, printArea, settings: receiptSettings } = usePrintReceipt();
  const router = useRouter();

  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [looking, setLooking] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [completed, setCompleted] = useState<Sale | null>(null);
  const q = useDebouncedValue(search.trim(), 200);
  const products = useProducts({ q: q || undefined, pageSize: 24, sort: "name" });

  const focusInput = () => setTimeout(() => inputRef.current?.focus(), 0);

  // Variants of one product show as a single tile; tapping it asks which.
  const [picking, setPicking] = useState<string | null>(null);
  const tiles = useMemo(() => {
    const rows = products.data?.rows ?? [];
    const out: (
      | { kind: "product"; product: (typeof rows)[number] }
      | {
          kind: "family";
          id: string;
          name: string;
          count: number;
          stock: number;
          minPrice: number;
          maxPrice: number;
        }
    )[] = [];
    const families = new Map<string, Extract<(typeof out)[number], { kind: "family" }>>();
    for (const p of rows) {
      const one = p.familyId ? rows.filter((r) => r.familyId === p.familyId).length === 1 : true;
      // A search that finds a single variant shows that variant itself.
      if (!p.familyId || (one && q)) {
        out.push({ kind: "product", product: p });
        continue;
      }
      const tile = families.get(p.familyId);
      if (tile) {
        tile.count++;
        tile.stock += Math.max(0, p.stock);
        tile.minPrice = Math.min(tile.minPrice, p.salePrice);
        tile.maxPrice = Math.max(tile.maxPrice, p.salePrice);
        continue;
      }
      const fresh = {
        kind: "family" as const,
        id: p.familyId,
        name: p.familyName ?? p.name,
        count: 1,
        stock: Math.max(0, p.stock),
        minPrice: p.salePrice,
        maxPrice: p.salePrice,
      };
      families.set(p.familyId, fresh);
      out.push(fresh);
    }
    return out;
  }, [products.data, q]);

  const { isAdmin } = useCurrentUser();
  const [linking, setLinking] = useState<string | null>(null);

  // Open-price products ask for the price, weighed ones for the weight.
  const [pricing, setPricing] = useState<CartProduct | null>(null);
  const [weighing, setWeighing] = useState<{ product: CartProduct; unitPrice?: number } | null>(
    null,
  );

  const addToCart = useCallback(
    (product: CartProduct, quantity?: number, unitPrice?: number) => {
      if (product.openPrice && unitPrice === undefined) {
        setPricing(product);
        return;
      }
      if (quantity === undefined && isMeasured(product.unit)) {
        setWeighing({ product, unitPrice });
        return;
      }
      const qty = quantity ?? 1;
      const inCart = quantityInCart(cart.lines, product.id);
      if (!isService(product) && round3(product.stock - inCart - qty) < 0) {
        toast.error(t("notEnoughStock", { available: formatQuantity(product.stock) }));
        return;
      }
      cart.add(product, qty, unitPrice);
    },
    [cart, t, setPricing, setWeighing],
  );

  // Barcode scanners type the code then press Enter.
  const onEnter = async (scanned?: string) => {
    const code = (scanned ?? search).trim();
    if (!code) return;
    setLooking(true);
    try {
      const product = await fetchProductByBarcode(code);
      // A scale label carries the weight: add it as is.
      addToCart(product, product.scaleQuantity ?? undefined);
      setSearch("");
    } catch (err) {
      const only = products.data?.rows.length === 1 ? products.data.rows[0] : null;
      if (err instanceof ApiError && err.code === "NOT_FOUND" && only && q === code) {
        addToCart(only);
        setSearch("");
      } else if (
        err instanceof ApiError &&
        err.code === "NOT_FOUND" &&
        RECEIPT_NUMBER.test(code.toUpperCase())
      ) {
        // A receipt was scanned: open its sale (returns, reprint).
        router.push(`/sales?receipt=${encodeURIComponent(code.toUpperCase())}`);
        setSearch("");
      } else if (err instanceof ApiError && err.code === "NOT_FOUND") {
        // An admin can attach the unknown barcode to an existing product.
        toast.error(t("productNotFound", { code }), {
          action: isAdmin
            ? { label: t("linkBarcode"), onClick: () => setLinking(code) }
            : undefined,
        });
      } else {
        toast.error(errorMessage(err));
      }
    } finally {
      setLooking(false);
      focusInput();
    }
  };

  const completeSale = (payment: {
    paymentMethod: "cash" | "card" | "other" | "credit";
    amountPaid: number;
    note?: string;
  }) => {
    createSale.mutate(
      {
        items: cart.lines.map((l) => ({
          productId: l.product.id,
          quantity: l.quantity,
          discount: l.discount,
          ...(l.unitPrice !== undefined ? { unitPrice: l.unitPrice } : {}),
        })),
        discount: cart.discount,
        customerId: customer?.id ?? null,
        ...payment,
      },
      {
        onSuccess: (sale) => {
          toast.success(t("saleCompleted", { id: sale.number }));
          cart.clear();
          setCustomer(null);
          setCheckoutOpen(false);
          setCartOpen(false);
          setCompleted(sale);
          if (receiptSettings.autoPrint === "always") printReceipt(sale);
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  const openCheckout = () => {
    setCartOpen(false);
    setCheckoutOpen(true);
  };

  return (
    <div className="-m-4 flex h-[calc(100dvh-3.5rem)] md:-m-6">
      {/* Product search & grid */}
      <section className="flex min-w-0 flex-1 flex-col gap-4 p-4 md:p-6">
        {shift.isSuccess && !shift.data && (
          <div className="border-warning/40 bg-warning/10 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <Wallet className="size-4" />
            <span className="flex-1">{tb("openShift")}</span>
            <Button asChild size="sm" variant="outline">
              <Link href="/shifts">{tb("openShiftAction")}</Link>
            </Button>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onEnter();
          }}
          className="relative"
        >
          <ScanBarcode className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2" />
          <Input
            ref={inputRef}
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("scanPlaceholder")}
            className="h-12 ps-11 pe-12 text-base"
            aria-label={t("scanPlaceholder")}
          />
          {looking ? (
            <Loader2 className="text-muted-foreground absolute end-3 top-1/2 size-5 -translate-y-1/2 animate-spin" />
          ) : (
            <CameraScanButton
              className="absolute end-1.5 top-1/2 -translate-y-1/2"
              onScan={(scanned) => void onEnter(scanned)}
            />
          )}
        </form>

        <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto pb-20 lg:pb-0">
          {!q && (
            <QuickKeysPanel
              onPick={(p) => {
                addToCart(p);
                focusInput();
              }}
            />
          )}
          {products.isPending ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : products.data?.rows.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              {t("productNotFound", { code: q })}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {tiles.map((tile) => {
                if (tile.kind === "family") {
                  return (
                    <button
                      key={`f-${tile.id}`}
                      type="button"
                      disabled={tile.stock <= 0}
                      onClick={() => setPicking(tile.id)}
                      className="bg-card hover:border-primary hover:bg-accent focus-visible:ring-ring/50 flex h-full flex-col justify-between gap-2 rounded-lg border p-3 text-start shadow-xs transition-colors focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="flex flex-col gap-0.5">
                        <span className="line-clamp-2 text-sm font-medium">{tile.name}</span>
                        <span className="text-muted-foreground flex items-center gap-1 text-xs">
                          <Layers className="size-3" />
                          {t("variantCount", { count: tile.count })}
                        </span>
                      </span>
                      <span className="flex items-end justify-between gap-2">
                        <span className="font-semibold tabular-nums">
                          {money.format(tile.minPrice)}
                          {tile.maxPrice > tile.minPrice && "+"}
                        </span>
                        {tile.stock <= 0 ? (
                          <Badge variant="destructive">{t("outOfStock")}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs tabular-nums">
                            {t("inStock", { count: tile.stock })}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                }
                const p = tile.product;
                const service = isService(p);
                const out = !service && p.stock <= 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={out}
                    onClick={() => {
                      addToCart(p);
                      focusInput();
                    }}
                    className={cn(
                      "bg-card hover:border-primary hover:bg-accent focus-visible:ring-ring/50 flex h-full flex-col justify-between gap-2 rounded-lg border p-3 text-start shadow-xs transition-colors focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                    )}
                  >
                    <span className="line-clamp-2 text-sm font-medium">{p.name}</span>
                    <span className="flex items-end justify-between gap-2">
                      <span className="font-semibold tabular-nums">
                        {p.openPrice && p.salePrice === 0 ? (
                          <span className="text-sm">{t("priceAtTill")}</span>
                        ) : (
                          money.format(p.salePrice)
                        )}
                        {isMeasured(p.unit) && (
                          <span className="text-muted-foreground text-xs font-normal">
                            {" "}
                            / {UNIT_SYMBOLS[p.unit as Unit]}
                          </span>
                        )}
                      </span>
                      {service ? (
                        <Badge variant="secondary" className="font-normal">
                          <Wrench className="size-3" />
                          {t("service")}
                        </Badge>
                      ) : out ? (
                        <Badge variant="destructive">{t("outOfStock")}</Badge>
                      ) : (
                        <span
                          className={cn(
                            "text-muted-foreground text-xs tabular-nums",
                            p.stock <= p.lowStockThreshold && "text-warning",
                          )}
                        >
                          {isMeasured(p.unit)
                            ? t("inStockMeasured", {
                                amount: formatWithUnit(p.stock, p.unit),
                              })
                            : t("inStock", { count: p.stock })}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Cart: side panel on desktop */}
      <aside className="bg-card hidden w-96 shrink-0 border-s lg:flex">
        <CartPanel
          cart={cart}
          onCheckout={openCheckout}
          className="w-full"
          top={<CustomerPicker value={customer} onChange={setCustomer} />}
        />
      </aside>

      {/* Cart: bottom bar + sheet on mobile/tablet */}
      <div className="bg-background fixed inset-x-0 bottom-0 z-20 border-t p-3 lg:hidden">
        <Button
          size="lg"
          className="h-12 w-full justify-between text-base"
          onClick={() => setCartOpen(true)}
        >
          <span className="flex items-center gap-2">
            <ShoppingCart />
            {t("items", { count: cart.itemCount })}
          </span>
          <span className="tabular-nums">{money.format(cart.total)}</span>
        </Button>
      </div>
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="bottom" className="h-[85dvh] p-0">
          <SheetTitle className="sr-only">{t("cart")}</SheetTitle>
          <CartPanel
            cart={cart}
            onCheckout={openCheckout}
            className="h-full"
            headerClassName="pe-12"
            top={<CustomerPicker value={customer} onChange={setCustomer} />}
          />
        </SheetContent>
      </Sheet>

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        total={cart.total}
        customer={customer}
        isPending={createSale.isPending}
        onConfirm={completeSale}
      />

      <Dialog
        open={!!completed}
        onOpenChange={(open) => {
          if (!open) {
            setCompleted(null);
            focusInput();
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{completed && t("saleCompleted", { id: completed.number })}</DialogTitle>
          </DialogHeader>
          {completed && (
            <>
              {completed.balanceDue > 0 && (
                <div className="bg-warning/10 rounded-lg p-3 text-center text-sm">
                  {t("onAccount")}:{" "}
                  <span className="font-semibold tabular-nums">
                    {money.format(completed.balanceDue)}
                  </span>
                  {completed.customerName ? ` · ${completed.customerName}` : ""}
                </div>
              )}
              {completed.changeDue > 0 && (
                <div className="bg-success/10 rounded-lg p-4 text-center">
                  <div className="text-muted-foreground text-sm">{t("change")}</div>
                  <div className="text-success text-3xl font-bold tabular-nums">
                    {money.format(completed.changeDue)}
                  </div>
                </div>
              )}
              {receiptSettings.autoPrint !== "never" && (
                <div className="max-h-72 overflow-y-auto rounded-md border bg-white">
                  <Receipt sale={completed} />
                </div>
              )}
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => completed && printReceipt(completed)}>
              <Printer />
              {t("printReceipt")}
            </Button>
            <Button
              autoFocus
              onClick={() => {
                setCompleted(null);
                focusInput();
              }}
            >
              {t("newSale")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {printArea}
      <VariantPicker
        familyId={picking}
        onClose={() => {
          setPicking(null);
          focusInput();
        }}
        onPick={(product) => {
          addToCart(product);
          setPicking(null);
          focusInput();
        }}
      />
      <LinkBarcodeDialog
        code={linking}
        onClose={() => {
          setLinking(null);
          focusInput();
        }}
        onLinked={(product) => {
          setLinking(null);
          addToCart(product);
          focusInput();
        }}
      />
      <PriceDialog
        product={pricing}
        onClose={() => {
          setPricing(null);
          focusInput();
        }}
        onConfirm={(unitPrice) => {
          if (pricing) addToCart(pricing, undefined, unitPrice);
          setPricing(null);
          focusInput();
        }}
      />
      <WeightDialog
        product={
          weighing && {
            ...weighing.product,
            salePrice: weighing.unitPrice ?? weighing.product.salePrice,
          }
        }
        onClose={() => {
          setWeighing(null);
          focusInput();
        }}
        onConfirm={(quantity) => {
          if (weighing) addToCart(weighing.product, quantity, weighing.unitPrice);
          setWeighing(null);
          focusInput();
        }}
      />
    </div>
  );
}
