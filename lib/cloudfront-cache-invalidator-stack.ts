import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as path from "path";

export class CloudfrontCacheInvalidatorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const basicAuthUsername =
      this.node.tryGetContext("basicAuthUsername") ||
      process.env.BASIC_AUTH_USERNAME ||
      "";
    const basicAuthPassword =
      this.node.tryGetContext("basicAuthPassword") ||
      process.env.BASIC_AUTH_PASSWORD ||
      "";

    const distributionIdsRaw = this.node.tryGetContext("distributionIds") || "";
    if (!distributionIdsRaw) {
      throw new Error(
        "distributionIds context is required. Use -c distributionIds=E1234,E5678"
      );
    }
    const distributionIds = (distributionIdsRaw as string)
      .split(",")
      .map((id: string) => id.trim())
      .filter((id: string) => id.length > 0);
    if (distributionIds.length === 0) {
      throw new Error("At least one distribution ID is required.");
    }

    const fn = new NodejsFunction(this, "InvalidatorFunction", {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(__dirname, "../lambda/index.ts"),
      handler: "handler",
      timeout: cdk.Duration.seconds(30),
      memorySize: 128,
      environment: {
        BASIC_AUTH_USERNAME: basicAuthUsername,
        BASIC_AUTH_PASSWORD: basicAuthPassword,
        ALLOWED_DISTRIBUTION_IDS: distributionIds.join(","),
        DEFAULT_DISTRIBUTION_ID: distributionIds[0],
      },
      bundling: {
        externalModules: ["@aws-sdk/*"],
      },
    });

    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["cloudfront:CreateInvalidation"],
        resources: distributionIds.map(
          (id) => `arn:aws:cloudfront::${this.account}:distribution/${id}`
        ),
      })
    );

    const functionUrl = fn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    new cdk.CfnOutput(this, "FunctionUrl", {
      value: functionUrl.url,
      description: "CloudFront Cache Invalidator Function URL",
    });
  }
}
