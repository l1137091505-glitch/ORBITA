import { BrowserProvider, Contract, JsonRpcProvider, formatEther, parseEther, type JsonRpcSigner } from "ethers";

export const BOT_CHAIN = {
  chainId: 677,
  chainIdHex: "0x2a5",
  name: "BOT Chain Mainnet",
  rpcUrl: "https://rpc.botchain.ai",
  explorer: "https://scan.botchain.ai",
  currency: { name: "BOT", symbol: "BOT", decimals: 18 },
};

export const CONTRACT_ADDRESS = (import.meta.env.VITE_ORBITAL_ADDRESS ?? "").trim();
export const ORBITAL_ABI = [
  "function APR_BPS() view returns (uint256)",
  "function totalPrincipal() view returns (uint256)",
  "function rewardReserve() view returns (uint256)",
  "function totalRewardsPaid() view returns (uint256)",
  "function getPosition(address) view returns (uint256 principal,uint256 pending,uint64 updatedAt)",
  "function deposit() payable",
  "function withdraw(uint256 amount)",
  "function claim() returns (uint256 amount)",
  "function compound() returns (uint256 amount)",
  "function fundRewards() payable",
] as const;

export const readProvider = new JsonRpcProvider(BOT_CHAIN.rpcUrl);

type InjectedProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
};

export function injected() {
  return (window as Window & { ethereum?: InjectedProvider }).ethereum;
}

export async function connectWallet(): Promise<{ provider: BrowserProvider; signer: JsonRpcSigner; address: string }> {
  const ethereum = injected();
  if (!ethereum) throw new Error("No EVM wallet detected. Install or open a browser wallet first.");
  try {
    await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BOT_CHAIN.chainIdHex }] });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? Number((error as { code: unknown }).code) : 0;
    if (code !== 4902) throw error;
    await ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: BOT_CHAIN.chainIdHex,
        chainName: BOT_CHAIN.name,
        nativeCurrency: BOT_CHAIN.currency,
        rpcUrls: [BOT_CHAIN.rpcUrl],
        blockExplorerUrls: [BOT_CHAIN.explorer],
      }],
    });
  }
  const provider = new BrowserProvider(ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  return { provider, signer, address: await signer.getAddress() };
}

export function readContract() {
  return CONTRACT_ADDRESS ? new Contract(CONTRACT_ADDRESS, ORBITAL_ABI, readProvider) : null;
}

export function writeContract(signer: JsonRpcSigner) {
  if (!CONTRACT_ADDRESS) throw new Error("Contract address is not configured.");
  return new Contract(CONTRACT_ADDRESS, ORBITAL_ABI, signer);
}

export function bot(value: bigint, digits = 4) {
  return Number(formatEther(value)).toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function short(value: string) { return `${value.slice(0, 6)}…${value.slice(-4)}`; }
export { parseEther };
