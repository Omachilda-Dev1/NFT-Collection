# 🚀 Deployment Guide

Complete step-by-step guide for deploying the DeFi NFT Collection to Sepolia testnet.

## Prerequisites

1. **Node.js & npm** installed
2. **MetaMask** wallet with Sepolia ETH
3. **Alchemy** or **Infura** account for RPC
4. **Etherscan** API key for verification
5. **Chainlink VRF** subscription

## Step 1: Environment Setup

### Get Sepolia ETH
1. Visit [Alchemy Sepolia Faucet](https://sepoliafaucet.com/)
2. Or [Chainlink Faucet](https://faucets.chain.link/)
3. Request test ETH to your wallet

### Get RPC URL
1. Create account on [Alchemy](https://www.alchemy.com/)
2. Create new app (Ethereum → Sepolia)
3. Copy HTTP URL

### Get Etherscan API Key
1. Create account on [Etherscan](https://etherscan.io/)
2. Go to API Keys section
3. Create new API key

### Setup Chainlink VRF
1. Visit [Chainlink VRF](https://vrf.chain.link/)
2. Connect wallet to Sepolia
3. Create new subscription
4. Fund with LINK tokens (get from [Chainlink Faucet](https://faucets.chain.link/))
5. Note your Subscription ID

### Configure .env
```bash
cp .env.example .env
```

Edit `.env`:
```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
PRIVATE_KEY=your_wallet_private_key_without_0x
ETHERSCAN_API_KEY=your_etherscan_api_key
VRF_COORDINATOR=0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625
VRF_KEY_HASH=0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c
VRF_SUBSCRIPTION_ID=your_subscription_id
```

## Step 2: Install Dependencies

```bash
npm install
```

## Step 3: Compile Contracts

```bash
npx hardhat compile
```

Expected output:
```
Compiled 15 Solidity files successfully
```

## Step 4: Run Tests

```bash
# Run all tests
npx hardhat test

# Check coverage
npx hardhat coverage
```

All tests should pass ✅

## Step 5: Deploy to Sepolia

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

Expected output:
```
Starting deployment...

Deploying contracts with account: 0x...
Account balance: 0.5 ETH

Deploying NFTCollection...
NFTCollection deployed to: 0x...

Deploying RewardToken...
RewardToken deployed to: 0x...

Deploying NFTStaking...
NFTStaking deployed to: 0x...

Setting up permissions...
Staking contract added as minter

✅ Deployment complete!
```

Save the contract addresses from `deployment-info.json`

## Step 6: Add VRF Consumer

1. Go to [Chainlink VRF](https://vrf.chain.link/)
2. Select your subscription
3. Click "Add consumer"
4. Enter your NFTCollection contract address
5. Confirm transaction

## Step 7: Verify Contracts on Etherscan

```bash
# Verify NFT Collection
npx hardhat verify --network sepolia <NFT_ADDRESS> \
  "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625" \
  <SUBSCRIPTION_ID> \
  "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c" \
  "ipfs://QmYourHiddenMetadataHash/hidden.json"

# Verify Reward Token
npx hardhat verify --network sepolia <REWARD_TOKEN_ADDRESS>

# Verify Staking Contract
npx hardhat verify --network sepolia <STAKING_ADDRESS> \
  <NFT_ADDRESS> \
  <REWARD_TOKEN_ADDRESS>
```

## Step 8: Upload Metadata to IPFS

### Option A: Using Pinata (Recommended)

1. Create account on [Pinata](https://pinata.cloud/)
2. Get API keys
3. Upload metadata:

```bash
USE_PINATA=true \
PINATA_API_KEY=your_key \
PINATA_SECRET_KEY=your_secret \
node metadata/upload-to-ipfs.js
```

### Option B: Using Infura IPFS

```bash
INFURA_PROJECT_ID=your_id \
INFURA_API_SECRET=your_secret \
node metadata/upload-to-ipfs.js
```

Save the IPFS CIDs for hidden and revealed metadata.

## Step 9: Configure NFT Contract

### Set Merkle Root for Whitelist

```javascript
// Create whitelist
const addresses = [
  "0xAddress1",
  "0xAddress2",
  // ... more addresses
];

// Generate merkle tree
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

const leaves = addresses.map(addr => keccak256(addr));
const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
const root = tree.getHexRoot();

console.log("Merkle Root:", root);
```

Set the root:
```bash
npx hardhat console --network sepolia

> const nft = await ethers.getContractAt("NFTCollection", "0xYourNFTAddress")
> await nft.setMerkleRoot("0xYourMerkleRoot")
```

### Activate Minting Phases

```bash
# Activate whitelist minting
> await nft.setWhitelistActive(true)

# Later, activate public minting
> await nft.setPublicMintActive(true)
```

## Step 10: Test Minting & Staking

Run the demo script:
```bash
npx hardhat run scripts/mint-and-stake.js --network sepolia
```

This will:
- Mint 10 NFTs
- Stake 5 NFTs
- Display rarity distribution

## Step 11: Setup Frontend

1. Update contract addresses in `frontend/app.js`:

```javascript
const CONTRACTS = {
    NFTCollection: '0xYourNFTAddress',
    RewardToken: '0xYourRewardTokenAddress',
    NFTStaking: '0xYourStakingAddress'
};
```

2. Serve the frontend:

```bash
npx http-server frontend -p 8000
```

3. Open http://localhost:8000
4. Connect MetaMask to Sepolia
5. Test all functionality

## Step 12: Reveal NFTs

When ready to reveal:

```bash
npx hardhat console --network sepolia

> const nft = await ethers.getContractAt("NFTCollection", "0xYourNFTAddress")

# Option 1: Direct reveal
> await nft.reveal("ipfs://YourRevealedMetadataCID/")

# Option 2: Random reveal with VRF
> await nft.requestRandomReveal()
# Wait for VRF callback, then:
> await nft.reveal("ipfs://YourRevealedMetadataCID/")
```

## Troubleshooting

### "Insufficient funds" error
- Ensure you have enough Sepolia ETH
- Check gas price isn't too high

### "Invalid proof" in whitelist mint
- Verify merkle root is set correctly
- Check proof generation matches contract

### VRF not fulfilling
- Ensure subscription has LINK
- Verify consumer is added
- Check VRF coordinator address

### Frontend not connecting
- Ensure MetaMask is on Sepolia network
- Check contract addresses are correct
- Open browser console for errors

## Post-Deployment Checklist

- [ ] All contracts deployed
- [ ] Contracts verified on Etherscan
- [ ] VRF consumer added
- [ ] Metadata uploaded to IPFS
- [ ] Merkle root set
- [ ] Minting phases configured
- [ ] Test mints completed
- [ ] Test stakes completed
- [ ] Frontend updated and tested
- [ ] Demo video recorded

## Security Recommendations

Before mainnet deployment:

1. **Professional Audit**: Hire auditing firm
2. **Bug Bounty**: Launch bug bounty program
3. **Testnet Testing**: Extensive testing on testnet
4. **Multisig**: Use multisig for owner functions
5. **Timelock**: Add timelock for critical changes
6. **Insurance**: Consider smart contract insurance

## Support

For issues:
1. Check Hardhat documentation
2. Review OpenZeppelin guides
3. Consult Chainlink VRF docs
4. Check Etherscan for transaction errors

## Next Steps

1. Monitor contract activity on Etherscan
2. Track gas usage and optimize
3. Gather user feedback
4. Plan future upgrades
5. Build community

Good luck with your deployment! 🚀
