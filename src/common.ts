import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";
import dotenv from "dotenv";
// @ts-ignore - JPYC SDKの型定義が正しく解決されないため
import { JPYC } from "@jpyc/sdk-core/dist/src/jpyc";
dotenv.config();

export const account = privateKeyToAccount(process.env.RELAYER_PK as `0x${string}`);

export const walletClient = createWalletClient({
  account,
  chain: polygon,
  transport: http(process.env.RPC_URL),
});

export const jpyc = new JPYC({ client: walletClient });
