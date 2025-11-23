import express from "express";
import cors from "cors";
import { verifyAuthorization, settleAuthorization } from "./services3009";
import { Authorization, VerifyResponse, SettleResponse } from "./types";
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
    const auth = req.body.auth as Authorization;

    if (!auth) {
      return res.status(400).json({ ok: false, error: "Missing auth object" } as VerifyResponse);
    }

    const result = await verifyAuthorization(auth);

    if (!result.ok) {
      return res.status(400).json(result as VerifyResponse);
    }

    return res.json({ ok: true } as VerifyResponse);
  } catch (err: any) {
    console.error("[Verify] Error:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "verify failed"
    } as VerifyResponse);
  }
});

app.post("/settle", async (req, res) => {
  try {
    const auth = req.body.auth as Authorization;

    if (!auth) {
      return res.status(400).json({
        ok: false,
        error: "Missing auth object"
      } as SettleResponse);
    }

    const result = await settleAuthorization(auth);

    return res.json({
      ok: true,
      txHash: result.hash
    } as SettleResponse);
  } catch (err: any) {
    console.error("[Settle] Error:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "settle failed"
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
