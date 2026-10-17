import Link from "next/link";
import { FREE_SHIPPING_THRESHOLD, PRODUCTS, SHIPPING_FEE, unitPrice, yen } from "@/lib/catalog";

export default function Home() {
  return (
    <>
      <section style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 4 }}>ご注文を受けてから精米してお届け</h1>
        <p className="muted">
          全国の契約農家から、令和8年産の新米を産地直送。定期便は 5% オフ・送料無料。
          通常購入は {yen(FREE_SHIPPING_THRESHOLD)} 以上で送料無料（未満は {yen(SHIPPING_FEE)}）。
        </p>
      </section>
      <div className="grid">
        {PRODUCTS.map((p) => (
          <Link key={p.slug} href={`/products/${p.slug}`} className="card" style={{ color: "inherit", textDecoration: "none" }}>
            <div className="thumb" aria-hidden>🌾</div>
            <h2>{p.name}</h2>
            <div className="muted">{p.origin}・{p.harvestYear}年産</div>
            <div className="price">{yen(unitPrice(p, 5, "white", "once"))}<span className="muted"> / 5kg〜</span></div>
            {!p.inStock && <div className="error">在庫切れ</div>}
          </Link>
        ))}
      </div>
    </>
  );
}
