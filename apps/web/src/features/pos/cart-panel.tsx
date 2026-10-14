"use client";

import { Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useMoney } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";
import type { Cart } from "./use-cart";

export function CartPanel({
  cart,
  onCheckout,
  className,
  headerClassName,
  top,
}: {
  cart: Cart;
  onCheckout: () => void;
  className?: string;
  headerClassName?: string;
  /** Rendered under the header (customer selector). */
  top?: React.ReactNode;
}) {
  const t = useTranslations("pos");
  const money = useMoney();

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className={cn("flex items-center justify-between px-4 py-3", headerClassName)}>
        <h2 className="flex items-center gap-2 font-semibold">
          <ShoppingCart className="size-4" />
          {t("cart")}
          <span className="text-muted-foreground text-sm font-normal">
            ({t("items", { count: cart.itemCount })})
          </span>
        </h2>
        {cart.lines.length > 0 && (
          <Button variant="ghost" size="sm" onClick={cart.clear}>
            <Trash2 />
            {t("clearCart")}
          </Button>
        )}
      </div>
      <Separator />
      {top && <div className="border-b p-3">{top}</div>}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {cart.lines.length === 0 ? (
          <p className="text-muted-foreground p-6 text-center text-sm">{t("emptyCart")}</p>
        ) : (
          <ul className="divide-y">
            {cart.lines.map(({ product, quantity, discount }) => {
              const over = quantity > product.stock;
              return (
                <li key={product.id} className="grid gap-2 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{product.name}</p>
                      <p className="text-muted-foreground text-xs tabular-nums">
                        {money.format(product.salePrice)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="-me-2 -mt-1"
                      onClick={() => cart.remove(product.id)}
                      aria-label="remove"
                    >
                      <X />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => cart.setQuantity(product.id, quantity - 1)}
                        aria-label="-1"
                      >
                        <Minus />
                      </Button>
                      <Input
                        aria-label={t("qty")}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={quantity}
                        onChange={(e) =>
                          cart.setQuantity(product.id, Math.floor(Number(e.target.value)) || 0)
                        }
                        className={cn(
                          "h-8 w-14 text-center tabular-nums",
                          over && "border-destructive",
                        )}
                      />
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => cart.setQuantity(product.id, quantity + 1)}
                        aria-label="+1"
                      >
                        <Plus />
                      </Button>
                    </div>
                    <span className="font-semibold tabular-nums">
                      {money.format(product.salePrice * quantity - discount)}
                    </span>
                  </div>
                  {over && (
                    <p className="text-destructive text-xs">
                      {t("notEnoughStock", { available: product.stock })}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Separator />
      <div className="grid gap-2 p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("subtotal")}</span>
          <span className="tabular-nums">{money.format(cart.subtotal)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="cart-discount" className="text-muted-foreground">
            {t("discount")}
          </label>
          <Input
            id="cart-discount"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={cart.discount ? money.toMajor(cart.discount) : ""}
            placeholder="0"
            onChange={(e) => cart.setDiscount(money.toMinor(Number(e.target.value) || 0))}
            className="h-8 w-28 text-end tabular-nums"
          />
        </div>
        <div className="flex justify-between text-lg font-semibold">
          <span>{t("total")}</span>
          <span className="tabular-nums">{money.format(cart.total)}</span>
        </div>
        <Button
          size="lg"
          className="mt-2 h-12 text-base"
          disabled={cart.lines.length === 0 || cart.lines.some((l) => l.quantity > l.product.stock)}
          onClick={onCheckout}
        >
          {t("charge", { amount: money.format(cart.total) })}
        </Button>
      </div>
    </div>
  );
}
