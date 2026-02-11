const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("Starting deployment...\n");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");
  
  // VRF Configuration (Sepolia)
  const VRF_COORDINATOR = process.env.VRF_COORDINATOR || "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625";
  const VRF_KEY_HASH = process.env.VRF_KEY_HASH || "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c";
  const VRF_SUBSCRIPTION_ID = process.env.VRF_SUBSCRIPTION_ID || 1;
  const HIDDEN_METADATA_URI = "ipfs://QmYourHiddenMetadataHash/hidden.json";
  
  // Deploy NFT Collection
  console.log("Deploying NFTCollection...");
  const NFTCollection = await hre.ethers.getContractFactory("NFTCollection");
  const nftCollection = await NFTCollection.deploy(
    VRF_COORDINATOR,
    VRF_SUBSCRIPTION_ID,
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
      NFTStaking: stakingAddress
    },
    vrfConfig: {
      coordinator: VRF_COORDINATOR,
      keyHash: VRF_KEY_HASH,
      subscriptionId: VRF_SUBSCRIPTION_ID
    }
  };
  
  fs.writeFileSync(
    "deployment-info.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("\n✅ Deployment complete!");
  console.log("\nDeployment info saved to deployment-info.json");
  console.log("\nNext steps:");
  console.log("1. Add VRF consumer:", nftAddress);
  console.log("2. Set merkle root for whitelist");
  console.log("3. Activate minting phases");
  console.log("4. Upload metadata to IPFS");
  console.log("\nVerify contracts with:");
  console.log(`npx hardhat verify --network sepolia ${nftAddress} ${VRF_COORDINATOR} ${VRF_SUBSCRIPTION_ID} ${VRF_KEY_HASH} ${HIDDEN_METADATA_URI}`);
  console.log(`npx hardhat verify --network sepolia ${rewardAddress}`);
  console.log(`npx hardhat verify --network sepolia ${stakingAddress} ${nftAddress} ${rewardAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
