"use client";

import { Loader2, Printer, ScanBarcode, ShoppingCart, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";
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
import { usePrint } from "@/hooks/use-print";
import { useMoney } from "@/hooks/use-settings";
import { ApiError } from "@/lib/api-client";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { CustomerPicker, type PickedCustomer } from "../customers/customer-picker";
import { fetchProductByBarcode, useProducts } from "../products/api";
import { type Sale, useCreateSale } from "../sales/api";
import { Receipt } from "../sales/receipt";
import { useCurrentShift } from "../shifts/api";
import { CartPanel } from "./cart-panel";
import { CheckoutDialog } from "./checkout-dialog";
import { type CartProduct, useCart } from "./use-cart";
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
  const { print, printArea } = usePrint();

  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [looking, setLooking] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [completed, setCompleted] = useState<Sale | null>(null);
  const q = useDebouncedValue(search.trim(), 200);
  const products = useProducts({ q: q || undefined, pageSize: 24, sort: "name" });

  const focusInput = () => setTimeout(() => inputRef.current?.focus(), 0);

  // Weighed products clicked or typed in: ask for the weight first.
  const [weighing, setWeighing] = useState<CartProduct | null>(null);

  const addToCart = useCallback(
    (product: CartProduct, quantity?: number) => {
      if (quantity === undefined && isMeasured(product.unit)) {
        setWeighing(product);
        return;
      }
      const qty = quantity ?? 1;
      const inCart = cart.lines.find((l) => l.product.id === product.id)?.quantity ?? 0;
      if (round3(product.stock - inCart - qty) < 0) {
        toast.error(t("notEnoughStock", { available: formatQuantity(product.stock) }));
        return;
      }
      cart.add(product, qty);
    },
    [cart, t, setWeighing],
  );

  // Barcode scanners type the code then press Enter.
  const onEnter = async () => {
    const code = search.trim();
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
      } else if (err instanceof ApiError && err.code === "NOT_FOUND") {
        toast.error(t("productNotFound", { code }));
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
            className="h-12 ps-11 text-base"
            aria-label={t("scanPlaceholder")}
          />
          {looking && (
            <Loader2 className="text-muted-foreground absolute end-3 top-1/2 size-5 -translate-y-1/2 animate-spin" />
          )}
        </form>

        <div className="min-h-0 flex-1 overflow-y-auto pb-20 lg:pb-0">
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
              {products.data?.rows.map((p) => {
                const out = p.stock <= 0;
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
                        {money.format(p.salePrice)}
                        {isMeasured(p.unit) && (
                          <span className="text-muted-foreground text-xs font-normal">
                            {" "}
                            / {UNIT_SYMBOLS[p.unit as Unit]}
                          </span>
                        )}
                      </span>
                      {out ? (
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
              <div className="max-h-72 overflow-y-auto rounded-md border bg-white">
                <Receipt sale={completed} />
              </div>
            </>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => completed && print(<Receipt sale={completed} />)}
            >
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
      <WeightDialog
        product={weighing}
        onClose={() => {
          setWeighing(null);
          focusInput();
        }}
        onConfirm={(quantity) => {
          if (weighing) addToCart(weighing, quantity);
          setWeighing(null);
          focusInput();
        }}
      />
    </div>
  );
}
