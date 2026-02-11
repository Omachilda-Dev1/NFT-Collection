const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("Starting deployment (without real VRF)...\n");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");
  
  // Deploy Mock VRF Coordinator for testing
  console.log("Deploying MockVRFCoordinatorV2...");
  const MockVRF = await hre.ethers.getContractFactory("MockVRFCoordinatorV2");
  const mockVRF = await MockVRF.deploy();
  await mockVRF.waitForDeployment();
  const mockVRFAddress = await mockVRF.getAddress();
  console.log("MockVRFCoordinatorV2 deployed to:", mockVRFAddress);
  
  // Use simple subscription ID for mock
  const subId = 1;
  console.log("Using mock subscription ID:", subId);
  
  const VRF_KEY_HASH = "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c";
  const HIDDEN_METADATA_URI = "ipfs://QmYourHiddenMetadataHash/hidden.json";
  
  // Deploy NFT Collection with mock VRF
  console.log("\nDeploying NFTCollection...");
  const NFTCollection = await hre.ethers.getContractFactory("NFTCollection");
  const nftCollection = await NFTCollection.deploy(
    mockVRFAddress,
    subId,
    VRF_KEY_HASH,
    HIDDEN_METADATA_URI
  );
  await nftCollection.waitForDeployment();
  const nftAddress = await nftCollection.getAddress();
  console.log("NFTCollection deployed to:", nftAddress);
  
  // Deploy Reward Token
  console.log("\nDeploying RewardToken...");
  const RewardToken = await hre.ethers.getContractFactory("RewardToken");
  const rewardToken = await RewardToken.deploy();
  await rewardToken.waitForDeployment();
  const rewardAddress = await rewardToken.getAddress();
  console.log("RewardToken deployed to:", rewardAddress);
  
  // Deploy Staking Contract
  console.log("\nDeploying NFTStaking...");
  const NFTStaking = await hre.ethers.getContractFactory("NFTStaking");
  const nftStaking = await NFTStaking.deploy(nftAddress, rewardAddress);
  await nftStaking.waitForDeployment();
  const stakingAddress = await nftStaking.getAddress();
  console.log("NFTStaking deployed to:", stakingAddress);
  
  // Setup: Add staking contract as minter
  console.log("\nSetting up permissions...");
  const tx = await rewardToken.addMinter(stakingAddress);
  await tx.wait();
  console.log("Staking contract added as minter");
  
  // Save deployment addresses
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      NFTCollection: nftAddress,
      RewardToken: rewardAddress,
      NFTStaking: stakingAddress,
      MockVRFCoordinator: mockVRFAddress
    },
    vrfConfig: {
      coordinator: mockVRFAddress,
      keyHash: VRF_KEY_HASH,
      subscriptionId: subId,
      note: "Using MockVRFCoordinatorV2 for testing"
    }
  };
  
  fs.writeFileSync(
    "deployment-info.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("\n✅ Deployment complete!");
  console.log("\nDeployment info saved to deployment-info.json");
  console.log("\n⚠️  NOTE: This deployment uses a MOCK VRF coordinator.");
  console.log("For production, create a real Chainlink VRF subscription.");
  console.log("\nNext steps:");
  console.log("1. Activate public minting");
  console.log("2. Test minting on frontend");
  console.log("3. Update frontend with contract addresses");
  console.log("\nVerify contracts with:");
  console.log(`npx hardhat verify --network sepolia ${nftAddress} ${mockVRFAddress} ${subId} ${VRF_KEY_HASH} ${HIDDEN_METADATA_URI}`);
  console.log(`npx hardhat verify --network sepolia ${rewardAddress}`);
  console.log(`npx hardhat verify --network sepolia ${stakingAddress} ${nftAddress} ${rewardAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
