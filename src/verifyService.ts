import { isAddress, recoverTypedDataAddress, parseSignature } from "viem";
import { VerifyRequest, VerifyResponse, InvalidReason, Authorization } from "./types";
import { jpyc } from "./common";

// x402リクエストのバリデーション
function validateX402Request(req: VerifyRequest): { valid: boolean; reason?: InvalidReason } {
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

  const x402Validation = validateX402Request(req);
  if (!x402Validation.valid) {
    return {
      isValid: false,
      invalidReason: x402Validation.reason,
      payer,
    };
  }

  const authValidation = validateAuthorization(authorization, paymentRequirements);
  if (!authValidation.valid) {
    return {
      isValid: false,
      invalidReason: authValidation.reason,
      payer,
    };
  }

  try {
    // @ts-ignore
    const authState = await jpyc.contract.read.authorizationState([
      authorization.from as `0x${string}`,
      authorization.nonce as `0x${string}`,
    ]);
    if (authState === true) {
      return {
        isValid: false,
        invalidReason: "invalid_payload",
        payer,
      };
    }
  } catch (error) {
    console.error("Failed to check authorization state:", error);
  }

  try {
    const balance = await jpyc.balanceOf({
      account: authorization.from as `0x${string}`,
    });
    const valueInJPYC = Number(authorization.value) / 1e18;
    if (balance < valueInJPYC) {
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
    const signature = parseSignature(paymentPayload.payload.signature as `0x${string}`);

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
