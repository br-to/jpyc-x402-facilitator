import { createWalletClient, createPublicClient, http, getContract, recoverTypedDataAddress, isAddress, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";
import dotenv from "dotenv";
import { Authorization } from "./types";
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

// バリデーション関数
function validateAuthorization(auth: Authorization): { valid: boolean; error?: string } {
  if (!auth.from || !auth.to || !auth.value || !auth.nonce || auth.v === undefined || !auth.r || !auth.s) {
    return { valid: false, error: "Missing required fields" };
  }

  if (!isAddress(auth.from)) {
    return { valid: false, error: "Invalid from address" };
  }

  if (!isAddress(auth.to)) {
    return { valid: false, error: "Invalid to address" };
  }

  // rとsは32バイトのhex文字列（0x + 64文字）
  if (!auth.r.startsWith("0x") || auth.r.length !== 66) {
    return { valid: false, error: "Invalid signature r format" };
  }

  if (!auth.s.startsWith("0x") || auth.s.length !== 66) {
    return { valid: false, error: "Invalid signature s format" };
  }

  if (auth.v !== 27 && auth.v !== 28 && auth.v !== 0 && auth.v !== 1) {
    return { valid: false, error: "Invalid signature v value" };
  }

  const value = BigInt(auth.value);
  if (value <= 0n) {
    return { valid: false, error: "Value must be greater than 0" };
  }

  const validAfter = BigInt(auth.validAfter);
  const validBefore = BigInt(auth.validBefore);
  const now = BigInt(Math.floor(Date.now() / 1000));

  if (validAfter > now) {
    return { valid: false, error: "Authorization not yet valid" };
  }

  if (validBefore < now) {
    return { valid: false, error: "Authorization expired" };
  }

  if (validAfter >= validBefore) {
    return { valid: false, error: "Invalid time window" };
  }

  return { valid: true };
}

export async function verifyAuthorization(auth: Authorization): Promise<{ ok: boolean; error?: string }> {
  // バリデーション
  const validation = validateAuthorization(auth);
  if (!validation.valid) {
    return { ok: false, error: validation.error };
  }

  // nonceの重複チェック
  const nonceKey = `${auth.from.toLowerCase()}:${auth.nonce}`;
  if (usedNonces.has(nonceKey)) {
    return { ok: false, error: "Nonce already used" };
  }

  // コントラクトでnonceの状態を確認
  try {
    const authState = await jpycContract.read.authorizationState([
      auth.from as `0x${string}`,
      auth.nonce as `0x${string}`,
    ]);
    // authorizationStateが0以外の場合、既に使用済み
    // authStateはuint8なので、number型として扱う
    if (Number(authState) !== 0) {
      return { ok: false, error: "Nonce already used on chain" };
    }
  } catch (error) {
    console.error("Failed to check authorization state:", error);
    // チェックに失敗しても続行（ネットワークエラーの可能性）
  }

  // 残高チェック
  try {
    const balance = await jpycContract.read.balanceOf([auth.from as `0x${string}`]);
    const value = BigInt(auth.value);
    if (balance < value) {
      return { ok: false, error: `Insufficient balance: ${formatUnits(balance, 18)} JPYC` };
    }
  } catch (error) {
    console.error("Failed to check balance:", error);
    return { ok: false, error: "Failed to verify balance" };
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
    from: auth.from as `0x${string}`,
    to: auth.to as `0x${string}`,
    value: BigInt(auth.value),
    validAfter: BigInt(auth.validAfter),
    validBefore: BigInt(auth.validBefore),
    nonce: auth.nonce as `0x${string}`,
  };

  // vが27または28の場合、yParity = v - 27
  const yParity = auth.v === 27 || auth.v === 28 ? auth.v - 27 : auth.v;
  const signature = {
    r: auth.r as `0x${string}`,
    s: auth.s as `0x${string}`,
    yParity,
  } as const;

  try {
    const recovered = await recoverTypedDataAddress({
      domain,
      types,
      primaryType: "TransferWithAuthorization",
      message,
      signature,
    });

    const isValid = recovered.toLowerCase() === auth.from.toLowerCase();
    if (!isValid) {
      return { ok: false, error: "Invalid signature" };
    }

    return { ok: true };
  } catch (error) {
    console.error("Signature verification failed:", error);
    return { ok: false, error: "Signature verification failed" };
  }
}

export async function settleAuthorization(auth: Authorization): Promise<{ hash: string; receipt: any }> {
  // 事前に検証
  const verification = await verifyAuthorization(auth);
  if (!verification.ok) {
    throw new Error(verification.error || "Authorization verification failed");
  }

  console.log(`[Settle] Processing authorization from ${auth.from} to ${auth.to}, value: ${auth.value}`);

  const hash = await jpycContract.write.transferWithAuthorization([
    auth.from as `0x${string}`,
    auth.to as `0x${string}`,
    BigInt(auth.value),
    BigInt(auth.validAfter),
    BigInt(auth.validBefore),
    auth.nonce as `0x${string}`,
    auth.v as 0 | 1 | 27 | 28,
    auth.r as `0x${string}`,
    auth.s as `0x${string}`,
  ]);

  console.log(`[Settle] Transaction sent: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  // nonceを記録
  const nonceKey = `${auth.from.toLowerCase()}:${auth.nonce}`;
  usedNonces.add(nonceKey);

  console.log(`[Settle] Transaction confirmed: ${hash}, status: ${receipt.status}`);

  return { hash, receipt };
}
