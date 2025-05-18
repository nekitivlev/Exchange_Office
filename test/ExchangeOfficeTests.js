const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ExchangeOffice", function () {
  let SimpleToken;
  let ExchangeOffice;
  let token;
  let exchange;
  let owner;
  let addr1;
  let addr2;
  let addrs;

  // Use a much smaller value for initialSupply to avoid overflows
  const initialSupply = ethers.utils.parseEther("1000"); // 1000 tokens
  // Use a small, fixed rate (1 token = 0.01 ETH)
  const tokenRate = ethers.utils.parseEther("0.01");

  beforeEach(async function () {
    // Deploy contracts
    SimpleToken = await ethers.getContractFactory("SimpleToken");
    ExchangeOffice = await ethers.getContractFactory("ExchangeOffice");

    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    token = await SimpleToken.deploy(initialSupply);
    await token.deployed();

    exchange = await ExchangeOffice.deploy();
    await exchange.deployed();

    // Set rate and supply tokens to exchange
    await exchange.setRate(token.address, tokenRate);

    // Supply only 100 tokens to the exchange
    const supplyAmount = ethers.utils.parseEther("100");
    await token.approve(exchange.address, supplyAmount);
    await exchange.supplyToken(token.address, supplyAmount);

    // Fund the exchange with ETH for tests
    await owner.sendTransaction({
      to: exchange.address,
      value: ethers.utils.parseEther("10")
    });
  });

  describe("Deployment and Setup", function () {
    it("Should set the right owner", async function () {
      expect(await exchange.owner()).to.equal(owner.address);
    });

    it("Should correctly set token rate", async function () {
      expect(await exchange.getRate(token.address)).to.equal(tokenRate);
    });

    it("Should have correct token balance after supply", async function () {
      const supplyAmount = ethers.utils.parseEther("100");
      expect(await token.balanceOf(exchange.address)).to.equal(supplyAmount);
    });

    it("Should emit RateSet event when setting rate", async function () {
      const newRate = ethers.utils.parseEther("0.02");
      await expect(exchange.setRate(token.address, newRate))
          .to.emit(exchange, "RateSet")
          .withArgs(token.address, newRate);
    });

    it("Should fail if rate is set to zero", async function () {
      await expect(exchange.setRate(token.address, 0))
          .to.be.revertedWith("Rate must be greater than 0");
    });

    it("Should fail if rate is set too high", async function () {
      const tooHighRate = ethers.constants.MaxUint256;
      await expect(exchange.setRate(token.address, tooHighRate))
          .to.be.revertedWith("Rate too high");
    });
  });

  describe("Buying tokens", function () {
    it("Should allow buying tokens with exact ETH", async function () {
      // Buy 1 token
      const buyAmount = ethers.utils.parseEther("1");
      // 1 token at 0.01 ETH per token = 0.01 ETH
      const weiRequired = ethers.utils.parseEther("0.01");

      await expect(exchange.connect(addr1).buy(token.address, buyAmount, { value: weiRequired }))
          .to.emit(exchange, "TokensBought")
          .withArgs(addr1.address, token.address, buyAmount, weiRequired);

      expect(await token.balanceOf(addr1.address)).to.equal(buyAmount);
    });

    it("Should refund excess ETH when buying tokens", async function () {
      // Buy 1 token
      const buyAmount = ethers.utils.parseEther("1");
      // 1 token at 0.01 ETH per token = 0.01 ETH
      const weiRequired = ethers.utils.parseEther("0.01");
      // Send 0.02 ETH (excess of 0.01 ETH)
      const weiToSend = ethers.utils.parseEther("0.02");

      const initialBalance = await addr1.getBalance();

      const tx = await exchange.connect(addr1).buy(token.address, buyAmount, {
        value: weiToSend
      });

      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);

      const finalBalance = await addr1.getBalance();

      // Should have spent weiRequired + gasCost
      // Excess should have been refunded
      const expectedSpent = weiRequired.add(gasCost);
      const actualSpent = initialBalance.sub(finalBalance);

      expect(actualSpent).to.be.closeTo(expectedSpent, ethers.utils.parseEther("0.001"));
      expect(await token.balanceOf(addr1.address)).to.equal(buyAmount);
    });

    it("Should fail if not enough ETH sent", async function () {
      // Buy 1 token
      const buyAmount = ethers.utils.parseEther("1");
      // 1 token at 0.01 ETH per token = 0.01 ETH
      // Send only 0.009 ETH (not enough)
      const insufficientWei = ethers.utils.parseEther("0.009");

      await expect(exchange.connect(addr1).buy(token.address, buyAmount, { value: insufficientWei }))
          .to.be.revertedWith("Insufficient ETH sent for purchase");
    });

    it("Should fail if exchange has insufficient token balance", async function () {
      // Try to buy 200 tokens when exchange only has 100
      const buyAmount = ethers.utils.parseEther("200");
      const weiRequired = ethers.utils.parseEther("2"); // 200 tokens * 0.01 ETH

      await expect(exchange.connect(addr1).buy(token.address, buyAmount, {
        value: weiRequired
      })).to.be.revertedWith("Insufficient exchange office token balance");
    });

    it("Should fail buying an unsupported token", async function () {
      const buyAmount = ethers.utils.parseEther("1");
      const weiRequired = ethers.utils.parseEther("0.01");

      await expect(exchange.connect(addr1).buy(addr2.address, buyAmount, {
        value: weiRequired
      })).to.be.revertedWith("Token not supported");
    });
  });

  describe("Selling tokens", function () {
    beforeEach(async function () {
      // Mint tokens directly to addr1
      await token.mint(addr1.address, ethers.utils.parseEther("10"));
    });

    it("Should allow selling tokens for ETH", async function () {
      const sellAmount = ethers.utils.parseEther("5"); // 5 tokens
      const weiToReceive = ethers.utils.parseEther("0.05"); // 5 tokens * 0.01 ETH

      await token.connect(addr1).approve(exchange.address, sellAmount);

      const initialBalance = await addr1.getBalance();

      const tx = await exchange.connect(addr1).sell(token.address, sellAmount);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);

      const finalBalance = await addr1.getBalance();

      // Should have received weiToReceive minus gas costs
      const expectedReceived = weiToReceive.sub(gasCost);
      const actualReceived = finalBalance.sub(initialBalance);

      expect(actualReceived).to.be.closeTo(expectedReceived, ethers.utils.parseEther("0.001"));
      expect(await token.balanceOf(addr1.address)).to.equal(ethers.utils.parseEther("5"));
    });

    it("Should emit TokensSold event when selling tokens", async function () {
      const sellAmount = ethers.utils.parseEther("5"); // 5 tokens
      const weiToReceive = ethers.utils.parseEther("0.05"); // 5 tokens * 0.01 ETH

      await token.connect(addr1).approve(exchange.address, sellAmount);

      await expect(exchange.connect(addr1).sell(token.address, sellAmount))
          .to.emit(exchange, "TokensSold")
          .withArgs(addr1.address, token.address, sellAmount, weiToReceive);
    });

    it("Should fail if seller has insufficient token balance", async function () {
      const sellAmount = ethers.utils.parseEther("20"); // 20 tokens when user only has 10

      await token.connect(addr1).approve(exchange.address, sellAmount);

      await expect(exchange.connect(addr1).sell(token.address, sellAmount))
          .to.be.revertedWith("Insufficient token balance");
    });

    it("Should fail if exchange has insufficient ETH balance", async function () {
      // Drain exchange ETH
      await exchange.withdrawETH(await ethers.provider.getBalance(exchange.address));

      const sellAmount = ethers.utils.parseEther("5");

      await token.connect(addr1).approve(exchange.address, sellAmount);

      await expect(exchange.connect(addr1).sell(token.address, sellAmount))
          .to.be.revertedWith("Insufficient exchange office ETH balance");
    });

    it("Should fail if tokens not approved for exchange", async function () {
      const sellAmount = ethers.utils.parseEther("5");

      // No approval

      await expect(exchange.connect(addr1).sell(token.address, sellAmount))
          .to.be.revertedWith("ERC20: insufficient allowance");
    });
  });

  describe("Administrative functions", function () {
    it("Should allow owner to pause exchange", async function () {
      await exchange.pause();
      expect(await exchange.paused()).to.equal(true);
    });

    it("Should not allow operations when paused", async function () {
      await exchange.pause();

      const buyAmount = ethers.utils.parseEther("1");
      const weiRequired = ethers.utils.parseEther("0.01");

      await expect(exchange.connect(addr1).buy(token.address, buyAmount, { value: weiRequired }))
          .to.be.revertedWith("Pausable: paused");
    });

    it("Should allow owner to unpause exchange", async function () {
      await exchange.pause();
      await exchange.unpause();
      expect(await exchange.paused()).to.equal(false);
    });

    it("Should allow owner to withdraw tokens", async function () {
      const withdrawAmount = ethers.utils.parseEther("10");
      const initialBalance = await token.balanceOf(owner.address);

      await expect(exchange.withdrawToken(token.address, withdrawAmount))
          .to.emit(exchange, "EmergencyWithdraw")
          .withArgs(token.address, withdrawAmount);

      expect(await token.balanceOf(owner.address)).to.equal(initialBalance.add(withdrawAmount));
    });

    it("Should allow owner to withdraw ETH", async function () {
      // Exchange already has ETH from beforeEach
      const withdrawAmount = ethers.utils.parseEther("1");
      const initialBalance = await owner.getBalance();

      const tx = await exchange.withdrawETH(withdrawAmount);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);

      const finalBalance = await owner.getBalance();

      // Should have received withdrawAmount minus gas costs
      const expectedReceived = withdrawAmount.sub(gasCost);
      const actualReceived = finalBalance.sub(initialBalance);

      expect(actualReceived).to.be.closeTo(expectedReceived, ethers.utils.parseEther("0.001"));
    });

    it("Should allow owner to initiate shutdown", async function () {
      await expect(exchange.initiateShutdown())
          .to.emit(exchange, "ShutdownInitiated")
          .withArgs(owner.address);

      expect(await exchange.isShutdown()).to.equal(true);
      expect(await exchange.paused()).to.equal(true);
    });

    it("Should not allow unpause after shutdown", async function () {
      await exchange.initiateShutdown();
      await expect(exchange.unpause()).to.be.revertedWith("Cannot unpause: contract is shut down");
    });
  });

  describe("Access control", function () {
    it("Should fail if non-owner tries to set rates", async function () {
      await expect(exchange.connect(addr1).setRate(token.address, tokenRate))
          .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should fail if non-owner tries to supply tokens", async function () {
      await expect(exchange.connect(addr1).supplyToken(token.address, 1))
          .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should fail if non-owner tries to pause", async function () {
      await expect(exchange.connect(addr1).pause())
          .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should fail if non-owner tries to withdraw tokens", async function () {
      await expect(exchange.connect(addr1).withdrawToken(token.address, 1))
          .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should fail if non-owner tries to withdraw ETH", async function () {
      await expect(exchange.connect(addr1).withdrawETH(1))
          .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should fail if non-owner tries to initiate shutdown", async function () {
      await expect(exchange.connect(addr1).initiateShutdown())
          .to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Edge cases", function () {
    it("Should handle zero token transfers correctly", async function () {
      // Buy 0 tokens (should fail as it makes no sense)
      const buyAmount = ethers.utils.parseEther("0");
      const weiToSend = ethers.utils.parseEther("0.01");

      // This should revert with a different error than insufficient ETH
      // The exact error may vary depending on implementation
      await expect(exchange.connect(addr1).buy(token.address, buyAmount, {
        value: weiToSend
      })).to.be.reverted;
    });

    it("Should handle token rate changes correctly", async function () {
      // Change rate to 0.02 ETH per token
      const newRate = ethers.utils.parseEther("0.02");
      await exchange.setRate(token.address, newRate);

      // Buy 1 token at new rate
      const buyAmount = ethers.utils.parseEther("1");
      const weiRequired = ethers.utils.parseEther("0.02");

      await exchange.connect(addr1).buy(token.address, buyAmount, { value: weiRequired });

      expect(await token.balanceOf(addr1.address)).to.equal(buyAmount);

      // Should fail if sending old rate amount
      const oldWeiAmount = ethers.utils.parseEther("0.01");
      await expect(exchange.connect(addr1).buy(token.address, buyAmount, {
        value: oldWeiAmount
      })).to.be.revertedWith("Insufficient ETH sent for purchase");
    });

    it("Should handle multiple token purchases correctly", async function () {
      // Buy tokens multiple times
      const buyAmount1 = ethers.utils.parseEther("1");
      const weiRequired1 = ethers.utils.parseEther("0.01");

      await exchange.connect(addr1).buy(token.address, buyAmount1, { value: weiRequired1 });

      const buyAmount2 = ethers.utils.parseEther("2");
      const weiRequired2 = ethers.utils.parseEther("0.02");

      await exchange.connect(addr1).buy(token.address, buyAmount2, { value: weiRequired2 });

      expect(await token.balanceOf(addr1.address)).to.equal(
          buyAmount1.add(buyAmount2)
      );
    });

    it("Should support multiple tokens with different rates", async function () {
      // Deploy a second token
      const token2 = await SimpleToken.deploy(initialSupply);
      await token2.deployed();

      // Set a different rate for token2
      const token2Rate = ethers.utils.parseEther("0.005"); // 0.005 ETH per token
      await exchange.setRate(token2.address, token2Rate);

      // Supply token2 to exchange
      const supplyAmount = ethers.utils.parseEther("100");
      await token2.approve(exchange.address, supplyAmount);
      await exchange.supplyToken(token2.address, supplyAmount);

      // Verify both rates are set correctly
      expect(await exchange.getRate(token.address)).to.equal(tokenRate);
      expect(await exchange.getRate(token2.address)).to.equal(token2Rate);

      // Buy both tokens
      const buyAmount1 = ethers.utils.parseEther("1");
      const weiRequired1 = ethers.utils.parseEther("0.01");

      await exchange.connect(addr1).buy(token.address, buyAmount1, { value: weiRequired1 });

      const buyAmount2 = ethers.utils.parseEther("2");
      const weiRequired2 = ethers.utils.parseEther("0.01"); // 2 tokens * 0.005 ETH

      await exchange.connect(addr1).buy(token2.address, buyAmount2, { value: weiRequired2 });

      expect(await token.balanceOf(addr1.address)).to.equal(buyAmount1);
      expect(await token2.balanceOf(addr1.address)).to.equal(buyAmount2);
    });
  });
});