# 自社プレミアムライス 通販サイト

自社ブランドの高価格帯米を販売する EC サイト。Shopify ではなく自社開発で運用する。
要件は `docs/requirements.md`、作業の順番は `docs/roadmap.md` を参照。

## 技術スタック

- Next.js 15（App Router）/ React 19 / TypeScript（strict）
- Prisma 6（開発: SQLite、本番: PostgreSQL 予定）
- 決済: Stripe（カード・Apple Pay・Google Pay・コンビニ・銀行振込・PayPay・定期便）、Paidy（あと払い）、NP後払い（契約待ち）
- バリデーション: zod / テスト: vitest

## コマンド（すべて `rice-shop/` で実行）

```bash
npm run dev        # 開発サーバー http://localhost:3000
npm run check      # 型チェック + テスト。変更後は必ず通すこと
npm run build      # 本番ビルド
npx prisma db push # schema.prisma を DB に反映
npm run stripe:listen  # Stripe Webhook をローカルへ転送（Stripe CLI が必要）
```

## ディレクトリ

```
src/
  app/                    画面と API（App Router）
    api/checkout/         注文作成 + 決済開始（Stripe / Paidy / NP後払いを振り分け）
    api/paidy/confirm/    Paidy の承認結果を検証して capture
    api/webhooks/stripe/  Stripe Webhook（支払い完了・定期便の継続課金）
    checkout/             購入手続き画面・完了画面
  components/             UI 部品
  lib/
    catalog.ts            商品マスタと価格計算（★金額ロジックはここだけ）
    checkout-schema.ts    注文入力の zod スキーマ・配送日ルール
    payment-methods.ts    決済手段の表示と利用可否
    stripe.ts / paidy.ts / np-atobarai.ts  各決済サービスのクライアント
    cart-store.ts         カート（localStorage）
prisma/schema.prisma      Order / OrderItem / ProcessedEvent
```

## 必ず守るルール

### お金まわり
- **金額は必ずサーバー側で `quoteCart()` から計算する。** クライアントから送られた金額・単価を信用しない。
- 価格・送料・割引のルールを変えるときは `src/lib/catalog.ts` だけを変更し、`catalog.test.ts` にテストを追加する。
- 価格はすべて**税込・円の整数**。米は軽減税率 8%。浮動小数で金額を持ち回さない。
- 決済サービスへのリクエストには冪等キー（`idempotencyKey`）を付ける。
- Webhook は署名検証必須。`ProcessedEvent` で重複処理を防ぐ。新しいイベントを扱うときも同じ形にする。
- 支払い完了の判定は Webhook（Stripe）またはサーバー側の照合（Paidy）で行う。リダイレクト先 URL のパラメータだけで「支払い済み」にしない。

### 決済手段の制約
- 定期便は Stripe のカード系のみ（コンビニ・後払いは継続課金できない）。
- 1 つの注文で「毎月」と「隔月」の定期便は混在不可（Stripe の Subscription は請求周期が 1 つ）。
- NP後払いの上限は 55,000 円。API 仕様は契約後に入手するため `np-atobarai.ts` は未実装。仕様書なしで推測実装しないこと。

### コード
- UI 文言・コメント・エラーメッセージは日本語。
- 秘密鍵は `.env` のみ。`NEXT_PUBLIC_` を付けてよいのは公開鍵だけ。
- 個人情報（氏名・住所・電話・メール）をログに出さない。
- DB スキーマを変えたら `npx prisma db push` を実行し、影響する API を確認する。
- 変更後は `npm run check` と `npm run build` が通ることを確認してからコミットする。

## 未確定事項（コード中は `【要記入】` `【要確認】` で表示）

- 商品ラインナップ・価格・産地・商品画像（現在の 4 品種はサンプル）
- 送料・定期便割引率・お届け日ルール
- 特定商取引法に基づく表記の事業者情報
これらは推測で埋めず、ユーザーに確認すること。
