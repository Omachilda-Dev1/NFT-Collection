// Contract addresses - Update these after deployment
const CONTRACTS = {
    NFTCollection: '0x7a3F8c7d6828e9a149E0186173C49cF93fff72a0',
    RewardToken: '0x7BaD55DE662E0a90BEf1cd233D2F5D6aBCC7dD2D',
    NFTStaking: '0x413808Af69b084A4e8EfbEC3478f14dd3e8D8a43'
};

// ABIs - Simplified for frontend (include only needed functions)
const NFT_ABI = [
    "function publicMint() payable",
    "function whitelistMint(bytes32[] calldata merkleProof) payable",
    "function balanceOf(address owner) view returns (uint256)",
    "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
    "function tokenURI(uint256 tokenId) view returns (string)",
    "function tokenRarity(uint256 tokenId) view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function isPublicMintActive() view returns (bool)",
    "function isWhitelistActive() view returns (bool)",
    "function approve(address to, uint256 tokenId)",
    "function setApprovalForAll(address operator, bool approved)"
];

const STAKING_ABI = [
    "function stake(uint256 tokenId)",
    "function unstake(uint256 tokenId)",
    "function claimRewards(uint256 tokenId)",
    "function claimAllRewards()",
    "function getStakedTokens(address owner) view returns (uint256[])",
    "function getTotalPendingRewards(address owner) view returns (uint256)",
    "function getStakeInfo(uint256 tokenId) view returns (address, uint256, uint256, uint256, uint8)",
    "function stakedCount(address owner) view returns (uint256)"
];

const TOKEN_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)"
];

let provider, signer, userAddress;
let nftContract, stakingContract, tokenContract;

// Wait for ethers to load
window.addEventListener('load', () => {
    if (typeof ethers === 'undefined') {
        console.error('Ethers.js failed to load!');
        alert('Error: Ethers.js library failed to load. Please refresh the page.');
    } else {
        console.log('Ethers.js loaded successfully');
    }
});

// Theme Toggle
const themeToggle = document.getElementById('themeToggle');
const body = document.body;

// Load saved theme or default to light
const savedTheme = localStorage.getItem('theme') || 'light-mode';
body.className = savedTheme;
updateThemeIcon();

themeToggle.addEventListener('click', () => {
    if (body.classList.contains('light-mode')) {
        body.classList.remove('light-mode');
        body.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark-mode');
    } else {
        body.classList.remove('dark-mode');
        body.classList.add('light-mode');
        localStorage.setItem('theme', 'light-mode');
    }
    updateThemeIcon();
});

function updateThemeIcon() {
    const icon = themeToggle.querySelector('i');
    if (body.classList.contains('dark-mode')) {
        icon.className = 'fas fa-sun';
    } else {
        icon.className = 'fas fa-moon';
    }
}

// Connect Wallet
document.getElementById('connectWallet').addEventListener('click', async () => {
    try {
        console.log('Connect wallet clicked');
        
        if (typeof window.ethereum === 'undefined') {
            alert('Please install MetaMask!');
            return;
        }

        console.log('Requesting accounts...');
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        console.log('Creating provider...');
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        userAddress = await signer.getAddress();
        
        console.log('Connected address:', userAddress);

        // Initialize contracts
        nftContract = new ethers.Contract(CONTRACTS.NFTCollection, NFT_ABI, signer);
        stakingContract = new ethers.Contract(CONTRACTS.NFTStaking, STAKING_ABI, signer);
        tokenContract = new ethers.Contract(CONTRACTS.RewardToken, TOKEN_ABI, provider);

        // Update UI
        document.getElementById('connectWallet').style.display = 'none';
        document.getElementById('walletInfo').style.display = 'flex';
        document.getElementById('walletAddress').textContent = 
            userAddress.slice(0, 6) + '...' + userAddress.slice(-4);

        const balance = await provider.getBalance(userAddress);
        document.getElementById('walletBalance').textContent = 
            ethers.utils.formatEther(balance).slice(0, 6);

        // Enable minting
        document.getElementById('mintBtn').disabled = false;

        // Load data
        await loadData();

        console.log('Wallet connected successfully!');
    } catch (error) {
        console.error('Connection error:', error);
        alert('Failed to connect wallet: ' + error.message);
    }
});

// Mint NFT
document.getElementById('mintBtn').addEventListener('click', async () => {
    try {
        console.log('Minting NFT...');
        alert('Minting NFT... Please confirm the transaction in MetaMask.');
        
        const mintPrice = ethers.utils.parseEther('0.01');
        const tx = await nftContract.publicMint({ value: mintPrice });
        
        console.log('Transaction submitted:', tx.hash);
        alert('Transaction submitted! Waiting for confirmation...');
        await tx.wait();
        
        console.log('NFT minted successfully!');
        alert('NFT minted successfully!');
        await loadData();
    } catch (error) {
        console.error('Minting error:', error);
        alert('Minting failed: ' + (error.reason || error.message));
    }
});

// Claim All Rewards
document.getElementById('claimAllBtn').addEventListener('click', async () => {
    try {
        showStatus('stakingStatus', 'Claiming rewards...', 'info');
        
        const tx = await stakingContract.claimAllRewards();
        await tx.wait();
        
        showStatus('stakingStatus', 'Rewards claimed successfully!', 'success');
        await loadData();
    } catch (error) {
        console.error(error);
        showStatus('stakingStatus', 'Claim failed: ' + error.message, 'error');
    }
});

// Refresh Data
document.getElementById('refreshBtn').addEventListener('click', loadData);

// Load all data
async function loadData() {
    if (!nftContract) return;

    try {
        // Load mint phase
        const isPublicActive = await nftContract.isPublicMintActive();
        const isWhitelistActive = await nftContract.isWhitelistActive();
        
        let phase = 'Not Active';
        if (isPublicActive) phase = 'Public Mint';
        else if (isWhitelistActive) phase = 'Whitelist';
        
        document.getElementById('mintPhase').textContent = phase;

        // Load total supply
        const totalSupply = await nftContract.totalSupply();
        document.getElementById('totalSupply').textContent = totalSupply.toString();

        // Load user's NFTs
        await loadUserNFTs();

        // Load staking data
        await loadStakingData();

    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Load user's NFTs
async function loadUserNFTs() {
    try {
        const balance = await nftContract.balanceOf(userAddress);
        const gallery = document.getElementById('nftGallery');
        
        if (balance.eq(0)) {
            gallery.innerHTML = '<p class="empty-state">You don\'t own any NFTs yet</p>';
            return;
        }

        gallery.innerHTML = '';

        for (let i = 0; i < balance.toNumber(); i++) {
            const tokenId = await nftContract.tokenOfOwnerByIndex(userAddress, i);
            const rarity = await nftContract.tokenRarity(tokenId);
            
            const nftCard = createNFTCard(tokenId, rarity, false);
            gallery.appendChild(nftCard);
        }
    } catch (error) {
        console.error('Error loading NFTs:', error);
    }
}

// Load staking data
async function loadStakingData() {
    try {
        // Load staked count
        const stakedCount = await stakingContract.stakedCount(userAddress);
        document.getElementById('stakedCount').textContent = stakedCount.toString();

        // Load pending rewards
        const pendingRewards = await stakingContract.getTotalPendingRewards(userAddress);
        document.getElementById('pendingRewards').textContent = 
            ethers.utils.formatEther(pendingRewards).slice(0, 8);

        // Load reward balance
        const rewardBalance = await tokenContract.balanceOf(userAddress);
        document.getElementById('rewardBalance').textContent = 
            ethers.utils.formatEther(rewardBalance).slice(0, 8);

        // Enable claim button if there are rewards
        document.getElementById('claimAllBtn').disabled = pendingRewards.eq(0);

        // Load staked NFTs
        const stakedTokens = await stakingContract.getStakedTokens(userAddress);
        const stakedGallery = document.getElementById('stakedNFTs');

        if (stakedTokens.length === 0) {
            stakedGallery.innerHTML = '<p class="empty-state">No staked NFTs</p>';
            return;
        }

        stakedGallery.innerHTML = '';

        for (const tokenId of stakedTokens) {
            const stakeInfo = await stakingContract.getStakeInfo(tokenId);
            const rarity = stakeInfo[4];
            
            const nftCard = createNFTCard(tokenId, rarity, true, stakeInfo[3]);
            stakedGallery.appendChild(nftCard);
        }
    } catch (error) {
        console.error('Error loading staking data:', error);
    }
}

// Create NFT card element
function createNFTCard(tokenId, rarity, isStaked, pendingRewards = null) {
    const card = document.createElement('div');
    card.className = 'nft-card';

    const rarityNames = ['', 'Common', 'Rare', 'Legendary'];
    const rarityClasses = ['', 'rarity-common', 'rarity-rare', 'rarity-legendary'];

    card.innerHTML = `
        <div class="nft-image">
            <i class="fas fa-gem"></i>
        </div>
        <div class="nft-info">
            <h3>NFT #${tokenId}</h3>
            <span class="nft-rarity ${rarityClasses[rarity]}">${rarityNames[rarity]}</span>
            ${pendingRewards ? `<p style="margin-top: 10px; font-size: 0.9em; color: var(--text-secondary);">
                <i class="fas fa-coins"></i> ${ethers.utils.formatEther(pendingRewards).slice(0, 6)} DRT
            </p>` : ''}
        </div>
        <div class="nft-actions">
            ${!isStaked ? 
                `<button class="stake-btn" onclick="stakeNFT(${tokenId})">
                    <i class="fas fa-lock"></i> Stake
                </button>` :
                `<button class="unstake-btn" onclick="unstakeNFT(${tokenId})">
                    <i class="fas fa-lock-open"></i> Unstake
                </button>
                 <button class="claim-btn" onclick="claimRewards(${tokenId})">
                    <i class="fas fa-hand-holding-dollar"></i> Claim
                </button>`
            }
        </div>
    `;

    return card;
}

// Stake NFT
async function stakeNFT(tokenId) {
    try {
        showStatus('stakingStatus', 'Approving NFT...', 'info');
        
        // Approve staking contract
        const approveTx = await nftContract.approve(CONTRACTS.NFTStaking, tokenId);
        await approveTx.wait();

        showStatus('stakingStatus', 'Staking NFT...', 'info');
        
        const stakeTx = await stakingContract.stake(tokenId);
        await stakeTx.wait();

        showStatus('stakingStatus', 'NFT staked successfully!', 'success');
        await loadData();
    } catch (error) {
        console.error(error);
        showStatus('stakingStatus', 'Staking failed: ' + error.message, 'error');
    }
}

// Unstake NFT
async function unstakeNFT(tokenId) {
    try {
        showStatus('stakingStatus', 'Unstaking NFT...', 'info');
        
        const tx = await stakingContract.unstake(tokenId);
        await tx.wait();

        showStatus('stakingStatus', 'NFT unstaked successfully!', 'success');
        await loadData();
    } catch (error) {
        console.error(error);
        showStatus('stakingStatus', 'Unstaking failed: ' + error.message, 'error');
    }
}

// Claim rewards for specific NFT
async function claimRewards(tokenId) {
    try {
        console.log('Claiming rewards for token:', tokenId);
        
        const tx = await stakingContract.claimRewards(tokenId);
        console.log('Claim transaction:', tx.hash);
        
        alert('Claiming rewards... Please wait for confirmation.');
        await tx.wait();

        console.log('Rewards claimed successfully!');
        alert('Rewards claimed successfully!');
        await loadData();
    } catch (error) {
        console.error('Claim error:', error);
        alert('Claim failed: ' + (error.reason || error.message));
    }
}

// Show status message
function showStatus(elementId, message, type) {
    const statusEl = document.getElementById(elementId);
    if (!statusEl) {
        console.log(`Status (${type}):`, message);
        return;
    }
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    statusEl.style.display = 'block';
    
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 5000);
    }
}

// Make functions globally available
window.stakeNFT = stakeNFT;
window.unstakeNFT = unstakeNFT;
window.claimRewards = claimRewards;
