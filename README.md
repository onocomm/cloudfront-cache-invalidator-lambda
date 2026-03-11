# CloudFront Cache Invalidator Lambda

非エンジニアでもブラウザから CloudFront のキャッシュクリアを実行できるツールです。
AWS Lambda Function URLs で HTTP エンドポイントを公開し、ログインフォームで保護します。

## セキュリティについて

このツールは **フォーム認証による最低限のセキュリティ** で動作します。
AWS IAM 認証やトークンベース認証ではなく、ユーザー名とパスワードによる簡易的な認証のみを提供します。
機密性の高い環境では、追加のセキュリティ対策（IP 制限、WAF 等）を検討してください。

### ディストリビューション ID の制限

デプロイ時に `-c distributionIds=...` で指定したディストリビューション ID のみ操作可能です。
Lambda の IAM ロールも指定されたディストリビューションのみにアクセスが制限されます。
許可されていないディストリビューション ID を指定した場合はエラーが返されます。

## キャッシュクリアに関する重要な注意事項

通常、CloudFront のキャッシュがクリアされても **情報漏洩や重大なシステム障害に直結することはありません**。キャッシュが削除されると、次のリクエスト時にオリジンサーバーから最新のコンテンツが取得されるだけです。

ただし、以下の点に十分注意してください。

### 高負荷サイトにおけるリスク

高トラフィックのサイトでキャッシュを一括クリアすると、**大量のリクエストが同時にオリジンサーバーへ到達**します。これによりオリジンサーバーに過大な負荷がかかり、サイト全体のパフォーマンス低下やダウンタイムを引き起こす可能性があります。

### キャッシュクリアは高度な運用操作です

本来、キャッシュの無効化（Invalidation）は **高度な戦術** として行われるものです。

- **タイミング**: トラフィックの少ない時間帯を選ぶ、段階的に実行する等の考慮が必要です
- **パス指定**: `/*`（全件クリア）ではなく、更新が必要なパスのみを指定することが推奨されます
- **頻度**: 頻繁なキャッシュクリアは CloudFront の本来のメリット（高速配信・オリジン負荷軽減）を損ないます

### 導入前の確認事項

**一律のキャッシュコントロール（Cache-Control ヘッダー等）を適切に設定していないサイトへの安易な導入は危険です。** キャッシュ戦略が整備されていない状態でキャッシュクリアを頻繁に行うと、予期しない動作やパフォーマンス問題を引き起こす可能性があります。導入前に以下を確認してください。

- オリジンサーバーが適切な `Cache-Control` ヘッダーを返しているか
- CloudFront のキャッシュポリシーが設計通りに動作しているか
- オリジンサーバーがキャッシュクリア後の負荷増加に耐えられるか

## デプロイ

### 前提条件

- Node.js 22.x 以上
- AWS CLI（設定済みプロファイル）
- AWS CDK v2

### 手順

```bash
# 依存関係のインストール
npm install

# 初回のみ: CDK Bootstrap（デプロイ先アカウントごとに1回）
npx cdk bootstrap --profile <profile名>

# デプロイ（ディストリビューションID 1つ）
npx cdk deploy --profile <profile名> \
  -c basicAuthUsername=admin \
  -c basicAuthPassword=<パスワード> \
  -c distributionIds=E1234567890

# デプロイ（複数ディストリビューション）
npx cdk deploy --profile <profile名> \
  -c basicAuthUsername=admin \
  -c basicAuthPassword=<パスワード> \
  -c distributionIds=E1234567890,EABCDEFGHIJ
```

デプロイ完了後、コンソールに Function URL が出力されます。

## 使い方

### ブラウザから（非エンジニア向け）

1. デプロイ時に出力された Function URL にブラウザでアクセス
2. ログインフォームが表示されるので、ユーザー名とパスワードを入力
3. 「キャッシュをクリアする」ボタンを押す
4. 成功画面が表示されれば完了（反映まで数分）

### curl から（エンジニア向け）

```bash
# デフォルトのディストリビューションで全キャッシュクリア
curl -u admin:<パスワード> "https://<function-url>/?format=json"

# ディストリビューション ID を明示指定
curl -u admin:<パスワード> "https://<function-url>/?distributionId=<DistributionID>&format=json"

# パス指定でクリア
curl -u admin:<パスワード> "https://<function-url>/?distributionId=<DistributionID>&paths=/images/*,/css/*&format=json"
```

### パラメータ

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `distributionId` | No | CloudFront ディストリビューション ID（省略時はデプロイ時に指定した1つ目を使用。デプロイ時に許可した ID のみ指定可能） |
| `paths` | No | 無効化するパス（カンマ区切り、デフォルト: `/*`、`/` 開始必須、最大 15 個） |
| `format` | No | `json` を指定すると JSON レスポンスを返す（curl 向け） |

### レスポンス例（JSON）

```json
{
  "message": "Invalidation created successfully",
  "invalidationId": "I1234567890",
  "status": "InProgress",
  "distributionId": "E1234567890",
  "paths": ["/*"],
  "callerReference": "invalidation-1234567890"
}
```
