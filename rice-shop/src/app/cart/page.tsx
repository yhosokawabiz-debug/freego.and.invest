"use client";

import Link from "next/link";
import { cart, useCart } from "@/lib/cart-store";
import { CartError, POLISH_LABELS, PURCHASE_TYPE_LABELS, quoteCart, yen } from "@/lib/catalog";
import { OrderSummary } from "@/components/OrderSummary";

export default function CartPage() {
  const lines = useCart();
  if (lines.length === 0) {
    return (
      <>
        <h1>カート</h1>
        <p>カートは空です。</p>
        <Link href="/" className="btn">お米を選ぶ</Link>
      </>
    );
  }

  let error: string | null = null;
  let quote = null;
  try {
    quote = quoteCart(lines);
  } catch (err) {
    if (!(err instanceof CartError)) throw err;
    error = err.message;
  }

  return (
    <>
      <h1>カート</h1>
      <div className="two-col">
        <table>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td>
                  {quote?.lines[i]?.productName ?? l.productSlug} {l.weightKg}kg・{POLISH_LABELS[l.polish]}
                  <div className="muted">{PURCHASE_TYPE_LABELS[l.purchaseType]}</div>
                </td>
                <td style={{ width: 90 }}>
                  <select value={l.quantity} onChange={(e) => cart.setQuantity(i, Number(e.target.value))} aria-label="数量">
                    {Array.from({ length: 20 }, (_, n) => n + 1).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </td>
                <td style={{ width: 100, textAlign: "right" }}>{quote ? yen(quote.lines[i].lineTotal) : "-"}</td>
                <td style={{ width: 60 }}>
                  <button type="button" className="option" onClick={() => cart.remove(i)}>削除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div>
          {quote && <OrderSummary quote={quote} />}
          {error && <p className="error">{error}</p>}
          <Link
            href="/checkout"
            className="btn btn-block"
            style={{ marginTop: 12, pointerEvents: error ? "none" : undefined, opacity: error ? 0.5 : 1 }}
            aria-disabled={Boolean(error)}
          >
            ご購入手続きへ
          </Link>
        </div>
      </div>
    </>
  );
}
