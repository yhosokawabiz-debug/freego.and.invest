"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-store";

export function CartLink() {
  const count = useCart().reduce((n, l) => n + l.quantity, 0);
  return <Link href="/cart" className="btn btn-secondary">カート（{count}）</Link>;
}
