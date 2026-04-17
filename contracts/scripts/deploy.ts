import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BTC");

  // ---- MEZO TESTNET CORE ADDRESSES ----
  const BORROWER_OPS = process.env.MEZO_BORROWER_OPS || "0x20fAeA18B6a1D0FCDBCcFfFe3d164314744baF30";
  const TROVE_MANAGER = process.env.MEZO_TROVE_MANAGER || "0xD374631405613990d62984a08663A28248678975";
  const HINT_HELPERS = process.env.MEZO_HINT_HELPERS || "0x8adF3f35dBE4026112bCFc078872bcb967732Ea8";
  const SORTED_TROVES = process.env.MEZO_SORTED_TROVES || "0xD54700Ad42fc49A829DCD3C377aD7B9ed176656A";
  const MUSD_TOKEN = process.env.MEZO_MUSD_TOKEN || "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503";

  console.log("\n--- Deploying RemitVault ---");
  const RemitVault = await ethers.getContractFactory("RemitVault");
  const remitVault = await RemitVault.deploy(
    BORROWER_OPS, TROVE_MANAGER, HINT_HELPERS, SORTED_TROVES, MUSD_TOKEN
  );
  await remitVault.waitForDeployment();
  console.log("RemitVault:", await remitVault.getAddress());

  console.log("\n--- Deploying SafeVault ---");
  const SafeVault = await ethers.getContractFactory("SafeVault");
  const safeVault = await SafeVault.deploy(BORROWER_OPS, MUSD_TOKEN);
  await safeVault.waitForDeployment();
  console.log("SafeVault:", await safeVault.getAddress());

  // Save deployment addresses
  const addresses = {
    network: "mezoTestnet",
    chainId: 31611,
    deployer: deployer.address,
    remitVault: await remitVault.getAddress(),
    safeVault: await safeVault.getAddress(),
    mezoCore: { BORROWER_OPS, TROVE_MANAGER, HINT_HELPERS, SORTED_TROVES, MUSD_TOKEN },
    timestamp: new Date().toISOString(),
  };

  const outPath = path.join(__dirname, "../deployments.json");
  fs.writeFileSync(outPath, JSON.stringify(addresses, null, 2));
  console.log("\nAddresses saved to", outPath);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
