# CloudFront Cache Invalidator Lambda

## 技術スタック
- AWS CDK v2 (TypeScript)
- Lambda Runtime: Node.js 22.x
- @aws-sdk/client-cloudfront（Lambdaランタイムにプリインストール済み）
- Lambda Function URLs (AuthType: NONE)

## ディレクトリ構成
- `bin/app.ts` - CDKアプリエントリポイント
- `lib/cloudfront-cache-invalidator-stack.ts` - CDKスタック定義
- `lambda/index.ts` - Lambda関数コード
- `docs/clients/` - お客様向け手順書（Git追跡対象外）

## 認証方式
- ブラウザアクセス: HTMLログインフォーム（POST送信）
- curl等のCLIアクセス: Basic認証（Authorizationヘッダー）
- Lambda Function URLsが`WWW-Authenticate`ヘッダーをリマップするため、ブラウザ向けはフォーム方式を採用

## デプロイ
- リージョン: us-east-1（バージニア州）固定
- `npx cdk deploy --profile <profile名> -c basicAuthUsername=xxx -c basicAuthPassword=xxx -c distributionIds=E1234,E5678`
- デプロイ先は様々なAWSアカウント。`--profile`で切り替え
- `distributionIds`は必須。IAMロールも指定IDに限定される

## セキュリティ対策
- デプロイ時に`basicAuthUsername`/`basicAuthPassword`/`distributionIds`が未指定の場合はエラーで停止
- HTML出力の動的値はすべて`escapeHtml()`でXSSエスケープ済み
- pathsは`/`開始必須、最大15個の制限あり
- distributionIdは許可リストで検証後、IAMロールでも二重に制限

## 注意事項
- `@aws-sdk/client-cloudfront`はpackage.jsonに含めない（ランタイムのものを使用）
- `NodejsFunction`のexternalModulesで`@aws-sdk/*`を除外済み
- Lambda関数コードはesbuildでバンドルされるため`tsconfig.json`のexclude対象
- `docs/clients/`は`.gitignore`に含まれる（認証情報を含むため）
