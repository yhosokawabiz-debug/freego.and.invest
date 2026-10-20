# LS-Commerce（ライトスタッフ社 自社通販基盤）— Claude Code 作業指示

## 最初に読むもの

1. `docs/requirements.md`（要件定義書）。要件 ID（FR / NFR / IF）を正とする。
2. この CLAUDE.md。

## 作業ルール

- **実装するのは現在のフェーズの要件だけ**（`docs/requirements.md` 9 章）。今は **Phase 1**。
- `【要確認】` の業務ルールは推測で決めない。設定値やインターフェースだけ用意し、`TODO(要確認: FR-xxx)` を残す。判断に迷ったら作業を止めて質問する。
- コミットメッセージに要件 ID を入れる（例：`feat(customer): 顧客検索で電話番号の揺れを吸収 [FR-103]`）。
- 1 回の PR は 1 機能単位にする。ドメインロジックにはユニットテストを必ず付ける。

## 技術スタック（初期案。ロジスタのスタックに合わせて変更可）

| 層 | 採用 |
|---|---|
| 言語 | TypeScript（strict） |
| モノレポ | pnpm workspaces + Turborepo |
| ストアフロント | Next.js（App Router） |
| 管理画面（受注入力・CRM 含む） | Next.js（App Router） |
| API | NestJS（モジュラーモノリス。モジュールはドメインごとに分ける） |
| 非同期ジョブ | BullMQ + Redis（連携・定期受注の作成・バッチ） |
| DB | PostgreSQL + Prisma |
| テスト | Vitest（ユニット）、Playwright（E2E）、外部 API はモックと契約テスト |
| インフラ | AWS（ECS Fargate / RDS / ElastiCache / S3 / SES / KMS）、Terraform |

## ディレクトリ構成（予定）

```
lightstuff-ec/
  apps/
    storefront/    # 顧客向け EC
    admin/         # 管理画面・電話受注入力・CRM
    api/           # NestJS API
    worker/        # BullMQ ワーカー
  packages/
    domain/        # エンティティ・状態機械・価格計算・ルールエンジン（フレームワーク非依存）
    db/            # Prisma スキーマ・マイグレーション
    integrations/  # Gateway インターフェースと実装（nextengine / atobarai / psp / logista / mail）
    ui/            # 共通 UI コンポーネント
  docs/
```

## 守るべき設計

- **金額は整数（円）**。税計算・端数処理は `packages/domain` の一箇所にまとめる。
- 受注ステータスの遷移は `packages/domain` の状態機械だけで行う（要件 6 章）。
- 外部連携は Gateway インターフェース経由で行う。テストと開発環境では**モック実装を使い、本物の外部 API を呼ばない**。
- 外部への送信はトランザクションアウトボックス経由で行い、冪等キーを付ける。
- `packages/domain` は NestJS / Next.js / Prisma に依存させない。

## セキュリティ（必ず守る）

- カード番号・セキュリティコードを自社サーバーで受け取らない、ログに出さない、保存しない。PSP のトークンだけを扱う。
- 個人情報（氏名・電話・住所・メール）はログに出さない。共通のマスク関数を使う。
- 秘密情報（API キー等）をコミットしない。`.env.example` にキー名だけ書く。
- 管理画面の API はすべて権限チェックを通す（FR-1001）。個人情報の閲覧と CSV 出力は監査ログに残す（FR-1002）。

## コマンド

（雛形を作ったら、ここに install / dev / test / lint / migrate のコマンドを書くこと）
