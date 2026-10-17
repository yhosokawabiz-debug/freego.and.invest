// NP後払い（株式会社ネットプロテクションズ）連携アダプタ。
// API 仕様書は加盟店契約後に提供されるため、ここでは取引登録の入口だけを定義している。
// 契約後に registerTransaction の中身を仕様書どおり実装すること。
// 一般的な流れ: 取引登録 → 与信結果（OK/NG/保留）→ 出荷後に配送伝票番号を登録 → 請求書発行

import type { Order, OrderItem } from "@prisma/client";

export type NpAuthorizationResult =
  | { result: "ok"; transactionId: string }
  | { result: "pending"; transactionId: string } // 審査保留：後で与信結果を取得
  | { result: "ng"; reason: string };

export function isNpAtobaraiConfigured(): boolean {
  return Boolean(process.env.NP_ATOBARAI_API_URL && process.env.NP_ATOBARAI_MERCHANT_ID);
}

export async function registerTransaction(_order: Order & { items: OrderItem[] }): Promise<NpAuthorizationResult> {
  if (!isNpAtobaraiConfigured()) {
    throw new Error("NP後払いは未設定です（.env の NP_ATOBARAI_* を設定してください）");
  }
  // TODO: 契約後に提供される API 仕様に沿って取引登録リクエストを送信する
  throw new Error("NP後払いの取引登録 API は未実装です");
}
