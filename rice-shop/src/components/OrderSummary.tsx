import { POLISH_LABELS, PURCHASE_TYPE_LABELS, yen, type Quote } from "@/lib/catalog";

export function OrderSummary({ quote }: { quote: Quote }) {
  return (
    <div className="card">
      <h3>ご注文内容</h3>
      {quote.lines.map((l, i) => (
        <div key={i} className="summary-line">
          <span>
            {l.productName} {l.weightKg}kg・{POLISH_LABELS[l.polish]}
            <br />
            <span className="muted">{PURCHASE_TYPE_LABELS[l.purchaseType]} × {l.quantity}</span>
          </span>
          <span>{yen(l.lineTotal)}</span>
        </div>
      ))}
      <div className="summary-line"><span>小計</span><span>{yen(quote.subtotal)}</span></div>
      <div className="summary-line"><span>送料</span><span>{quote.shippingFee === 0 ? "無料" : yen(quote.shippingFee)}</span></div>
      <div className="summary-line summary-total"><span>合計（税込）</span><span>{yen(quote.total)}</span></div>
      {quote.subscriptionInterval && (
        <p className="muted" style={{ marginBottom: 0 }}>
          定期便の商品は、2回目以降も{quote.subscriptionInterval === "monthly" ? "毎月" : "2ヶ月ごと"}同じ金額で自動決済されます。
        </p>
      )}
    </div>
  );
}
