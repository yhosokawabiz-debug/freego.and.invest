import { NP_ATOBARAI_LIMIT, type Quote } from "./catalog";

// 画面で選ぶ決済グループ。Stripe グループ内の具体的な手段（カード / Apple Pay /
// Google Pay / コンビニ / 銀行振込 / PayPay）は Stripe Dashboard で有効化したものが
// Payment Element に自動表示される。
export type PaymentChoice = "stripe" | "paidy" | "np_atobarai";

export const PAYMENT_CHOICES: { id: PaymentChoice; label: string; note: string }[] = [
  {
    id: "stripe",
    label: "クレジットカード・Apple Pay・Google Pay・PayPay・コンビニ・銀行振込",
    note: "Stripe による安全な決済",
  },
  { id: "paidy", label: "あと払い（ペイディ）", note: "翌月まとめてコンビニ・口座振替・銀行振込でお支払い" },
  { id: "np_atobarai", label: "NP後払い（請求書）", note: "商品到着後、届いた請求書でコンビニ・銀行・郵便局から" },
];

/** 注文内容に対して使えない決済手段とその理由 */
export function unavailableReason(choice: PaymentChoice, quote: Quote): string | null {
  if (choice === "stripe") return null;
  if (quote.subscriptionInterval) return "定期便はクレジットカード等（Stripe）のみご利用いただけます";
  if (choice === "np_atobarai" && quote.total > NP_ATOBARAI_LIMIT) {
    return `NP後払いはご注文金額 ¥${NP_ATOBARAI_LIMIT.toLocaleString()} までです`;
  }
  return null;
}
