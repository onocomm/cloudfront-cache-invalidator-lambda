# AWS公式ドキュメント調査結果

## 1. AWS CDKでLambda Function URLsを設定する方法（AuthType.NONE）

### バージョン/更新日
AWS CDK v2 (aws-cdk-lib) - 公式チュートリアルで使用

### 要点
- `Function`コンストラクトの`addFunctionUrl()`ヘルパーメソッドを使用してFunction URLを追加する
- `authType`に`lambda.FunctionUrlAuthType.NONE`を指定するとパブリックアクセスが可能になる
- Function URLのエンドポイントは`https://<url-id>.lambda-url.<region>.on.aws`形式
- `CfnOutput`を使ってデプロイ時にURLを出力可能

### コード例（TypeScript）
```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export class MyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const myFunction = new lambda.Function(this, 'MyFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda'),
    });

    // Function URL（認証なし）
    const myFunctionUrl = myFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    new cdk.CfnOutput(this, 'FunctionUrl', {
      value: myFunctionUrl.url,
    });
  }
}
```

### 参照リンク
- https://docs.aws.amazon.com/cdk/v2/guide/hello-world.html （CDK v2公式チュートリアル - Lambda Function URL使用例）

---

## 2. Lambda Function URLsの認証設定（AuthType NONE）

### バージョン/更新日
2025年10月以降: 新規Function URLには`lambda:InvokeFunctionUrl`と`lambda:InvokeFunction`の両方の権限が必要

### 要点
- `AuthType`は`AWS_IAM`または`NONE`の2種類
- **NONE**: Lambdaはリクエストの認証を行わない。ただしリソースベースポリシーは常に有効で、パブリックアクセスを許可するポリシーが必要
- **AWS_IAM**: IAMプリンシパルのIDポリシーとLambdaのリソースベースポリシーに基づいて認証・認可
- Function URLはパブリックインターネットからのみアクセス可能（AWS PrivateLinkは非対応）
- Function URLはエイリアスまたは`$LATEST`バージョンにのみ設定可能（他のバージョンには不可）
- CORS設定も可能

### CloudFormationでの設定例
```json
{
  "Type": "AWS::Lambda::Url",
  "Properties": {
    "AuthType": "NONE",
    "TargetFunctionArn": { "Ref": "MyFunction" }
  }
}
```

### 参照リンク
- https://docs.aws.amazon.com/lambda/latest/dg/urls-auth.html （認証・アクセス制御）
- https://docs.aws.amazon.com/lambda/latest/dg/urls-configuration.html （Function URLの作成と管理）
- https://docs.aws.amazon.com/lambda/latest/api/API_FunctionUrlConfig.html （API仕様 - FunctionUrlConfig）

---

## 3. CloudFront CreateInvalidation APIの仕様

### バージョン/更新日
API バージョン: 2020-05-31

### 要点
- **リクエスト**: `POST /2020-05-31/distribution/{DistributionId}/invalidation`
- **必須パラメータ**:
  - `CallerReference` (String): リクエストの一意識別子。タイムスタンプの使用が推奨（例: `20120301090000`）。同じCallerReferenceで同じパスなら重複リクエストにならない
  - `Paths` (Object): 無効化するオブジェクトの情報
    - `Items`: 無効化するパスのリスト（例: `/images/*`）
    - `Quantity`: パスの数（Itemsのサイズと一致する必要あり）
- **レスポンス**: HTTP 201（成功時）
  - `Id`: 無効化リクエストのID
  - `Status`: 完了時は`Completed`
  - `CreateTime`: リクエスト作成日時
- **エラー**:
  - `AccessDenied` (403)
  - `BatchTooLarge` (413): バッチが大きすぎる
  - `NoSuchDistribution` (404): ディストリビューションが存在しない
  - `TooManyInvalidationsInProgress` (400): 進行中の無効化リクエストが多すぎる
  - `InconsistentQuantities` (400): QuantityとItemsのサイズ不一致

### AWS SDK for JavaScript V3での使用
SDK対応あり。`@aws-sdk/client-cloudfront`の`CreateInvalidationCommand`を使用。

### 参照リンク
- https://docs.aws.amazon.com/cloudfront/latest/APIReference/API_CreateInvalidation.html （API Reference）
- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Invalidation.html （Developer Guide - ファイルの無効化）

---

## 4. AWS CDK v2でのLambda Function URL構成例

### バージョン/更新日
AWS CDK v2 - 公式チュートリアル (hello-world)

### 要点
- `aws-cdk-lib/aws-lambda`モジュールの`Function`コンストラクトを使用
- `addFunctionUrl()`メソッドでFunction URLを追加
- `FunctionUrlAuthType.NONE`でパブリックアクセス設定
- CDKが自動的にリソースベースポリシーを生成し、パブリックアクセスを許可する
- `CfnOutput`でデプロイ後のURLを出力

### 完全なTypeScriptコード例（公式チュートリアルベース）
```typescript
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export class HelloCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Lambda関数の定義
    const myFunction = new lambda.Function(this, 'HelloWorldFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async function(event) {
          return {
            statusCode: 200,
            body: JSON.stringify('Hello World!'),
          };
        };
      `),
    });

    // Function URL（認証なし）の定義
    const myFunctionUrl = myFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    // URL出力
    new cdk.CfnOutput(this, 'myFunctionUrlOutput', {
      value: myFunctionUrl.url,
    });
  }
}
```

### 参照リンク
- https://docs.aws.amazon.com/cdk/v2/guide/hello-world.html （公式チュートリアル）
- https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda.Function.html （Function API Reference）
- https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda-readme.html （aws-lambda モジュール README）
