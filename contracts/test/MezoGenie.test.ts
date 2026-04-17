import { expect } from "chai";
import { ethers } from "hardhat";
import { RemitVault, SafeVault } from "../typechain-types";

describe("MezoGenie Contracts", function () {
  let musd: any, borrowerOps: any, troveManager: any, hintHelpers: any, sortedTroves: any;
  let remitVault: RemitVault, safeVault: SafeVault;
  let sender: any, recipient: any, family: any;

  beforeEach(async function () {
    [sender, recipient, family] = await ethers.getSigners();

    const MockMUSD = await ethers.getContractFactory("MockMUSD");
    musd = await MockMUSD.deploy();

    const MockBorrowerOps = await ethers.getContractFactory("MockBorrowerOperations");
    borrowerOps = await MockBorrowerOps.deploy(await musd.getAddress());

    const MockTroveManager = await ethers.getContractFactory("MockTroveManager");
    troveManager = await MockTroveManager.deploy();

    const MockHintHelpers = await ethers.getContractFactory("MockHintHelpers");
    hintHelpers = await MockHintHelpers.deploy();

    const MockSortedTroves = await ethers.getContractFactory("MockSortedTroves");
    sortedTroves = await MockSortedTroves.deploy();

    const RemitVaultFactory = await ethers.getContractFactory("RemitVault");
    remitVault = await RemitVaultFactory.deploy(
      await borrowerOps.getAddress(),
      await troveManager.getAddress(),
      await hintHelpers.getAddress(),
      await sortedTroves.getAddress(),
      await musd.getAddress()
    ) as RemitVault;

    const SafeVaultFactory = await ethers.getContractFactory("SafeVault");
    safeVault = await SafeVaultFactory.deploy(
      await borrowerOps.getAddress(),
      await musd.getAddress()
    ) as SafeVault;
  });

  describe("RemitVault", function () {
    it("should send a remittance and allow recipient to claim", async function () {
      const musdAmount = ethers.parseEther("500");
      const collateral = ethers.parseEther("1");

      await remitVault.connect(sender).sendRemittance(
        recipient.address, musdAmount, 0,
        ethers.ZeroAddress, ethers.ZeroAddress,
        { value: collateral }
      );

      expect(await remitVault.pendingClaims(recipient.address)).to.equal(musdAmount);
      expect(await remitVault.getTotalRemittances()).to.equal(1);

      // Mint MUSD to the vault so it can transfer to recipient
      await musd.mint(await remitVault.getAddress(), musdAmount);

      await remitVault.connect(recipient).claimMUSD();
      expect(await remitVault.pendingClaims(recipient.address)).to.equal(0);
      expect(await musd.balanceOf(recipient.address)).to.equal(musdAmount);
    });

    it("should split savings into family vault", async function () {
      const musdAmount = ethers.parseEther("500");
      const collateral = ethers.parseEther("1");
      const savingsPercent = 10; // 10% = 50 MUSD

      await remitVault.connect(sender).sendRemittance(
        recipient.address, musdAmount, savingsPercent,
        ethers.ZeroAddress, ethers.ZeroAddress,
        { value: collateral }
      );

      const expectedSend = ethers.parseEther("450");
      const expectedSave = ethers.parseEther("50");

      expect(await remitVault.pendingClaims(recipient.address)).to.equal(expectedSend);
      expect(await remitVault.getFamilyVaultBalance(sender.address, recipient.address)).to.equal(expectedSave);
    });

    it("should allow sender to withdraw family vault to recipient", async function () {
      const musdAmount = ethers.parseEther("500");
      await remitVault.connect(sender).sendRemittance(
        recipient.address, musdAmount, 20,
        ethers.ZeroAddress, ethers.ZeroAddress,
        { value: ethers.parseEther("1") }
      );

      const savedAmount = ethers.parseEther("100");
      await musd.mint(await remitVault.getAddress(), savedAmount);

      await remitVault.connect(sender).withdrawFamilyVault(recipient.address, savedAmount);
      expect(await musd.balanceOf(recipient.address)).to.equal(savedAmount);
      expect(await remitVault.getFamilyVaultBalance(sender.address, recipient.address)).to.equal(0);
    });

    it("should track sender and recipient history", async function () {
      await remitVault.connect(sender).sendRemittance(
        recipient.address, ethers.parseEther("100"), 0,
        ethers.ZeroAddress, ethers.ZeroAddress,
        { value: ethers.parseEther("0.5") }
      );
      await remitVault.connect(sender).sendRemittance(
        recipient.address, ethers.parseEther("200"), 0,
        ethers.ZeroAddress, ethers.ZeroAddress,
        { value: ethers.parseEther("0.5") }
      );

      expect(await remitVault.getSenderRemittanceCount(sender.address)).to.equal(2);
      expect(await remitVault.getRecipientRemittanceCount(recipient.address)).to.equal(2);
    });

    it("should reject zero amount", async function () {
      await expect(
        remitVault.connect(sender).sendRemittance(
          recipient.address, 0, 0,
          ethers.ZeroAddress, ethers.ZeroAddress,
          { value: ethers.parseEther("1") }
        )
      ).to.be.revertedWith("Amount must be > 0");
    });

    it("should reject invalid recipient", async function () {
      await expect(
        remitVault.connect(sender).sendRemittance(
          ethers.ZeroAddress, ethers.parseEther("100"), 0,
          ethers.ZeroAddress, ethers.ZeroAddress,
          { value: ethers.parseEther("1") }
        )
      ).to.be.revertedWith("Invalid recipient");
    });
  });

  describe("SafeVault", function () {
    it("should lock BTC with a time lock", async function () {
      const amount = ethers.parseEther("1");
      await safeVault.connect(sender).lockBTC(30, false, { value: amount });

      const lock = await safeVault.getLock(sender.address);
      expect(lock.btcAmount).to.equal(amount);
      expect(lock.coolingOffEnabled).to.equal(false);
    });

    it("should prevent withdrawal before lock expires", async function () {
      await safeVault.connect(sender).lockBTC(30, false, { value: ethers.parseEther("1") });

      await expect(
        safeVault.connect(sender).requestWithdraw()
      ).to.be.revertedWith("Lock period not expired");
    });

    it("should allow withdrawal after lock expires (no cooling off)", async function () {
      await safeVault.connect(sender).lockBTC(1, false, { value: ethers.parseEther("1") });

      // Fast forward 2 days
      await ethers.provider.send("evm_increaseTime", [2 * 86400]);
      await ethers.provider.send("evm_mine", []);

      const balBefore = await ethers.provider.getBalance(sender.address);
      await safeVault.connect(sender).requestWithdraw();
      const balAfter = await ethers.provider.getBalance(sender.address);

      expect(balAfter).to.be.greaterThan(balBefore - ethers.parseEther("0.01")); // minus gas
    });

    it("should enforce cooling-off period", async function () {
      await safeVault.connect(sender).lockBTC(1, true, { value: ethers.parseEther("1") });

      // Fast forward past lock
      await ethers.provider.send("evm_increaseTime", [2 * 86400]);
      await ethers.provider.send("evm_mine", []);

      await safeVault.connect(sender).requestWithdraw();

      // Try immediate execute — should fail
      await expect(
        safeVault.connect(sender).executeWithdraw()
      ).to.be.revertedWith("Cooling-off period not expired");

      // Fast forward past cooling off (72h)
      await ethers.provider.send("evm_increaseTime", [73 * 3600]);
      await ethers.provider.send("evm_mine", []);

      await safeVault.connect(sender).executeWithdraw();
      const lock = await safeVault.getLock(sender.address);
      expect(lock.btcAmount).to.equal(0);
    });

    it("should reject lock with zero BTC", async function () {
      await expect(
        safeVault.connect(sender).lockBTC(30, false, { value: 0 })
      ).to.be.revertedWith("Must send BTC");
    });
  });
});
