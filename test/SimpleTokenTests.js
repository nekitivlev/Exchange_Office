const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SimpleToken", function () {
  let SimpleToken;
  let token;
  let owner;
  let addr1;
  let addr2;
  let addrs;

  // Using smaller values to avoid any potential overflow issues
  const initialSupply = ethers.utils.parseEther("1000"); // 1000 tokens
  const MAX_SUPPLY = ethers.utils.parseEther("1000000000"); // 1 billion tokens

  beforeEach(async function () {
    SimpleToken = await ethers.getContractFactory("SimpleToken");
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
    token = await SimpleToken.deploy(initialSupply);
    await token.deployed();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await token.owner()).to.equal(owner.address);
    });

    it("Should assign the total supply of tokens to the owner", async function () {
      const ownerBalance = await token.balanceOf(owner.address);
      expect(await token.totalSupply()).to.equal(ownerBalance);
    });

    it("Should set the max supply correctly", async function () {
      expect(await token.MAX_SUPPLY()).to.equal(MAX_SUPPLY);
    });

    it("Should revert if initial supply exceeds max supply", async function () {
      const ExcessiveSupply = MAX_SUPPLY.add(1);
      await expect(SimpleToken.deploy(ExcessiveSupply)).to.be.revertedWith("Initial supply exceeds maximum");
    });
  });

  describe("Transactions", function () {
    it("Should transfer tokens between accounts", async function () {
      // Use a smaller transfer amount
      const transferAmount = ethers.utils.parseEther("50");

      // Transfer from owner to addr1
      await token.transfer(addr1.address, transferAmount);
      const addr1Balance = await token.balanceOf(addr1.address);
      expect(addr1Balance).to.equal(transferAmount);

      // Transfer from addr1 to addr2
      await token.connect(addr1).transfer(addr2.address, transferAmount);
      const addr2Balance = await token.balanceOf(addr2.address);
      expect(addr2Balance).to.equal(transferAmount);
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      const initialOwnerBalance = await token.balanceOf(owner.address);

      // addr1 has no tokens initially
      await expect(
          token.connect(addr1).transfer(owner.address, 1)
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");

      // Owner balance shouldn't have changed
      expect(await token.balanceOf(owner.address)).to.equal(initialOwnerBalance);
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint new tokens", async function () {
      const mintAmount = ethers.utils.parseEther("100");
      const initialSupply = await token.totalSupply();

      await token.mint(addr1.address, mintAmount);

      expect(await token.balanceOf(addr1.address)).to.equal(mintAmount);
      expect(await token.totalSupply()).to.equal(initialSupply.add(mintAmount));
    });

    it("Should emit TokensMinted event when minting", async function () {
      const mintAmount = ethers.utils.parseEther("100");

      await expect(token.mint(addr1.address, mintAmount))
          .to.emit(token, "TokensMinted")
          .withArgs(addr1.address, mintAmount);
    });

    it("Should fail if non-owner tries to mint", async function () {
      const mintAmount = ethers.utils.parseEther("100");

      await expect(
          token.connect(addr1).mint(addr2.address, mintAmount)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should fail if minting to zero address", async function () {
      const mintAmount = ethers.utils.parseEther("100");

      await expect(
          token.mint(ethers.constants.AddressZero, mintAmount)
      ).to.be.revertedWith("Cannot mint to zero address");
    });

    it("Should fail if minting would exceed max supply", async function () {
      // Calculate the exact amount that would exceed the max supply
      const remainingSupply = await token.remainingMintableSupply();
      const excessiveAmount = remainingSupply.add(1);

      await expect(
          token.mint(addr1.address, excessiveAmount)
      ).to.be.revertedWith("Would exceed maximum supply");
    });

    it("Should correctly calculate remaining mintable supply", async function () {
      const totalSupply = await token.totalSupply();
      const expectedRemaining = MAX_SUPPLY.sub(totalSupply);

      expect(await token.remainingMintableSupply()).to.equal(expectedRemaining);

      // Test after minting some tokens
      const mintAmount = ethers.utils.parseEther("100");
      await token.mint(addr1.address, mintAmount);

      const newTotalSupply = await token.totalSupply();
      const newExpectedRemaining = MAX_SUPPLY.sub(newTotalSupply);

      expect(await token.remainingMintableSupply()).to.equal(newExpectedRemaining);
    });
  });

  describe("Pausable functionality", function () {
    it("Should allow owner to pause transfers", async function () {
      await token.pause();
      expect(await token.paused()).to.equal(true);

      const transferAmount = ethers.utils.parseEther("50");
      await expect(
          token.transfer(addr1.address, transferAmount)
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should allow owner to unpause transfers", async function () {
      await token.pause();
      await token.unpause();
      expect(await token.paused()).to.equal(false);

      const transferAmount = ethers.utils.parseEther("50");
      await token.transfer(addr1.address, transferAmount);
      expect(await token.balanceOf(addr1.address)).to.equal(transferAmount);
    });

    it("Should fail if non-owner tries to pause", async function () {
      await expect(
          token.connect(addr1).pause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should fail if non-owner tries to unpause", async function () {
      await token.pause();
      await expect(
          token.connect(addr1).unpause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not allow minting when paused", async function () {
      await token.pause();

      const mintAmount = ethers.utils.parseEther("100");
      await expect(
          token.mint(addr1.address, mintAmount)
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Token metadata", function () {
    it("Should have correct name and symbol", async function () {
      expect(await token.name()).to.equal("Simple");
      expect(await token.symbol()).to.equal("SIMP");
    });

    it("Should have 18 decimals", async function () {
      expect(await token.decimals()).to.equal(18);
    });
  });
});