import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from "@aws-sdk/client-cloudfront";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";

const client = new CloudFrontClient({});

const BASIC_AUTH_USERNAME = process.env.BASIC_AUTH_USERNAME || "";
const BASIC_AUTH_PASSWORD = process.env.BASIC_AUTH_PASSWORD || "";
const ALLOWED_DISTRIBUTION_IDS = (
  process.env.ALLOWED_DISTRIBUTION_IDS || ""
)
  .split(",")
  .filter((id) => id.length > 0);
const DEFAULT_DISTRIBUTION_ID = process.env.DEFAULT_DISTRIBUTION_ID || "";

function unauthorized(): APIGatewayProxyResultV2 {
  return {
    statusCode: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="CloudFront Cache Invalidator"',
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ error: "Unauthorized" }),
  };
}

function verifyBasicAuth(authorizationHeader?: string): boolean {
  if (!authorizationHeader) return false;
  if (!authorizationHeader.startsWith("Basic ")) return false;

  const encoded = authorizationHeader.slice(6);
  const decoded = Buffer.from(encoded, "base64").toString("utf-8");
  const [username, ...passwordParts] = decoded.split(":");
  const password = passwordParts.join(":");

  return username === BASIC_AUTH_USERNAME && password === BASIC_AUTH_PASSWORD;
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  if (!verifyBasicAuth(event.headers?.["authorization"])) {
    return unauthorized();
  }

  const method = event.requestContext?.http?.method;
  if (method !== "GET") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  const params = event.queryStringParameters || {};
  const distributionId = params.distributionId || DEFAULT_DISTRIBUTION_ID;

  if (!distributionId) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Server configuration error: no default distribution ID",
      }),
    };
  }

  if (!ALLOWED_DISTRIBUTION_IDS.includes(distributionId)) {
    return {
      statusCode: 403,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Forbidden" }),
    };
  }

  const pathsParam = params.paths || "/*";
  const paths = pathsParam.split(",").map((p) => p.trim());

  try {
    const callerReference = `invalidation-${Date.now()}`;

    const command = new CreateInvalidationCommand({
      DistributionId: distributionId,
      InvalidationBatch: {
        CallerReference: callerReference,
        Paths: {
          Quantity: paths.length,
          Items: paths,
        },
      },
    });

    const result = await client.send(command);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Invalidation created successfully",
        invalidationId: result.Invalidation?.Id,
        status: result.Invalidation?.Status,
        distributionId,
        paths,
        callerReference,
      }),
    };
  } catch (error) {
    const err = error as Error;
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Failed to create invalidation",
        message: err.message,
      }),
    };
  }
}
