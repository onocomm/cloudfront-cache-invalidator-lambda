# CloudFront Cache Invalidator Lambda - セキュリティ強化計画

## Context

GETパラメータで任意のdistributionIdを受け付ける現在の設計にセキュリティ上の懸念がある。デプロイ時にディストリビューションIDを固定し、IAMロールもそのIDに限定する設計に変更する。GETパラメータの入力をそのままAPIに流し込まないようにし、許可リストによるバリデーション + IAMロール権限の二重の絞り込みを行う。

## 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `cdk.json` | contextに`distributionIds`追加 |
| `lib/cloudfront-cache-invalidator-stack.ts` | IAMリソース制限 + 環境変数追加 |
| `lambda/index.ts` | 許可リストバリデーション + デフォルトID |
| `README.md` | デプロイ手順・使い方・セキュリティ説明更新 |
| `CLAUDE.md` | デプロイコマンド更新 |

変更不要: `bin/app.ts`, `package.json`, `tsconfig.json`, `.gitignore`

## 変更詳細

### 1. `cdk.json` - contextに`distributionIds`追加

```diff
 "context": {
   "basicAuthUsername": "",
-  "basicAuthPassword": ""
+  "basicAuthPassword": "",
+  "distributionIds": ""
 }
```

### 2. `lib/cloudfront-cache-invalidator-stack.ts` - CDKスタック

- contextから`distributionIds`を取得（カンマ区切り文字列→配列にパース）
- 空の場合はエラーをthrow（最低1つ必須）
- 環境変数に`ALLOWED_DISTRIBUTION_IDS`（カンマ区切り）と`DEFAULT_DISTRIBUTION_ID`（1つ目）を追加
- IAMポリシーのresourcesを`*`から各IDのARN配列に変更
  - ARN形式: `arn:aws:cloudfront::<accountId>:distribution/<id>`
  - `this.account`でデプロイ先アカウントIDを自動解決

### 3. `lambda/index.ts` - Lambda関数

- 環境変数から`ALLOWED_DISTRIBUTION_IDS`と`DEFAULT_DISTRIBUTION_ID`を読み込み
- `distributionId`パラメータ省略時→`DEFAULT_DISTRIBUTION_ID`を使用
- 指定されたIDが許可リストに含まれない場合→403 Forbidden
- バリデーション通過後のみ`CreateInvalidationCommand`に渡す

### 4. `README.md` / `CLAUDE.md`

- デプロイコマンドに`-c distributionIds=E1234,E5678`を追加
- distributionIdパラメータをNo（省略可能）に変更
- ディストリビューションID制限のセキュリティ説明を追加

## デプロイ方法（変更後）

```bash
npx cdk deploy --profile <profile名> \
  -c basicAuthUsername=admin \
  -c basicAuthPassword=<パスワード> \
  -c distributionIds=E1234567890,EABCDEFGHIJ
```

## 使用方法（変更後）

```bash
# デフォルト（1つ目のID）のキャッシュクリア
curl -u admin:<パスワード> "https://<function-url>/"

# IDを明示指定（許可リスト内のもののみ）
curl -u admin:<パスワード> "https://<function-url>/?distributionId=EABCDEFGHIJ&paths=/images/*"
```

## 検証方法

1. `npx cdk synth -c distributionIds=ETEST123 -c basicAuthUsername=test -c basicAuthPassword=test`
   - IAMポリシーのResourceが`arn:aws:cloudfront::*:distribution/ETEST123`になっていること
   - Lambda環境変数に`ALLOWED_DISTRIBUTION_IDS=ETEST123`、`DEFAULT_DISTRIBUTION_ID=ETEST123`があること
2. distributionIds未指定で`cdk synth`→エラーになること
