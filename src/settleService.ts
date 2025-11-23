import { parseSignature } from "viem";
import { Uint256, Uint8 } from "soltypes";
import { SettleRequest, SettleResponse } from "./types";
import { jpyc } from "./common";
import { verifyAuthorization } from "./verifyService";

export async function settleAuthorization(req: SettleRequest): Promise<SettleResponse> {
  const { paymentPayload } = req;
  const { authorization } = paymentPayload.payload;
  const payer = authorization.from;
  const network = paymentPayload.network;

  const verification = await verifyAuthorization(req);
  if (!verification.isValid) {
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
    const signature = parseSignature(paymentPayload.payload.signature as `0x${string}`);
    const v = signature.yParity + 27;
    const valueInJPYC = Number(authorization.value) / 1e18;

    const hash = await jpyc.transferWithAuthorization({
      from: authorization.from as `0x${string}`,
      to: authorization.to as `0x${string}`,
      value: valueInJPYC,
      validAfter: Uint256.from(authorization.validAfter.toString()),
      validBefore: Uint256.from(authorization.validBefore.toString()),
      nonce: authorization.nonce as `0x${string}`,
      v: Uint8.from(v.toString()),
      r: signature.r as `0x${string}`,
      s: signature.s as `0x${string}`,
    });

    console.log(`[Settle] Transaction sent: ${hash}`);

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
