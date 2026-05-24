"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { CartLine } from "@/types";

type CartContextValue = {
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  addLine: (line: Omit<CartLine, "lineId">) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  updateNote: (lineId: string, note: string) => void;
  removeLine: (lineId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const lineTotal = (l: CartLine) =>
  l.quantity *
  (parseFloat(l.unitPrice) +
    l.options.reduce((s, o) => s + parseFloat(o.price), 0));

export function CartProvider({
  branchId,
  tableNo,
  children,
}: {
  branchId: string;
  tableNo: string;
  children: React.ReactNode;
}) {
  const storageKey = `rms-cart:${branchId}:${tableNo}`;
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage on mount / key change.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setLines(raw ? (JSON.parse(raw) as CartLine[]) : []);
    } catch {
      setLines([]);
    }
    setHydrated(true);
  }, [storageKey]);

  // Persist on change (after initial hydration).
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(storageKey, JSON.stringify(lines));
  }, [lines, storageKey, hydrated]);

  const addLine = useCallback((line: Omit<CartLine, "lineId">) => {
    setLines((prev) => [
      ...prev,
      { ...line, lineId: crypto.randomUUID() },
    ]);
  }, []);

  const updateQuantity = useCallback((lineId: string, quantity: number) => {
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.lineId !== lineId)
        : prev.map((l) => (l.lineId === lineId ? { ...l, quantity } : l)),
    );
  }, []);

  const updateNote = useCallback((lineId: string, note: string) => {
    setLines((prev) =>
      prev.map((l) => (l.lineId === lineId ? { ...l, note } : l)),
    );
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setLines((prev) => prev.filter((l) => l.lineId !== lineId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      itemCount: lines.reduce((s, l) => s + l.quantity, 0),
      subtotal: lines.reduce((s, l) => s + lineTotal(l), 0),
      addLine,
      updateQuantity,
      updateNote,
      removeLine,
      clear,
    }),
    [lines, addLine, updateQuantity, updateNote, removeLine, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
