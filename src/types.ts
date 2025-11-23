// x402 Standard Types (Coinbase CDP準拠)

export interface Authorization {
  from: string;
  to: string;
  value: string;
  validAfter: string | number;
  validBefore: string | number;
  nonce: string;
}

export interface ExactEvmPayload {
  signature: string;
  authorization: Authorization;
}

export interface PaymentPayload {
  x402Version: number;
  scheme: "exact";
  network: "polygon" | "base" | "base-sepolia" | "polygon-amoy";
  payload: ExactEvmPayload;
}

export interface PaymentRequirements {
  scheme: "exact";
  network: "polygon" | "base" | "base-sepolia" | "polygon-amoy";
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra?: Record<string, any>;
}

export interface VerifyRequest {
  x402Version: number;
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
}

export type InvalidReason =
  | "insufficient_funds"
  | "invalid_scheme"
  | "invalid_network"
  | "invalid_x402_version"
  | "invalid_payment_requirements"
  | "invalid_payload"
  | "invalid_exact_evm_payload_authorization_value"
  | "invalid_exact_evm_payload_authorization_value_too_low"
  | "invalid_exact_evm_payload_authorization_valid_after"
  | "invalid_exact_evm_payload_authorization_valid_before"
  | "invalid_exact_evm_payload_authorization_typed_data_message"
  | "invalid_exact_evm_payload_authorization_from_address_kyt"
  | "invalid_exact_evm_payload_authorization_to_address_kyt"
  | "invalid_exact_evm_payload_signature"
  | "invalid_exact_evm_payload_signature_address";

export interface VerifyResponse {
  isValid: boolean;
  invalidReason?: InvalidReason;
  payer: string;
}

export interface SettleRequest {
  x402Version: number;
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
}

export interface SettleResponse {
  isValid: boolean;
  txHash?: string;
  invalidReason?: InvalidReason;
  payer: string;
}
