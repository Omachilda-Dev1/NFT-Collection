# ⚡ Quick Start Guide

Get up and running in 5 minutes!

## 1. Install Dependencies

```bash
# Run the setup script
setup.bat

# Or manually
npm install
```

## 2. Configure Environment

```bash
# Copy example env file
copy .env.example .env

# Edit .env with your details
notepad .env
```

Minimum required:
```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=your_private_key_here
```

## 3. Compile Contracts

```bash
npm run compile
```

Expected output: `Compiled 15 Solidity files successfully`

## 4. Run Tests

```bash
npm test
```

All tests should pass ✅

## 5. Deploy to Local Network

```bash
# Terminal 1: Start local node
npm run node

# Terminal 2: Deploy
npm run deploy:local
```

## 6. Test Frontend Locally

```bash
# Serve frontend
npx http-server frontend -p 8000

# Open browser
start http://localhost:8000
```

## 7. Deploy to Sepolia (Optional)

```bash
# Make sure you have Sepolia ETH
npm run deploy:sepolia

# Run demo
npm run demo
```

## Common Commands

```bash
# Compile contracts
npm run compile

# Run tests
npm test

# Test with gas report
npm run test:gas

# Coverage report
npm run test:coverage

# Deploy to local
npm run deploy:local

# Deploy to Sepolia
npm run deploy:sepolia

# Run demo script
npm run demo

# Clean build artifacts
npm run clean
```

## Troubleshooting

### PowerShell Script Execution Error

If you see "running scripts is disabled":

```powershell
# Run as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Or use the batch file:
```bash
setup.bat
```

### "Cannot find module" Error

```bash
# Delete and reinstall
rmdir /s /q node_modules
del package-lock.json
npm install
```

### "Insufficient funds" Error

Get Sepolia ETH from:
- https://sepoliafaucet.com/
- https://faucets.chain.link/

### Frontend Not Connecting

1. Check MetaMask is installed
2. Switch to Sepolia network
3. Update contract addresses in `frontend/app.js`
4. Check browser console for errors

## Next Steps

1. ✅ Read [README.md](README.md) for full documentation
2. ✅ Follow [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for Sepolia deployment
3. ✅ Review [SECURITY_AUDIT.md](SECURITY_AUDIT.md) for security info
4. ✅ Check [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) for overview

## Need Help?

- Check documentation files
- Review test files for examples
- Consult Hardhat docs: https://hardhat.org/docs
- OpenZeppelin guides: https://docs.openzeppelin.com/

## Project Structure

```
📁 contracts/     → Smart contracts
📁 test/          → Test files
📁 scripts/       → Deployment scripts
📁 frontend/      → Web interface
📁 metadata/      → IPFS metadata
📄 hardhat.config.js → Hardhat configuration
📄 .env           → Your credentials (create this)
```

## Key Files

- `contracts/NFTCollection.sol` - Main NFT contract
- `contracts/NFTStaking.sol` - Staking logic
- `test/NFTCollection.test.js` - NFT tests
- `scripts/deploy.js` - Deployment script
- `frontend/index.html` - Web UI

## Quick Test

Verify everything works:

```bash
# 1. Compile
npm run compile

# 2. Test
npm test

# 3. Deploy locally
npm run node
# (in another terminal)
npm run deploy:local
```

If all three succeed, you're ready to go! 🚀

---

**Time to Complete**: ~5 minutes
**Difficulty**: Beginner-friendly
**Prerequisites**: Node.js, npm
