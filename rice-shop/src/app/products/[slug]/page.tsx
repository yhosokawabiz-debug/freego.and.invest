import { notFound } from "next/navigation";
import { getProduct, PRODUCTS } from "@/lib/catalog";
import { ProductForm } from "@/components/ProductForm";

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  return (
    <div className="two-col">
      <div>
        <div className="thumb" style={{ fontSize: "6rem" }} aria-hidden>🌾</div>
        <h1 style={{ marginBottom: 0 }}>{product.name}</h1>
        <div className="muted">{product.origin}・{product.harvestYear}年産</div>
        <p>{product.description}</p>
        <p className="notice">
          ご注文確定後に精米し、精米日を記載して発送します。お届け希望日は注文日の 3 日後から指定できます。
        </p>
      </div>
      <ProductForm product={product} />
    </div>
  );
}
