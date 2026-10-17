"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cart } from "@/lib/cart-store";
import {
  POLISH_LABELS,
  PURCHASE_TYPE_LABELS,
  SUBSCRIPTION_DISCOUNT,
  unitPrice,
  yen,
  type Polish,
  type Product,
  type PurchaseType,
} from "@/lib/catalog";

export function ProductForm({ product }: { product: Product }) {
  const router = useRouter();
  const [weightKg, setWeightKg] = useState(product.weights.includes(5) ? 5 : product.weights[0]);
  const [polish, setPolish] = useState<Polish>(product.polishes[0]);
  const [purchaseType, setPurchaseType] = useState<PurchaseType>("once");
  const [quantity, setQuantity] = useState(1);

  const price = unitPrice(product, weightKg, polish, purchaseType);

  const addToCart = () => {
    cart.add({ productSlug: product.slug, weightKg, polish, purchaseType, quantity });
    router.push("/cart");
  };

  return (
    <div className="card">
      <div className="field">
        <label>容量</label>
        <div className="options">
          {product.weights.map((w) => (
            <button key={w} type="button" className="option" aria-pressed={w === weightKg} onClick={() => setWeightKg(w)}>
              {w}kg
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>精米方法</label>
        <div className="options">
          {product.polishes.map((p) => (
            <button key={p} type="button" className="option" aria-pressed={p === polish} onClick={() => setPolish(p)}>
              {POLISH_LABELS[p]}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>購入方法</label>
        {(Object.keys(PURCHASE_TYPE_LABELS) as PurchaseType[]).map((t) => (
          <label key={t} className="radio-card">
            <input type="radio" name="purchaseType" checked={t === purchaseType} onChange={() => setPurchaseType(t)} />
            <span>
              {PURCHASE_TYPE_LABELS[t]}
              {t !== "once" && (
                <span className="muted">（{SUBSCRIPTION_DISCOUNT * 100}% オフ・送料無料・いつでも解約可）</span>
              )}
            </span>
          </label>
        ))}
      </div>
      <div className="field">
        <label htmlFor="qty">数量</label>
        <select id="qty" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>
      <div className="price" style={{ marginBottom: 12 }}>
        {yen(price * quantity)} <span className="muted">（税込・8%軽減税率）</span>
      </div>
      <button type="button" className="btn btn-block" disabled={!product.inStock} onClick={addToCart}>
        {product.inStock ? "カートに入れる" : "在庫切れ"}
      </button>
    </div>
  );
}
