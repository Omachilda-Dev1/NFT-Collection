const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("Starting minting and staking demo...\n");
  
  // Load deployment info
  const deploymentInfo = JSON.parse(fs.readFileSync("deployment-info.json", "utf8"));
  const { NFTCollection, NFTStaking } = deploymentInfo.contracts;
  
  const [deployer, user1, user2] = await hre.ethers.getSigners();
  
  // Get contract instances
  const nftCollection = await hre.ethers.getContractAt("NFTCollection", NFTCollection);
  const nftStaking = await hre.ethers.getContractAt("NFTStaking", NFTStaking);
  
  const MINT_PRICE = hre.ethers.parseEther("0.01");
  
  // Activate public minting
  console.log("Activating public minting...");
  await nftCollection.setPublicMintActive(true);
  console.log("✅ Public minting activated\n");
  
  // Mint 10 NFTs
  console.log("Minting 10 NFTs...");
  for (let i = 0; i < 10; i++) {
    const signer = i < 5 ? user1 : user2;
    const tx = await nftCollection.connect(signer).publicMint({ value: MINT_PRICE });
    await tx.wait();
    console.log(`✅ Minted NFT #${i} to ${signer.address}`);
  }
  
  console.log("\n📊 Checking rarities...");
  for (let i = 0; i < 10; i++) {
    const rarity = await nftCollection.tokenRarity(i);
    const rarityName = rarity === 1n ? "Common" : rarity === 2n ? "Rare" : "Legendary";
    console.log(`NFT #${i}: ${rarityName}`);
  }
  
  // Stake 5 NFTs
  console.log("\n🔒 Staking 5 NFTs...");
  
  // Approve staking contract
  await nftCollection.connect(user1).setApprovalForAll(NFTStaking, true);
  
  // Stake tokens 0-4
  for (let i = 0; i < 5; i++) {
    const tx = await nftStaking.connect(user1).stake(i);
    await tx.wait();
    console.log(`✅ Staked NFT #${i}`);
  }
  
  // Check staking info
  console.log("\n📈 Staking Summary:");
  const stakedTokens = await nftStaking.getStakedTokens(user1.address);
  console.log(`User1 has ${stakedTokens.length} NFTs staked`);
  
  for (let i = 0; i < stakedTokens.length; i++) {
    const tokenId = stakedTokens[i];
    const stakeInfo = await nftStaking.getStakeInfo(tokenId);
    const rarityName = stakeInfo.rarity === 1n ? "Common" : stakeInfo.rarity === 2n ? "Rare" : "Legendary";
    console.log(`  - NFT #${tokenId}: ${rarityName}, Staked at: ${new Date(Number(stakeInfo.stakedAt) * 1000).toLocaleString()}`);
  }
  
  console.log("\n✅ Demo complete!");
  console.log("\nSummary:");
  console.log("- 10 NFTs minted");
  console.log("- 5 NFTs staked");
  console.log("- Rewards will accumulate over time based on rarity");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
