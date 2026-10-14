"use client";

import { useCallback, useEffect, useMemo, useReducer } from "react";
import { isMeasured, lineAmount, round3 } from "@/lib/quantity";

export type CartProduct = {
  id: string;
  name: string;
  barcode: string;
  salePrice: number;
  stock: number;
  /** piece, or a measured unit (kg, g, l, m) sold in fractions. */
  unit?: string;
  /** Services have no stock to check. */
  kind?: string;
  /** The price is typed at the till. */
  openPrice?: boolean;
};

export type CartLine = {
  /** The product id, plus the typed price for open-price products. */
  key: string;
  product: CartProduct;
  quantity: number;
  discount: number;
  /** Price typed at the till (open-price products). */
  unitPrice?: number;
};

export const isService = (p: Pick<CartProduct, "kind">) => p.kind === "service";
/** Unit price of a line: the typed one, or the product's. */
export const linePrice = (l: Pick<CartLine, "product" | "unitPrice">) =>
  l.unitPrice ?? l.product.salePrice;

type State = { lines: CartLine[]; discount: number };

type Action =
  | { type: "add"; product: CartProduct; quantity?: number; unitPrice?: number }
  | { type: "setQuantity"; key: string; quantity: number }
  | { type: "setLineDiscount"; key: string; discount: number }
  | { type: "remove"; key: string }
  | { type: "setDiscount"; discount: number }
  | { type: "clear" }
  | { type: "hydrate"; state: State };

const empty: State = { lines: [], discount: 0 };
const STORAGE_KEY = "tayssir.pos.cart.v3";

const keyOf = (product: CartProduct, unitPrice?: number) =>
  product.openPrice && unitPrice !== undefined ? `${product.id}:${unitPrice}` : product.id;

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "add": {
      const key = keyOf(action.product, action.unitPrice);
      const existing = state.lines.find((l) => l.key === key);
      if (existing) {
        return {
          ...state,
          lines: state.lines.map((l) =>
            l.key === key
              ? {
                  ...l,
                  product: action.product,
                  quantity: round3(l.quantity + (action.quantity ?? 1)),
                }
              : l,
          ),
        };
      }
      return {
        ...state,
        lines: [
          ...state.lines,
          {
            key,
            product: action.product,
            quantity: action.quantity ?? 1,
            discount: 0,
            ...(action.product.openPrice && action.unitPrice !== undefined
              ? { unitPrice: action.unitPrice }
              : {}),
          },
        ],
      };
    }
    case "setQuantity":
      if (action.quantity <= 0) {
        return { ...state, lines: state.lines.filter((l) => l.key !== action.key) };
      }
      return {
        ...state,
        lines: state.lines.map((l) =>
          l.key === action.key ? { ...l, quantity: round3(action.quantity) } : l,
        ),
      };
    case "setLineDiscount":
      return {
        ...state,
        lines: state.lines.map((l) =>
          l.key === action.key
            ? {
                ...l,
                discount: Math.max(
                  0,
                  Math.min(action.discount, lineAmount(linePrice(l), l.quantity)),
                ),
              }
            : l,
        ),
      };
    case "remove":
      return { ...state, lines: state.lines.filter((l) => l.key !== action.key) };
    case "setDiscount":
      return { ...state, discount: Math.max(0, action.discount) };
    case "clear":
      return empty;
    case "hydrate":
      return action.state;
  }
}

/** Quantity of a product already in the cart, over all its lines. */
export const quantityInCart = (lines: CartLine[], productId: string) =>
  round3(lines.filter((l) => l.product.id === productId).reduce((s, l) => s + l.quantity, 0));

/** POS cart state, persisted locally so a refresh doesn't lose a sale in progress. */
export function useCart() {
  const [state, dispatch] = useReducer(reducer, empty);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "hydrate", state: JSON.parse(raw) as State });
    } catch {
      /* ignore corrupted storage */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage may be unavailable */
    }
  }, [state]);

  const totals = useMemo(() => {
    const subtotal = state.lines.reduce(
      (sum, l) => sum + lineAmount(linePrice(l), l.quantity) - l.discount,
      0,
    );
    const discount = Math.min(state.discount, subtotal);
    // A weighed line counts as one item (0.75 kg of tomatoes = 1 item).
    const itemCount = state.lines.reduce(
      (sum, l) => sum + (isMeasured(l.product.unit) ? 1 : l.quantity),
      0,
    );
    return { subtotal, discount, total: subtotal - discount, itemCount };
  }, [state]);

  return {
    lines: state.lines,
    ...totals,
    add: useCallback(
      (product: CartProduct, quantity?: number, unitPrice?: number) =>
        dispatch({ type: "add", product, quantity, unitPrice }),
      [],
    ),
    setQuantity: useCallback(
      (key: string, quantity: number) => dispatch({ type: "setQuantity", key, quantity }),
      [],
    ),
    setLineDiscount: useCallback(
      (key: string, discount: number) => dispatch({ type: "setLineDiscount", key, discount }),
      [],
    ),
    remove: useCallback((key: string) => dispatch({ type: "remove", key }), []),
    setDiscount: useCallback((discount: number) => dispatch({ type: "setDiscount", discount }), []),
    clear: useCallback(() => dispatch({ type: "clear" }), []),
  };
}

export type Cart = ReturnType<typeof useCart>;
