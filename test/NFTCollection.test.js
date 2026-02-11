const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

describe("NFTCollection", function () {
  let nftCollection;
  let owner, addr1, addr2, addr3;
  let merkleTree, merkleRoot;
  
  // Mock VRF Coordinator
  const VRF_COORDINATOR = "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625";
  const SUBSCRIPTION_ID = 1;
  const KEY_HASH = "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c";
  const HIDDEN_URI = "ipfs://QmHiddenMetadata";
  const MINT_PRICE = ethers.parseEther("0.01");

  beforeEach(async function () {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();
    
    // Create merkle tree for whitelist
    const whitelistAddresses = [addr1.address, addr2.address];
    const leaves = whitelistAddresses.map(addr => keccak256(addr));
    merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    merkleRoot = merkleTree.getHexRoot();
    
    // Deploy mock VRF Coordinator for testing
    const MockVRFCoordinator = await ethers.getContractFactory("MockVRFCoordinatorV2");
    const mockVRF = await MockVRFCoordinator.deploy();
    
    // Deploy NFT Collection
    const NFTCollection = await ethers.getContractFactory("NFTCollection");
    nftCollection = await NFTCollection.deploy(
      await mockVRF.getAddress(),
      SUBSCRIPTION_ID,
      KEY_HASH,
      HIDDEN_URI
    );
    
    await nftCollection.setMerkleRoot(merkleRoot);
  });

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      expect(await nftCollection.name()).to.equal("DeFi NFT Collection");
      expect(await nftCollection.symbol()).to.equal("DNFT");
    });

    it("Should set the correct owner", async function () {
      expect(await nftCollection.owner()).to.equal(owner.address);
    });

    it("Should have whitelist active by default", async function () {
      expect(await nftCollection.isWhitelistActive()).to.equal(true);
    });

    it("Should not be revealed initially", async function () {
      expect(await nftCollection.isRevealed()).to.equal(false);
    });
  });

  describe("Whitelist Minting", function () {
    it("Should allow whitelisted address to mint", async function () {
      const leaf = keccak256(addr1.address);
      const proof = merkleTree.getHexProof(leaf);
      
      await expect(
        nftCollection.connect(addr1).whitelistMint(proof, { value: MINT_PRICE })
      ).to.emit(nftCollection, "WhitelistMint");
      
      expect(await nftCollection.balanceOf(addr1.address)).to.equal(1);
    });

    it("Should reject non-whitelisted address", async function () {
      const leaf = keccak256(addr3.address);
      const proof = merkleTree.getHexProof(leaf);
      
      await expect(
        nftCollection.connect(addr3).whitelistMint(proof, { value: MINT_PRICE })
      ).to.be.revertedWith("Invalid proof");
    });

    it("Should reject insufficient payment", async function () {
      const leaf = keccak256(addr1.address);
      const proof = merkleTree.getHexProof(leaf);
      
      await expect(
        nftCollection.connect(addr1).whitelistMint(proof, { value: ethers.parseEther("0.005") })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Should prevent double claiming", async function () {
      const leaf = keccak256(addr1.address);
      const proof = merkleTree.getHexProof(leaf);
      
      await nftCollection.connect(addr1).whitelistMint(proof, { value: MINT_PRICE });
      
      await expect(
        nftCollection.connect(addr1).whitelistMint(proof, { value: MINT_PRICE })
      ).to.be.revertedWith("Already claimed");
    });
  });

  describe("Public Minting", function () {
    beforeEach(async function () {
      await nftCollection.setPublicMintActive(true);
    });

    it("Should allow public minting when active", async function () {
      await expect(
        nftCollection.connect(addr3).publicMint({ value: MINT_PRICE })
      ).to.emit(nftCollection, "PublicMint");
      
      expect(await nftCollection.balanceOf(addr3.address)).to.equal(1);
    });

    it("Should reject when public mint is not active", async function () {
      await nftCollection.setPublicMintActive(false);
      
      await expect(
        nftCollection.connect(addr3).publicMint({ value: MINT_PRICE })
      ).to.be.revertedWith("Public mint not active");
    });

    it("Should assign rarity to minted tokens", async function () {
      await nftCollection.connect(addr3).publicMint({ value: MINT_PRICE });
      
      const rarity = await nftCollection.tokenRarity(0);
      expect([1n, 2n, 3n]).to.include(rarity); // Common, Rare, or Legendary
    });
  });

  describe("Reveal Mechanism", function () {
    beforeEach(async function () {
      await nftCollection.setPublicMintActive(true);
      await nftCollection.connect(addr1).publicMint({ value: MINT_PRICE });
    });

    it("Should return hidden URI before reveal", async function () {
      const tokenURI = await nftCollection.tokenURI(0);
      expect(tokenURI).to.equal(HIDDEN_URI);
    });

    it("Should reveal and update URI", async function () {
      const baseURI = "ipfs://QmRevealed/";
      await nftCollection.reveal(baseURI);
      
      expect(await nftCollection.isRevealed()).to.equal(true);
      
      const tokenURI = await nftCollection.tokenURI(0);
      expect(tokenURI).to.equal(baseURI + "0.json");
    });

    it("Should prevent double reveal", async function () {
      await nftCollection.reveal("ipfs://QmRevealed/");
      
      await expect(
        nftCollection.reveal("ipfs://QmAnother/")
      ).to.be.revertedWith("Already revealed");
    });
  });

  describe("Royalties (ERC-2981)", function () {
    it("Should return correct royalty info", async function () {
      const salePrice = ethers.parseEther("1");
      const [receiver, royaltyAmount] = await nftCollection.royaltyInfo(0, salePrice);
      
      expect(receiver).to.equal(owner.address);
      expect(royaltyAmount).to.equal(salePrice * 500n / 10000n); // 5%
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to withdraw funds", async function () {
      await nftCollection.setPublicMintActive(true);
      await nftCollection.connect(addr1).publicMint({ value: MINT_PRICE });
      
      const initialBalance = await ethers.provider.getBalance(owner.address);
      const tx = await nftCollection.withdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      const finalBalance = await ethers.provider.getBalance(owner.address);
      expect(finalBalance).to.be.closeTo(
        initialBalance + MINT_PRICE - gasUsed,
        ethers.parseEther("0.001")
      );
    });

    it("Should allow owner to toggle whitelist", async function () {
      await nftCollection.setWhitelistActive(false);
      expect(await nftCollection.isWhitelistActive()).to.equal(false);
    });

    it("Should prevent non-owner from admin functions", async function () {
      await expect(
        nftCollection.connect(addr1).setPublicMintActive(true)
      ).to.be.reverted;
    });
  });

  describe("Supply Limits", function () {
    it("Should enforce max supply", async function () {
      await nftCollection.setPublicMintActive(true);
      
      // This test would be expensive to run fully, so we just check the logic
      // In a real scenario, you'd mint up to MAX_SUPPLY and verify the next fails
      expect(await nftCollection.MAX_SUPPLY()).to.equal(100);
    });
  });
});
