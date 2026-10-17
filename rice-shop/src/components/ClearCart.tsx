"use client";

import { useEffect } from "react";
import { cart } from "@/lib/cart-store";

export function ClearCart() {
  useEffect(() => cart.clear(), []);
  return null;
}
