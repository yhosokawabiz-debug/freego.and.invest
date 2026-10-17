// Paidy API（https://paidy.com/docs/jp/）
// フロー: ブラウザで paidy.js のチェックアウトを開く → 承認されると payment_id(pay_...) が返る
//        → サーバーで金額・状態を検証して capture する（capture しないと売上確定しない）

const PAIDY_API = "https://api.paidy.com";
const PAIDY_VERSION = "2018-04-10";

export type PaidyPayment = {
  id: string;
  status: "authorized" | "closed" | "rejected";
  amount: number;
  currency: string;
  order: { order_ref?: string };
};

async function paidyFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const key = process.env.PAIDY_SECRET_KEY;
  if (!key) throw new Error("PAIDY_SECRET_KEY が未設定です");
  const res = await fetch(`${PAIDY_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Paidy-Version": PAIDY_VERSION,
      Authorization: `Bearer ${key}`,
      ...init?.headers,
    },
  });
  if (!res.ok) throw new Error(`Paidy API ${path} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const paidy = {
  retrieve: (paymentId: string) => paidyFetch<PaidyPayment>(`/payments/${encodeURIComponent(paymentId)}`),
  capture: (paymentId: string) =>
    paidyFetch<PaidyPayment>(`/payments/${encodeURIComponent(paymentId)}/captures`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  close: (paymentId: string) =>
    paidyFetch<PaidyPayment>(`/payments/${encodeURIComponent(paymentId)}/close`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
};
