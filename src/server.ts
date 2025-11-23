import express from "express";
import cors from "cors";
import { verifyAuthorization, settleAuthorization } from "./services3009";
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

    // 必須フィールドのチェック
    if (!verifyReq.x402Version || !verifyReq.paymentPayload || !verifyReq.paymentRequirements) {
      return res.status(400).json({
        isValid: false,
        invalidReason: "invalid_payload",
        payer: verifyReq.paymentPayload?.payload?.authorization?.from || "unknown",
      } as VerifyResponse);
    }

    const result = await verifyAuthorization(verifyReq);

    // x402標準: 検証が失敗しても200を返す（isValid=falseで示す）
    return res.json(result);
  } catch (err: any) {
    console.error("[Verify] Error:", err);
    return res.status(500).json({
      isValid: false,
      invalidReason: "invalid_payload",
      payer: "unknown",
    } as VerifyResponse);
  }
});

app.post("/settle", async (req, res) => {
  try {
    const settleReq = req.body as SettleRequest;

    // 必須フィールドのチェック
    if (!settleReq.x402Version || !settleReq.paymentPayload || !settleReq.paymentRequirements) {
      return res.status(400).json({
        isValid: false,
        invalidReason: "invalid_payload",
        payer: settleReq.paymentPayload?.payload?.authorization?.from || "unknown",
      } as SettleResponse);
    }

    const result = await settleAuthorization(settleReq);

    // x402標準: 決済が失敗しても200を返す（isValid=falseで示す）
    return res.json(result);
  } catch (err: any) {
    console.error("[Settle] Error:", err);
    return res.status(500).json({
      isValid: false,
      invalidReason: "invalid_payload",
      payer: "unknown",
    } as SettleResponse);
  }
});

// Vercelデプロイ時はappをエクスポート、ローカル開発時はサーバーを起動
if (process.env.VERCEL || process.env.VERCEL_ENV) {
  // Vercel環境ではappをエクスポート
  // @ts-ignore - Vercel用のCommonJSエクスポート
  module.exports = app;
} else {
  // ローカル開発環境ではサーバーを起動
  const PORT = process.env.PORT || 4021;
  app.listen(PORT, () => {
    console.log(`[${new Date().toISOString()}] Facilitator running on http://localhost:${PORT}`);
  });
}
