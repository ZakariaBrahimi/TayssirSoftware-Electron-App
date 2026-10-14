"use client";

import { useCallback, useEffect, useMemo, useReducer } from "react";

export type CartProduct = {
  id: number;
  name: string;
  barcode: string;
  salePrice: number;
  stock: number;
};

export type CartLine = { product: CartProduct; quantity: number; discount: number };

type State = { lines: CartLine[]; discount: number };

type Action =
  | { type: "add"; product: CartProduct; quantity?: number }
  | { type: "setQuantity"; productId: number; quantity: number }
  | { type: "setLineDiscount"; productId: number; discount: number }
  | { type: "remove"; productId: number }
  | { type: "setDiscount"; discount: number }
  | { type: "clear" }
  | { type: "hydrate"; state: State };

const empty: State = { lines: [], discount: 0 };
const STORAGE_KEY = "tayssir.pos.cart";

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "add": {
      const existing = state.lines.find((l) => l.product.id === action.product.id);
      if (existing) {
        return {
          ...state,
          lines: state.lines.map((l) =>
            l.product.id === action.product.id
              ? { ...l, product: action.product, quantity: l.quantity + (action.quantity ?? 1) }
              : l,
          ),
        };
      }
      return {
        ...state,
        lines: [
          ...state.lines,
          { product: action.product, quantity: action.quantity ?? 1, discount: 0 },
        ],
      };
    }
    case "setQuantity":
      if (action.quantity <= 0) {
        return { ...state, lines: state.lines.filter((l) => l.product.id !== action.productId) };
      }
      return {
        ...state,
        lines: state.lines.map((l) =>
          l.product.id === action.productId ? { ...l, quantity: action.quantity } : l,
        ),
      };
    case "setLineDiscount":
      return {
        ...state,
        lines: state.lines.map((l) =>
          l.product.id === action.productId
            ? {
                ...l,
                discount: Math.max(0, Math.min(action.discount, l.product.salePrice * l.quantity)),
              }
            : l,
        ),
      };
    case "remove":
      return { ...state, lines: state.lines.filter((l) => l.product.id !== action.productId) };
    case "setDiscount":
      return { ...state, discount: Math.max(0, action.discount) };
    case "clear":
      return empty;
    case "hydrate":
      return action.state;
  }
}

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
      (sum, l) => sum + l.product.salePrice * l.quantity - l.discount,
      0,
    );
    const discount = Math.min(state.discount, subtotal);
    const itemCount = state.lines.reduce((sum, l) => sum + l.quantity, 0);
    return { subtotal, discount, total: subtotal - discount, itemCount };
  }, [state]);

  return {
    lines: state.lines,
    ...totals,
    add: useCallback(
      (product: CartProduct, quantity?: number) => dispatch({ type: "add", product, quantity }),
      [],
    ),
    setQuantity: useCallback(
      (productId: number, quantity: number) =>
        dispatch({ type: "setQuantity", productId, quantity }),
      [],
    ),
    setLineDiscount: useCallback(
      (productId: number, discount: number) =>
        dispatch({ type: "setLineDiscount", productId, discount }),
      [],
    ),
    remove: useCallback((productId: number) => dispatch({ type: "remove", productId }), []),
    setDiscount: useCallback((discount: number) => dispatch({ type: "setDiscount", discount }), []),
    clear: useCallback(() => dispatch({ type: "clear" }), []),
  };
}

export type Cart = ReturnType<typeof useCart>;
