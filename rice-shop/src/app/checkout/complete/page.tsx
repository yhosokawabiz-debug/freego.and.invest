import Link from "next/link";
import { ClearCart } from "@/components/ClearCart";
import { yen } from "@/lib/catalog";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const STATUS_MESSAGES: Record<string, string> = {
  paid: "お支払いが完了しました。精米後、発送準備に入ります。",
  awaiting_payment: "ご注文を受け付けました。お支払いの確認後に発送いたします。",
  pending: "決済の確認中です。確認でき次第メールでお知らせします。",
  failed: "お支払いが完了しませんでした。お手数ですが再度ご注文ください。",
};

const METHOD_NOTES: Record<string, string> = {
  konbini: "コンビニでのお支払い番号はメールでもお送りしています。期限内にお支払いください。",
  customer_balance: "お振込先の口座情報はメールでもお送りしています。",
  np_atobarai: "請求書は商品とは別に郵送されます。発行から14日以内にお支払いください。",
  paidy: "ペイディのご請求は翌月にまとめてお知らせします。",
};

export default async function CompletePage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; redirect_status?: string }>;
}) {
  const { order: orderId, redirect_status } = await searchParams;
  const order = orderId ? await prisma.order.findUnique({ where: { id: orderId } }) : null;
  if (!order) return <p>ご注文が見つかりません。<Link href="/">トップへ戻る</Link></p>;

  // Webhook より先にリダイレクトされることがあるため、リダイレクト結果も考慮する
  const status = redirect_status === "failed" ? "failed" : order.status;
  const succeeded = status !== "failed";

  return (
    <div className="card" style={{ maxWidth: 640, margin: "0 auto" }}>
      {succeeded && <ClearCart />}
      <h1>{succeeded ? "ご注文ありがとうございます" : "お支払いが完了していません"}</h1>
      <p>ご注文番号: <strong>{order.orderNumber}</strong></p>
      <p>合計金額: {yen(order.total)}（税込）</p>
      <p>{STATUS_MESSAGES[status] ?? STATUS_MESSAGES.pending}</p>
      {order.paymentMethod && METHOD_NOTES[order.paymentMethod] && <p className="notice">{METHOD_NOTES[order.paymentMethod]}</p>}
      <p className="muted">ご注文確認メールを {order.email} にお送りします。</p>
      <Link href="/" className="btn">トップへ戻る</Link>
    </div>
  );
}
