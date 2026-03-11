# 調査結果: CloudFront キャッシュ無効化 (AWS SDK for JavaScript v3)

## 1. CreateInvalidation API の概要

### バージョン/更新日
- API バージョン: 2020-05-31
- パッケージ: `@aws-sdk/client-cloudfront`

### 要点
- `CreateInvalidation` は CloudFront ディストリビューションのエッジキャッシュからファイルを削除するAPI
- `CallerReference` はリクエストの一意性を保証する文字列（タイムスタンプ等）。同じ CallerReference で異なるパスを送ると `InvalidationBatchAlreadyExists` エラーになる
- `Paths` にはパスの配列と `Quantity`（数値）を指定する必要がある
- パスは `/` で始める必要がある（例: `/images/*`, `/index.html`）
- ワイルドカード `*` が使用可能
- 同時に進行中の無効化リクエスト数には上限がある（`TooManyInvalidationsInProgress` エラー）
- 頻繁な更新にはキャッシュ無効化よりもファイルバージョニング（ファイル名にバージョンを含める）が推奨される

### レスポンス
- 成功時: HTTP 201
- レスポンスに含まれる主要フィールド: `Id`（無効化リクエストID）, `Status`（"InProgress" -> "Completed"）, `CreateTime`

---

## 2. @aws-sdk/client-cloudfront の CreateInvalidationCommand 使用方法

### コード例

```typescript
import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from "@aws-sdk/client-cloudfront";

const client = new CloudFrontClient({ region: "us-east-1" });

const command = new CreateInvalidationCommand({
  DistributionId: "EDFDVBD6EXAMPLE",
  InvalidationBatch: {
    CallerReference: Date.now().toString(), // 一意な文字列
    Paths: {
      Quantity: 2,
      Items: ["/images/*", "/index.html"],
    },
  },
});

const response = await client.send(command);

console.log("Invalidation ID:", response.Invalidation?.Id);
console.log("Status:", response.Invalidation?.Status);
```

### 全パス無効化（ワイルドカード）の例

```typescript
const command = new CreateInvalidationCommand({
  DistributionId: "EDFDVBD6EXAMPLE",
  InvalidationBatch: {
    CallerReference: Date.now().toString(),
    Paths: {
      Quantity: 1,
      Items: ["/*"], // 全ファイルを無効化
    },
  },
});
```

### 注意点
- `Quantity` の値と `Items` 配列の長さが一致しないと `InconsistentQuantities` エラーになる
- `CallerReference` は毎回異なる値を使用すること（同じ値で異なるパスはエラー）
- CloudFront はグローバルサービスだが、クライアントのリージョンは `us-east-1` を指定するのが一般的

---

## 3. Lambda に CloudFront 操作権限を付与する IAM ポリシー

### 最小権限ポリシー（キャッシュ無効化のみ）

Lambda の実行ロールに以下のポリシーをアタッチする:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation",
        "cloudfront:ListInvalidations"
      ],
      "Resource": "arn:aws:cloudfront::123456789012:distribution/EDFDVBD6EXAMPLE"
    }
  ]
}
```

### 要点
- `cloudfront:CreateInvalidation` が必須アクション
- `cloudfront:GetInvalidation` と `cloudfront:ListInvalidations` は無効化の状態確認用（任意）
- Resource ARN の形式: `arn:aws:cloudfront::<アカウントID>:distribution/<ディストリビューションID>`
  - CloudFront はグローバルサービスのためリージョン部分は空
- 全ディストリビューションを対象にする場合は `"Resource": "*"` を使用

### AWS公式ドキュメントの Example 3 (無効化の作成・一覧取得の許可)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudfront:GetDistribution",
        "cloudfront:GetStreamingDistribution",
        "cloudfront:GetDistributionConfig",
        "cloudfront:ListDistributions",
        "cloudfront:ListCloudFrontOriginAccessIdentities",
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation",
        "cloudfront:ListInvalidations"
      ],
      "Resource": "*"
    }
  ]
}
```

※ 上記はコンソール利用も想定した例。Lambda からプログラム的にキャッシュ無効化のみ行う場合は、最小権限ポリシー（`cloudfront:CreateInvalidation` のみ）で十分。

### CDK での定義例

```typescript
import * as iam from "aws-cdk-lib/aws-iam";

lambdaFunction.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ["cloudfront:CreateInvalidation"],
    resources: [
      `arn:aws:cloudfront::${this.account}:distribution/${distributionId}`,
    ],
  })
);
```

---

## 参照リンク
- [CreateInvalidation API Reference](https://docs.aws.amazon.com/cloudfront/latest/APIReference/API_CreateInvalidation.html)
- [Invalidate files to remove content (Developer Guide)](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Invalidation.html)
- [Identity-based policy examples for CloudFront](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/security_iam_id-based-policy-examples.html)
- [AWS SDK for JavaScript v3 - @aws-sdk/client-cloudfront](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-client-cloudfront/)
- [Actions, resources, and condition keys for CloudFront (Service Authorization Reference)](https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazoncloudfront.html)
