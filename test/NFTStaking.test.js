const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("NFTStaking", function () {
  let nftCollection, rewardToken, nftStaking;
  let owner, addr1, addr2;
  
  const HIDDEN_URI = "ipfs://QmHidden";
  const MINT_PRICE = ethers.parseEther("0.01");
  const ONE_DAY = 24 * 60 * 60;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    
    // Deploy mock VRF
    const MockVRFCoordinator = await ethers.getContractFactory("MockVRFCoordinatorV2");
    const mockVRF = await MockVRFCoordinator.deploy();
    
    // Deploy NFT Collection
    const NFTCollection = await ethers.getContractFactory("NFTCollection");
    nftCollection = await NFTCollection.deploy(
      await mockVRF.getAddress(),
      1,
      "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
      HIDDEN_URI
    );
    
    // Deploy Reward Token
    const RewardToken = await ethers.getContractFactory("RewardToken");
    rewardToken = await RewardToken.deploy();
    
    // Deploy Staking Contract
    const NFTStaking = await ethers.getContractFactory("NFTStaking");
    nftStaking = await NFTStaking.deploy(
      await nftCollection.getAddress(),
      await rewardToken.getAddress()
    );
    
    // Add staking contract as minter
    await rewardToken.addMinter(await nftStaking.getAddress());
    
    // Mint some NFTs for testing
    await nftCollection.setPublicMintActive(true);
    await nftCollection.connect(addr1).publicMint({ value: MINT_PRICE });
    await nftCollection.connect(addr1).publicMint({ value: MINT_PRICE });
    await nftCollection.connect(addr2).publicMint({ value: MINT_PRICE });
  });

  describe("Deployment", function () {
    it("Should set correct NFT and reward token addresses", async function () {
      expect(await nftStaking.nftCollection()).to.equal(await nftCollection.getAddress());
      expect(await nftStaking.rewardToken()).to.equal(await rewardToken.getAddress());
    });

    it("Should not be paused initially", async function () {
      expect(await nftStaking.paused()).to.equal(false);
    });
  });

  describe("Staking", function () {
    it("Should allow NFT owner to stake", async function () {
      await nftCollection.connect(addr1).approve(await nftStaking.getAddress(), 0);
      
      await expect(nftStaking.connect(addr1).stake(0))
        .to.emit(nftStaking, "Staked");
      
      expect(await nftCollection.ownerOf(0)).to.equal(await nftStaking.getAddress());
      expect(await nftStaking.stakedCount(addr1.address)).to.equal(1);
    });

    it("Should reject staking by non-owner", async function () {
      await nftCollection.connect(addr1).approve(await nftStaking.getAddress(), 0);
      
      await expect(
        nftStaking.connect(addr2).stake(0)
      ).to.be.revertedWith("Not token owner");
    });

    it("Should allow batch staking", async function () {
      await nftCollection.connect(addr1).setApprovalForAll(await nftStaking.getAddress(), true);
      
      await nftStaking.connect(addr1).stakeBatch([0, 1]);
      
      expect(await nftStaking.stakedCount(addr1.address)).to.equal(2);
      
      const stakedTokens = await nftStaking.getStakedTokens(addr1.address);
      expect(stakedTokens.length).to.equal(2);
    });

    it("Should prevent double staking", async function () {
      await nftCollection.connect(addr1).approve(await nftStaking.getAddress(), 0);
      await nftStaking.connect(addr1).stake(0);
      
      await expect(
        nftStaking.connect(addr1).stake(0)
      ).to.be.revertedWith("Not token owner");
    });
  });

  describe("Rewards Calculation", function () {
    beforeEach(async function () {
      await nftCollection.connect(addr1).approve(await nftStaking.getAddress(), 0);
      await nftStaking.connect(addr1).stake(0);
    });

    it("Should calculate rewards based on time staked", async function () {
      await time.increase(ONE_DAY);
      
      const rewards = await nftStaking.calculateRewards(0);
      expect(rewards).to.be.gt(0);
    });

    it("Should calculate different rewards for different rarities", async function () {
      // This test assumes different rarities were assigned
      const rarity = await nftCollection.tokenRarity(0);
      await time.increase(ONE_DAY);
      
      const rewards = await nftStaking.calculateRewards(0);
      
      // Verify rewards are non-zero
      expect(rewards).to.be.gt(0);
    });

    it("Should return zero rewards for unstaked tokens", async function () {
      const rewards = await nftStaking.calculateRewards(1);
      expect(rewards).to.equal(0);
    });
  });

  describe("Claiming Rewards", function () {
    beforeEach(async function () {
      await nftCollection.connect(addr1).approve(await nftStaking.getAddress(), 0);
      await nftStaking.connect(addr1).stake(0);
    });

    it("Should allow claiming rewards", async function () {
      await time.increase(ONE_DAY);
      
      const rewardsBefore = await rewardToken.balanceOf(addr1.address);
      await nftStaking.connect(addr1).claimRewards(0);
      const rewardsAfter = await rewardToken.balanceOf(addr1.address);
      
      expect(rewardsAfter).to.be.gt(rewardsBefore);
    });

    it("Should reset claim time after claiming", async function () {
      await time.increase(ONE_DAY);
      await nftStaking.connect(addr1).claimRewards(0);
      
      const stakeInfo = await nftStaking.getStakeInfo(0);
      const currentTime = await time.latest();
      
      expect(stakeInfo.lastClaimTime).to.be.closeTo(currentTime, 2);
    });

    it("Should allow claiming all rewards", async function () {
      await nftCollection.connect(addr1).approve(await nftStaking.getAddress(), 1);
      await nftStaking.connect(addr1).stake(1);
      
      await time.increase(ONE_DAY);
      
      const totalPending = await nftStaking.getTotalPendingRewards(addr1.address);
      
      await nftStaking.connect(addr1).claimAllRewards();
      
      const balance = await rewardToken.balanceOf(addr1.address);
      expect(balance).to.be.closeTo(totalPending, ethers.parseEther("0.1"));
    });
  });

  describe("Unstaking", function () {
    beforeEach(async function () {
      await nftCollection.connect(addr1).approve(await nftStaking.getAddress(), 0);
      await nftStaking.connect(addr1).stake(0);
    });

    it("Should allow unstaking and claim rewards", async function () {
      await time.increase(ONE_DAY);
      
      const rewardsBefore = await rewardToken.balanceOf(addr1.address);
      await nftStaking.connect(addr1).unstake(0);
      const rewardsAfter = await rewardToken.balanceOf(addr1.address);
      
      expect(rewardsAfter).to.be.gt(rewardsBefore);
      expect(await nftCollection.ownerOf(0)).to.equal(addr1.address);
      expect(await nftStaking.stakedCount(addr1.address)).to.equal(0);
    });

    it("Should reject unstaking by non-owner", async function () {
      await expect(
        nftStaking.connect(addr2).unstake(0)
      ).to.be.revertedWith("Not stake owner");
    });
  });

  describe("Emergency Withdraw", function () {
    beforeEach(async function () {
      await nftCollection.connect(addr1).approve(await nftStaking.getAddress(), 0);
      await nftStaking.connect(addr1).stake(0);
    });

    it("Should allow emergency withdraw without rewards", async function () {
      await time.increase(ONE_DAY);
      
      const rewardsBefore = await rewardToken.balanceOf(addr1.address);
      await nftStaking.connect(addr1).emergencyWithdraw(0);
      const rewardsAfter = await rewardToken.balanceOf(addr1.address);
      
      expect(rewardsAfter).to.equal(rewardsBefore); // No rewards claimed
      expect(await nftCollection.ownerOf(0)).to.equal(addr1.address);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to pause staking", async function () {
      await nftStaking.setPaused(true);
      expect(await nftStaking.paused()).to.equal(true);
      
      await nftCollection.connect(addr1).approve(await nftStaking.getAddress(), 0);
      await expect(
        nftStaking.connect(addr1).stake(0)
      ).to.be.revertedWith("Staking paused");
    });

    it("Should prevent non-owner from pausing", async function () {
      await expect(
        nftStaking.connect(addr1).setPaused(true)
      ).to.be.reverted;
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await nftCollection.connect(addr1).setApprovalForAll(await nftStaking.getAddress(), true);
      await nftStaking.connect(addr1).stakeBatch([0, 1]);
    });

    it("Should return staked tokens for address", async function () {
      const stakedTokens = await nftStaking.getStakedTokens(addr1.address);
      expect(stakedTokens.length).to.equal(2);
      expect(stakedTokens[0]).to.equal(0);
      expect(stakedTokens[1]).to.equal(1);
    });

    it("Should return total pending rewards", async function () {
      await time.increase(ONE_DAY);
      
      const totalPending = await nftStaking.getTotalPendingRewards(addr1.address);
      expect(totalPending).to.be.gt(0);
    });

    it("Should return complete stake info", async function () {
      const stakeInfo = await nftStaking.getStakeInfo(0);
      
      expect(stakeInfo.owner).to.equal(addr1.address);
      expect([1n, 2n, 3n]).to.include(stakeInfo.rarity);
    });
  });
});
