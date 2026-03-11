#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { CloudfrontCacheInvalidatorStack } from "../lib/cloudfront-cache-invalidator-stack";

const app = new cdk.App();

new CloudfrontCacheInvalidatorStack(app, "CloudfrontCacheInvalidatorStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "us-east-1",
  },
});
