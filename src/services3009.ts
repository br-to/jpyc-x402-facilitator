import { createWalletClient, createPublicClient, http, getContract, recoverTypedDataAddress, isAddress, formatUnits, hexToSignature } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";
import dotenv from "dotenv";
import { VerifyRequest, SettleRequest, VerifyResponse, SettleResponse, InvalidReason, Authorization, ExactEvmPayload } from "./types";
dotenv.config();

const account = privateKeyToAccount(process.env.RELAYER_PK as `0x${string}`);

const walletClient = createWalletClient({
  account,
  chain: polygon,
  transport: http(process.env.RPC_URL),
});

const publicClient = createPublicClient({
  chain: polygon,
  transport: http(process.env.RPC_URL),
});

const jpycContract = getContract({
  address: process.env.JPYC_CONTRACT_ADDRESS as `0x${string}`,
  abi: [
    {
      name: "transferWithAuthorization",
      type: "function",
      stateMutability: "nonpayable",
      inputs: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
        { name: "v", type: "uint8" },
        { name: "r", type: "bytes32" },
        { name: "s", type: "bytes32" },
      ],
      outputs: [],
    },
    {
      name: "balanceOf",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "account", type: "address" }],
      outputs: [{ name: "", type: "uint256" }],
    },
    {
      name: "authorizationState",
      type: "function",
      stateMutability: "view",
      inputs: [
        { name: "authorizer", type: "address" },
        { name: "nonce", type: "bytes32" },
      ],
      outputs: [{ name: "", type: "uint8" }],
    },
  ],
  client: {
    public: publicClient,
    wallet: walletClient,
  },
});

// 使用済みnonceを追跡（本番環境ではRedis等を使用推奨）
const usedNonces = new Set<string>();

// x402リクエストのバリデーション
function validateX402Request(req: VerifyRequest | SettleRequest): { valid: boolean; reason?: InvalidReason } {
  // x402Versionチェック
  if (req.x402Version !== 1 || req.paymentPayload.x402Version !== 1) {
    return { valid: false, reason: "invalid_x402_version" };
  }

  // schemeチェック
  if (req.paymentPayload.scheme !== "exact" || req.paymentRequirements.scheme !== "exact") {
    return { valid: false, reason: "invalid_scheme" };
  }

  // networkチェック
  if (req.paymentPayload.network !== req.paymentRequirements.network) {
    return { valid: false, reason: "invalid_network" };
  }

  return { valid: true };
}

// Authorizationのバリデーション
function validateAuthorization(
  auth: Authorization,
  requirements: VerifyRequest["paymentRequirements"]
): { valid: boolean; reason?: InvalidReason } {
  if (!isAddress(auth.from)) {
    return { valid: false, reason: "invalid_payload" };
  }

  if (!isAddress(auth.to)) {
    return { valid: false, reason: "invalid_payload" };
  }

  // toアドレスがpaymentRequirementsのpayToと一致するかチェック
  if (auth.to.toLowerCase() !== requirements.payTo.toLowerCase()) {
    return { valid: false, reason: "invalid_payload" };
  }

  const value = BigInt(auth.value);
  if (value <= 0n) {
    return { valid: false, reason: "invalid_exact_evm_payload_authorization_value" };
  }

  // 金額が要求額と一致するかチェック
  const maxAmount = BigInt(requirements.maxAmountRequired);
  if (value < maxAmount) {
    return { valid: false, reason: "invalid_exact_evm_payload_authorization_value_too_low" };
  }

  const validAfter = BigInt(auth.validAfter);
  const validBefore = BigInt(auth.validBefore);
  const now = BigInt(Math.floor(Date.now() / 1000));

  if (validAfter > now) {
    return { valid: false, reason: "invalid_exact_evm_payload_authorization_valid_after" };
  }

  if (validBefore < now) {
    return { valid: false, reason: "invalid_exact_evm_payload_authorization_valid_before" };
  }

  if (validAfter >= validBefore) {
    return { valid: false, reason: "invalid_exact_evm_payload_authorization_valid_before" };
  }

  return { valid: true };
}

export async function verifyAuthorization(req: VerifyRequest): Promise<VerifyResponse> {
  const { paymentPayload, paymentRequirements } = req;
  const { authorization } = paymentPayload.payload;
  const payer = authorization.from;

  // x402リクエストのバリデーション
  const x402Validation = validateX402Request(req);
  if (!x402Validation.valid) {
    return {
      isValid: false,
      invalidReason: x402Validation.reason,
      payer,
    };
  }

  // authorizationのバリデーション
  const authValidation = validateAuthorization(authorization, paymentRequirements);
  if (!authValidation.valid) {
    return {
      isValid: false,
      invalidReason: authValidation.reason,
      payer,
    };
  }

  // nonceの重複チェック
  const nonceKey = `${authorization.from.toLowerCase()}:${authorization.nonce}`;
  if (usedNonces.has(nonceKey)) {
    return {
      isValid: false,
      invalidReason: "invalid_payload",
      payer,
    };
  }

  // コントラクトでnonceの状態を確認
  try {
    const authState = await jpycContract.read.authorizationState([
      authorization.from as `0x${string}`,
      authorization.nonce as `0x${string}`,
    ]);
    if (Number(authState) !== 0) {
      return {
        isValid: false,
        invalidReason: "invalid_payload",
        payer,
      };
    }
  } catch (error) {
    console.error("Failed to check authorization state:", error);
  }

  // 残高チェック
  try {
    const balance = await jpycContract.read.balanceOf([authorization.from as `0x${string}`]);
    const value = BigInt(authorization.value);
    if (balance < value) {
      return {
        isValid: false,
        invalidReason: "insufficient_funds",
        payer,
      };
    }
  } catch (error) {
    console.error("Failed to check balance:", error);
    return {
      isValid: false,
      invalidReason: "invalid_payload",
      payer,
    };
  }

  // EIP-712署名検証
  const domain = {
    name: "JPY Coin",
    version: "1",
    chainId: Number(process.env.CHAIN_ID),
    verifyingContract: process.env.JPYC_CONTRACT_ADDRESS as `0x${string}`,
  };

  const types = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  };

  const message = {
    from: authorization.from as `0x${string}`,
    to: authorization.to as `0x${string}`,
    value: BigInt(authorization.value),
    validAfter: BigInt(authorization.validAfter),
    validBefore: BigInt(authorization.validBefore),
    nonce: authorization.nonce as `0x${string}`,
  };

  try {
    // signatureを分解 (0x + 130文字 = r(64) + s(64) + v(2))
    const sig = paymentPayload.payload.signature;
    const signature = hexToSignature(sig as `0x${string}`);

    const recovered = await recoverTypedDataAddress({
      domain,
      types,
      primaryType: "TransferWithAuthorization",
      message,
      signature,
    });

    const isValid = recovered.toLowerCase() === authorization.from.toLowerCase();
    if (!isValid) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_evm_payload_signature_address",
        payer,
      };
    }

    return {
      isValid: true,
      payer,
    };
  } catch (error) {
    console.error("Signature verification failed:", error);
    return {
      isValid: false,
      invalidReason: "invalid_exact_evm_payload_signature",
      payer,
    };
  }
}

export async function settleAuthorization(req: SettleRequest): Promise<SettleResponse> {
  const { paymentPayload, paymentRequirements } = req;
  const { authorization } = paymentPayload.payload;
  const payer = authorization.from;
  const network = paymentPayload.network;

  // 事前に検証
  const verification = await verifyAuthorization(req);
  if (!verification.isValid) {
    // verifyの結果をsettleレスポンス形式に変換
    return {
      success: false,
      errorReason: verification.invalidReason as any,
      payer: verification.payer,
      transaction: "",
      network,
    };
  }

  console.log(`[Settle] Processing authorization from ${authorization.from} to ${authorization.to}, value: ${authorization.value}`);

  try {
    // signatureを分解
    const sig = paymentPayload.payload.signature;
    const signature = hexToSignature(sig as `0x${string}`);

    // yParityをvに変換 (yParity 0/1 → v 27/28)
    const v = signature.yParity + 27;

    const hash = await jpycContract.write.transferWithAuthorization([
      authorization.from as `0x${string}`,
      authorization.to as `0x${string}`,
      BigInt(authorization.value),
      BigInt(authorization.validAfter),
      BigInt(authorization.validBefore),
      authorization.nonce as `0x${string}`,
      v as 0 | 1 | 27 | 28,
      signature.r,
      signature.s,
    ]);

    console.log(`[Settle] Transaction sent: ${hash}`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // nonceを記録
    const nonceKey = `${authorization.from.toLowerCase()}:${authorization.nonce}`;
    usedNonces.add(nonceKey);

    console.log(`[Settle] Transaction confirmed: ${hash}, status: ${receipt.status}`);

    return {
      success: true,
      payer,
      transaction: hash,
      network,
    };
  } catch (error: any) {
    console.error("[Settle] Error:", error);
    return {
      success: false,
      errorReason: "invalid_payload",
      payer,
      transaction: "",
      network,
    };
  }
}
