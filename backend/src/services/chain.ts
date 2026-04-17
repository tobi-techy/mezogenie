import { createPublicClient, createWalletClient, http, parseEther, formatEther, defineChain, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const mezoTestnet = defineChain({
  id: 31611,
  name: "Mezo Testnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.MEZO_RPC_URL || "https://rpc.test.mezo.org"] },
  },
  blockExplorers: {
    default: { name: "Mezo Explorer", url: "https://explorer.test.mezo.org" },
  },
});

export const publicClient = createPublicClient({ chain: mezoTestnet, transport: http() });

function getWalletClient() {
  if (!process.env.DEPLOYER_PRIVATE_KEY) throw new Error("DEPLOYER_PRIVATE_KEY not set");
  const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`);
  return createWalletClient({ account, chain: mezoTestnet, transport: http() });
}

// --- ABI fragments for our contracts ---
const REMIT_ABI = [
  { name: "pendingClaims", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "getFamilyVaultBalance", type: "function", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "getTotalRemittances", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "getSenderRemittanceCount", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "getRecipientRemittanceCount", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "sendRemittance", type: "function", stateMutability: "payable", inputs: [{ type: "address" }, { type: "uint256" }, { type: "uint8" }, { type: "address" }, { type: "address" }], outputs: [] },
  { name: "claimMUSD", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

const SAFE_ABI = [
  { name: "getLock", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "tuple", components: [{ name: "btcAmount", type: "uint256" }, { name: "lockUntil", type: "uint256" }, { name: "coolingOffEnabled", type: "bool" }, { name: "withdrawRequestTime", type: "uint256" }] }] },
  { name: "lockBTC", type: "function", stateMutability: "payable", inputs: [{ type: "uint256" }, { type: "bool" }], outputs: [] },
  { name: "requestWithdraw", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

// Mezo core contract addresses (testnet)
const BORROWER_OPS = "0x20fAeA18B6a1D0FCDBCcFfFe3d164314744baF30" as Address;
const TROVE_MANAGER = "0xD374631405613990d62984a08663A28248678975" as Address;
const MUSD_TOKEN = "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503" as Address;

// MezoGenie contract addresses — set after deployment
const REMIT_VAULT = (process.env.REMIT_VAULT_ADDRESS || "0x0") as Address;
const SAFE_VAULT = (process.env.SAFE_VAULT_ADDRESS || "0x0") as Address;

export async function getBTCBalance(address: Address): Promise<string> {
  const bal = await publicClient.getBalance({ address });
  return formatEther(bal);
}

export async function getPendingClaim(recipient: Address): Promise<string> {
  const result = await publicClient.readContract({
    address: REMIT_VAULT, abi: REMIT_ABI, functionName: "pendingClaims", args: [recipient],
  });
  return formatEther(result);
}

export async function getFamilyVault(sender: Address, recipient: Address): Promise<string> {
  const result = await publicClient.readContract({
    address: REMIT_VAULT, abi: REMIT_ABI, functionName: "getFamilyVaultBalance", args: [sender, recipient],
  });
  return formatEther(result);
}

export async function getSafeLock(user: Address) {
  const result = await publicClient.readContract({
    address: SAFE_VAULT, abi: SAFE_ABI, functionName: "getLock", args: [user],
  });
  return {
    btcAmount: formatEther(result.btcAmount),
    lockUntil: new Date(Number(result.lockUntil) * 1000).toISOString(),
    coolingOffEnabled: result.coolingOffEnabled,
    hasPendingWithdraw: result.withdrawRequestTime > 0n,
  };
}

export async function sendRemittance(recipient: Address, musdAmount: string, savingsPercent: number, collateralBTC: string) {
  const wallet = getWalletClient();
  const hash = await wallet.writeContract({
    address: REMIT_VAULT, abi: REMIT_ABI, functionName: "sendRemittance",
    args: [recipient, parseEther(musdAmount), savingsPercent, "0x0000000000000000000000000000000000000000" as Address, "0x0000000000000000000000000000000000000000" as Address],
    value: parseEther(collateralBTC),
  });
  return { hash, explorer: `https://explorer.test.mezo.org/tx/${hash}` };
}

export async function lockBTC(durationDays: number, coolingOff: boolean, amount: string) {
  const wallet = getWalletClient();
  const hash = await wallet.writeContract({
    address: SAFE_VAULT, abi: SAFE_ABI, functionName: "lockBTC",
    args: [BigInt(durationDays), coolingOff],
    value: parseEther(amount),
  });
  return { hash, explorer: `https://explorer.test.mezo.org/tx/${hash}` };
}

export { parseEther, formatEther };
