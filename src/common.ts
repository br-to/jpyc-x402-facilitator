import { createPublicClient, createWalletClient, http, getContract } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";
import { jpycAbi } from "./jpycAbi";

// 環境変数が設定されているかチェック
if (!process.env.RELAYER_PK || !process.env.RPC_URL || !process.env.JPYC_CONTRACT_ADDRESS) {
  throw new Error("Required environment variables must be set");
}

export const account = privateKeyToAccount(process.env.RELAYER_PK as `0x${string}`);

export const publicClient = createPublicClient({
  chain: polygon,
  transport: http(process.env.RPC_URL),
});

export const walletClient = createWalletClient({
  account,
  chain: polygon,
  transport: http(process.env.RPC_URL),
});

export const jpycContract = getContract({
  address: process.env.JPYC_CONTRACT_ADDRESS as `0x${string}`,
  abi: jpycAbi,
  client: { public: publicClient, wallet: walletClient },
});
