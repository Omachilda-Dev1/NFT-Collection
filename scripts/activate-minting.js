const hre = require("hardhat");
const deploymentInfo = require("../deployment-info.json");

async function main() {
  console.log("Activating public minting...\n");
  
  const nftAddress = deploymentInfo.contracts.NFTCollection;
  console.log("NFT Contract:", nftAddress);
  
  const NFTCollection = await hre.ethers.getContractAt("NFTCollection", nftAddress);
  
  // Check current status
  const isActive = await NFTCollection.isPublicMintActive();
  console.log("Current public mint status:", isActive);
  
  if (!isActive) {
    console.log("\nActivating public mint...");
    const tx = await NFTCollection.setPublicMintActive(true);
    await tx.wait();
    console.log("✅ Public minting activated!");
  } else {
    console.log("✅ Public minting is already active!");
  }
  
  // Show current supply
  const totalSupply = await NFTCollection.totalSupply();
  console.log("\nTotal Supply:", totalSupply.toString(), "/ 100");
  console.log("\nYou can now mint NFTs from the frontend!");
  console.log("Mint price: 0.01 ETH");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
