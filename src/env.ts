import dotenv from "dotenv";
dotenv.config();

const requiredEnvVars = [
  "RPC_URL",
  "RELAYER_PK",
  "JPYC_CONTRACT_ADDRESS",
  "CHAIN_ID",
] as const;

export function validateEnv() {
  const missing: string[] = [];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  // CHAIN_IDが数値かチェック
  const chainId = Number(process.env.CHAIN_ID);
  if (isNaN(chainId)) {
    throw new Error("CHAIN_ID must be a number");
  }

  // RELAYER_PKが0xで始まるかチェック
  if (!process.env.RELAYER_PK?.startsWith("0x")) {
    throw new Error("RELAYER_PK must be a valid hex string starting with 0x");
  }

  // JPYC_CONTRACT_ADDRESSが0xで始まるかチェック
  if (!process.env.JPYC_CONTRACT_ADDRESS?.startsWith("0x")) {
    throw new Error("JPYC_CONTRACT_ADDRESS must be a valid address starting with 0x");
  }

  console.log("✓ Environment variables validated");
}
