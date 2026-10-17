"use client";

import { useSyncExternalStore } from "react";
import type { CartLine } from "./catalog";

const KEY = "rice-cart-v1";
const EMPTY: CartLine[] = [];
const listeners = new Set<() => void>();
let cache: CartLine[] | null = null;

function read(): CartLine[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as CartLine[]) : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(next: CartLine[]) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ストレージが使えない環境ではメモリ上のみで保持
  }
  listeners.forEach((l) => l());
}

const sameVariant = (a: CartLine, b: CartLine) =>
  a.productSlug === b.productSlug && a.weightKg === b.weightKg && a.polish === b.polish && a.purchaseType === b.purchaseType;

export const cart = {
  add(line: CartLine) {
    const lines = read();
    const existing = lines.find((l) => sameVariant(l, line));
    write(
      existing
        ? lines.map((l) => (l === existing ? { ...l, quantity: Math.min(20, l.quantity + line.quantity) } : l))
        : [...lines, line],
    );
  },
  setQuantity(index: number, quantity: number) {
    write(read().map((l, i) => (i === index ? { ...l, quantity } : l)));
  },
  remove(index: number) {
    write(read().filter((_, i) => i !== index));
  },
  clear() {
    write(EMPTY);
  },
};

export function useCart(): CartLine[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => EMPTY,
  );
}
