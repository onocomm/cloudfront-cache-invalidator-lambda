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

const MAX_PATHS = 15;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlResponse(
  statusCode: number,
  body: string
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body,
  };
}

function loginPage(error?: string): APIGatewayProxyResultV2 {
  const errorHtml = error
    ? `<div style="background:#fef2f2;border:1px solid #fca5a5;color:#991b1b;padding:12px 16px;border-radius:8px;margin-bottom:20px;font-size:14px;">${escapeHtml(error)}</div>`
    : "";
  return htmlResponse(
    200,
    `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>キャッシュクリア</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif; background: #f0f4f8; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
  .card { background: #fff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); padding: 40px; width: 100%; max-width: 400px; }
  h1 { font-size: 20px; color: #1a3a6e; margin-bottom: 8px; }
  .subtitle { color: #666; font-size: 14px; margin-bottom: 24px; }
  label { display: block; font-size: 14px; font-weight: 600; color: #333; margin-bottom: 6px; }
  input[type="text"], input[type="password"] { width: 100%; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 15px; margin-bottom: 16px; outline: none; transition: border-color 0.2s; }
  input:focus { border-color: #5ba4d9; box-shadow: 0 0 0 3px rgba(91,164,217,0.15); }
  button { width: 100%; padding: 12px; background: #1a3a6e; color: #fff; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
  button:hover { background: #15305a; }
</style>
</head>
<body>
<div class="card">
  <h1>キャッシュクリア</h1>
  <p class="subtitle">ユーザー名とパスワードを入力してください</p>
  ${errorHtml}
  <form method="POST">
    <label for="username">ユーザー名</label>
    <input type="text" id="username" name="username" autocomplete="username" required>
    <label for="password">パスワード</label>
    <input type="password" id="password" name="password" autocomplete="current-password" required>
    <button type="submit">キャッシュをクリアする</button>
  </form>
</div>
</body>
</html>`
  );
}

function successPage(result: {
  invalidationId?: string;
  status?: string;
  distributionId: string;
  paths: string[];
}): APIGatewayProxyResultV2 {
  return htmlResponse(
    200,
    `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>キャッシュクリア完了</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif; background: #f0f4f8; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
  .card { background: #fff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); padding: 40px; width: 100%; max-width: 480px; }
  .success { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; }
  .success h2 { color: #166534; font-size: 18px; margin-bottom: 4px; }
  .success p { color: #15803d; font-size: 14px; }
  .info { font-size: 14px; color: #555; line-height: 1.8; }
  .info dt { font-weight: 600; color: #333; }
  .info dd { margin-bottom: 8px; margin-left: 0; }
  .note { margin-top: 20px; padding: 12px 16px; background: #eff6ff; border-radius: 8px; font-size: 13px; color: #1e40af; line-height: 1.6; }
</style>
</head>
<body>
<div class="card">
  <div class="success">
    <h2>キャッシュクリアを開始しました</h2>
    <p>反映まで数分かかります。しばらくお待ちください。</p>
  </div>
  <dl class="info">
    <dt>ステータス</dt>
    <dd>${escapeHtml(result.status || "処理中")}</dd>
    <dt>対象パス</dt>
    <dd>${escapeHtml(result.paths.join(", "))}</dd>
  </dl>
  <div class="note">
    サイトに反映されない場合は、ブラウザのキャッシュもクリアしてください（Ctrl+Shift+R または Cmd+Shift+R）
  </div>
</div>
</body>
</html>`
  );
}

function errorPage(message: string): APIGatewayProxyResultV2 {
  return htmlResponse(
    200,
    `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>エラー</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif; background: #f0f4f8; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
  .card { background: #fff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); padding: 40px; width: 100%; max-width: 480px; }
  .error { background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; }
  .error h2 { color: #991b1b; font-size: 18px; margin-bottom: 4px; }
  .error p { color: #b91c1c; font-size: 14px; }
  a { color: #1a3a6e; text-decoration: none; font-weight: 600; }
  a:hover { text-decoration: underline; }
</style>
</head>
<body>
<div class="card">
  <div class="error">
    <h2>エラーが発生しました</h2>
    <p>${escapeHtml(message)}</p>
  </div>
  <p><a href="/">戻る</a></p>
</div>
</body>
</html>`
  );
}

function parseFormBody(body: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const pair of body.split("&")) {
    const [key, ...vals] = pair.split("=");
    params[decodeURIComponent(key)] = decodeURIComponent(vals.join("=").replace(/\+/g, " "));
  }
  return params;
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext?.http?.method;

  // GET: ログインフォームを表示
  if (method === "GET") {
    // curl等からのBasic認証にも対応
    const authHeader = event.headers?.["authorization"];
    if (authHeader?.startsWith("Basic ")) {
      const encoded = authHeader.slice(6);
      const decoded = Buffer.from(encoded, "base64").toString("utf-8");
      const [username, ...passwordParts] = decoded.split(":");
      const password = passwordParts.join(":");
      if (username === BASIC_AUTH_USERNAME && password === BASIC_AUTH_PASSWORD) {
        return handleInvalidation(event.queryStringParameters || {});
      }
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }
    return loginPage();
  }

  // POST: フォーム送信を処理
  if (method === "POST") {
    const body = event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64").toString("utf-8")
      : event.body || "";
    const form = parseFormBody(body);

    if (form.username !== BASIC_AUTH_USERNAME || form.password !== BASIC_AUTH_PASSWORD) {
      return loginPage("ユーザー名またはパスワードが正しくありません");
    }

    return handleInvalidation(event.queryStringParameters || {});
  }

  return errorPage("この操作はサポートされていません");
}

async function handleInvalidation(
  params: Record<string, string | undefined>
): Promise<APIGatewayProxyResultV2> {
  const distributionId = params.distributionId || DEFAULT_DISTRIBUTION_ID;

  if (!distributionId) {
    return errorPage("サーバー設定エラー: デフォルトのディストリビューションIDが設定されていません");
  }

  if (!ALLOWED_DISTRIBUTION_IDS.includes(distributionId)) {
    return errorPage("指定されたディストリビューションIDは許可されていません");
  }

  const pathsParam = params.paths || "/*";
  const paths = pathsParam.split(",").map((p) => p.trim()).filter((p) => p.length > 0);

  if (paths.length === 0) {
    return errorPage("パスが指定されていません");
  }
  if (paths.length > MAX_PATHS) {
    return errorPage(`パスの指定は${MAX_PATHS}個までです`);
  }
  for (const p of paths) {
    if (!p.startsWith("/")) {
      return errorPage(`パスは / で始まる必要があります: ${p}`);
    }
  }

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

    // curl等からのリクエストはJSONで返す
    if (params.format === "json") {
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
    }

    return successPage({
      invalidationId: result.Invalidation?.Id,
      status: result.Invalidation?.Status,
      distributionId,
      paths,
    });
  } catch (error) {
    const err = error as Error;
    return errorPage(`キャッシュクリアに失敗しました: ${err.message}`);
  }
}
