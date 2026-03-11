# CloudFront Cache Invalidator Lambda

## 技術スタック
- AWS CDK v2 (TypeScript)
- Lambda Runtime: Node.js 22.x
- @aws-sdk/client-cloudfront（Lambdaランタイムにプリインストール済み）
- Lambda Function URLs (AuthType: NONE + Basic認証)

## ディレクトリ構成
- `bin/app.ts` - CDKアプリエントリポイント
- `lib/cloudfront-cache-invalidator-stack.ts` - CDKスタック定義
- `lambda/index.ts` - Lambda関数コード

## デプロイ
- リージョン: us-east-1（バージニア州）固定
- `npx cdk deploy --profile <profile名> -c basicAuthUsername=xxx -c basicAuthPassword=xxx -c distributionIds=E1234,E5678`
- デプロイ先は様々なAWSアカウント。`--profile`で切り替え

## 注意事項
- `@aws-sdk/client-cloudfront`はpackage.jsonに含めない（ランタイムのものを使用）
- `NodejsFunction`のexternalModulesで`@aws-sdk/*`を除外済み
- Lambda関数コードはesbuildでバンドルされるため`tsconfig.json`のexclude対象
