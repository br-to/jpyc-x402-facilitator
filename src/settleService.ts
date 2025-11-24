import { parseSignature } from "viem";
import { SettleRequest, SettleResponse } from "./types";
import { jpycContract } from "./common";

export async function settleAuthorization(req: SettleRequest): Promise<SettleResponse> {
  const { paymentPayload } = req;
  const { authorization } = paymentPayload.payload;
  const payer = authorization.from;
  const network = paymentPayload.network;

  console.log(`[Settle] Processing authorization from ${authorization.from} to ${authorization.to}, value: ${authorization.value}`);

  try {
    const signature = parseSignature(paymentPayload.payload.signature as `0x${string}`);
    const v = signature.yParity === 0 ? 27 : 28;

    const hash = await jpycContract.write.transferWithAuthorization([
      authorization.from as `0x${string}`,
      authorization.to as `0x${string}`,
      BigInt(authorization.value),
      BigInt(authorization.validAfter),
      BigInt(authorization.validBefore),
      authorization.nonce as `0x${string}`,
      v,
      signature.r as `0x${string}`,
      signature.s as `0x${string}`,
    ]);

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
