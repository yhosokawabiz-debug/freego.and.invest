# FREEGO お米のオンラインショップ

Next.js (App Router) + Stripe + Paidy で構築した米の通販サイトです。

## 機能

- 商品一覧・詳細（品種 / 容量 2・5・10kg / 精米方法 白米・無洗米・分づき・玄米）
- 購入方法: 通常購入 / 定期便（毎月・隔月、5% オフ・送料無料）
- お届け希望日（注文の 3〜14 日後）・時間帯指定
- 送料: 税込 5,000 円以上または定期便で無料、それ以外 990 円
- 決済
  | 手段 | 連携先 | 備考 |
  |---|---|---|
  | クレジットカード / Apple Pay / Google Pay | Stripe | 定期便にも対応 |
  | コンビニ払い / 銀行振込 / PayPay | Stripe | Dashboard で有効化したものが表示される。通常購入のみ |
  | あと払い（ペイディ） | Paidy | 通常購入のみ |
  | NP後払い（請求書） | ネットプロテクションズ | **契約後に API 実装が必要**（`src/lib/np-atobarai.ts`）。上限 55,000 円 |
- 特定商取引法に基づく表記ページ（`【要記入】` を公開前に埋めること）

金額は必ずサーバー側（`src/lib/catalog.ts`）で再計算し、クライアントから送られた金額は使いません。

## セットアップ

```bash
cd rice-shop
npm install
cp .env.example .env   # 各キーを設定
npx prisma db push     # SQLite の DB を作成
npm run dev            # http://localhost:3000
```

### Stripe

1. [Dashboard](https://dashboard.stripe.com/test/apikeys) のテストキーを `.env` に設定
2. 設定 → 支払い方法 で「カード」「Apple Pay」「Google Pay」「コンビニ」「銀行振込」「PayPay」を有効化
3. Webhook をローカルに転送: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
   （表示される `whsec_...` を `STRIPE_WEBHOOK_SECRET` に設定）
4. 本番では Webhook エンドポイントに以下のイベントを登録
   `payment_intent.succeeded`, `payment_intent.processing`, `payment_intent.requires_action`,
   `payment_intent.canceled`, `invoice.paid`, `customer.subscription.deleted`

テストカード: `4242 4242 4242 4242`（有効期限は未来の日付、CVC は任意）

### Paidy

[加盟店管理画面](https://merchant.paidy.com/) のテスト用 公開鍵 / 秘密鍵を設定します。
承認後 `/api/paidy/confirm` で金額・注文番号を照合してから capture します。

### NP後払い

加盟店契約後に提供される API 仕様に沿って `registerTransaction` を実装し、`NP_ATOBARAI_*` を設定してください。
未設定の間は選択時にエラーを返します。出荷時の配送伝票番号登録も別途必要です。

## 注文ステータス

| status | 意味 |
|---|---|
| `pending` | 注文作成直後 |
| `awaiting_payment` | 決済手続き中・コンビニ/銀行振込の入金待ち・NP後払い与信済み |
| `paid` | 支払い完了（Webhook / Paidy capture で更新） |
| `failed` | 決済失敗・キャンセル |

定期便の 2 回目以降は `invoice.paid`（`subscription_cycle`）を受けて新しい注文レコードを自動作成します。

## 本番公開前の TODO

- DB を PostgreSQL 等に変更（`prisma/schema.prisma` の `provider`）
- 注文確認メール送信、管理画面（受注一覧・発送登録）
- 定期便のマイページ（スキップ・解約・カード変更 → Stripe Customer Portal が簡単）
- 特商法表記・プライバシーポリシーの記入、商品画像
