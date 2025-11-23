import express from "express";
import cors from "cors";
import { verifyAuthorization } from "./verifyService";
import { settleAuthorization } from "./settleService";
import { VerifyRequest, VerifyResponse, SettleRequest, SettleResponse } from "./types";
import { validateEnv } from "./env";

// 環境変数のバリデーション
try {
  validateEnv();
} catch (error: any) {
  console.error("Environment validation failed:", error.message);
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

// リクエストログ
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ヘルスチェック
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "jpyc-x402-facilitator-polygon"
  });
});

app.post("/verify", async (req, res) => {
  try {
    const verifyReq = req.body as VerifyRequest;
    console.log(`[Verify] Request received:`, JSON.stringify(verifyReq, null, 2));

    // 必須フィールドのチェック（リクエスト形式の検証）
    if (!verifyReq.x402Version || !verifyReq.paymentPayload || !verifyReq.paymentRequirements) {
      console.log(`[Verify] Invalid request format, returning 400`);
      return res.status(400).json({
        errorType: "invalid_request",
        errorMessage: "Invalid request. Please check the request body and parameters.",
      });
    }

    const result = await verifyAuthorization(verifyReq);
    console.log(`[Verify] Result:`, result);

    return res.status(200).json(result);
  } catch (err: any) {
    console.error("[Verify] Unexpected error:", err);
    return res.status(500).json({
      errorType: "internal_server_error",
      errorMessage: "An internal server error occurred. Please try again later.",
    });
  }
});

app.post("/settle", async (req, res) => {
  try {
    const settleReq = req.body as SettleRequest;
    console.log(`[Settle] Request received from:`, req.ip);
    console.log(`[Settle] Request body:`, JSON.stringify(settleReq, null, 2));

    // 必須フィールドのチェック（リクエスト形式の検証）
    if (!settleReq.x402Version || !settleReq.paymentPayload || !settleReq.paymentRequirements) {
      console.log(`[Settle] Invalid request format, returning 400`);
      return res.status(400).json({
        errorType: "invalid_request",
        errorMessage: "Invalid request. Please check the request body and parameters.",
      });
    }

    const result = await settleAuthorization(settleReq);
    console.log(`[Settle] Settlement result:`, result);
    console.log(`[Settle] Sending 200 OK response to client...`);

    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({
      errorType: "internal_server_error",
      errorMessage: "An internal server error occurred. Please try again later.",
    });
  }
});

// Vercelデプロイ時はappをエクスポート、ローカル開発時はサーバーを起動
if (process.env.VERCEL || process.env.VERCEL_ENV) {
  // Vercel環境ではappをエクスポート
  // @ts-ignore - Vercel用のCommonJSエクスポート
  module.exports = app;
} else {
  // ローカル開発環境ではサーバーを起動
  const PORT = 4021;
  app.listen(PORT, () => {
    console.log(`[${new Date().toISOString()}] Facilitator running on http://localhost:${PORT}`);
  });
}
