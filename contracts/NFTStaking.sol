// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./NFTCollection.sol";
import "./RewardToken.sol";

contract NFTStaking is Ownable, ReentrancyGuard {
    // Reward rates per second based on rarity (in wei)
    // Common: 1 token/day, Rare: 3 tokens/day, Legendary: 10 tokens/day
    uint256 public constant COMMON_RATE = 11574074074074; // ~1 token per day
    uint256 public constant RARE_RATE = 34722222222222; // ~3 tokens per day
    uint256 public constant LEGENDARY_RATE = 115740740740740; // ~10 tokens per day
    
    NFTCollection public immutable nftCollection;
    RewardToken public immutable rewardToken;
    
    struct StakeInfo {
        address owner;
        uint256 stakedAt;
        uint256 lastClaimTime;
    }
    
    // tokenId => StakeInfo
    mapping(uint256 => StakeInfo) public stakes;
    
    // owner => tokenIds[]
    mapping(address => uint256[]) private stakedTokens;
    
    // Track total staked by user
    mapping(address => uint256) public stakedCount;
    
    // Emergency pause
    bool public paused = false;
    
    // Events
    event Staked(address indexed owner, uint256 indexed tokenId, uint256 timestamp);
    event Unstaked(address indexed owner, uint256 indexed tokenId, uint256 timestamp);
    event RewardsClaimed(address indexed owner, uint256 amount);
    event EmergencyWithdraw(address indexed owner, uint256 indexed tokenId);
    
    constructor(address _nftCollection, address _rewardToken) Ownable(msg.sender) {
        require(_nftCollection != address(0), "Invalid NFT address");
        require(_rewardToken != address(0), "Invalid token address");
        
        nftCollection = NFTCollection(_nftCollection);
        rewardToken = RewardToken(_rewardToken);
    }
    
    // Stake NFT
    function stake(uint256 tokenId) external nonReentrant {
        require(!paused, "Staking paused");
        require(nftCollection.ownerOf(tokenId) == msg.sender, "Not token owner");
        require(stakes[tokenId].owner == address(0), "Already staked");
        
        // Transfer NFT to this contract
        nftCollection.transferFrom(msg.sender, address(this), tokenId);
        
        // Record stake
        stakes[tokenId] = StakeInfo({
            owner: msg.sender,
            stakedAt: block.timestamp,
            lastClaimTime: block.timestamp
        });
        
        stakedTokens[msg.sender].push(tokenId);
        stakedCount[msg.sender]++;
        
        emit Staked(msg.sender, tokenId, block.timestamp);
    }
    
    // Stake multiple NFTs
    function stakeBatch(uint256[] calldata tokenIds) external nonReentrant {
        require(!paused, "Staking paused");
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            require(nftCollection.ownerOf(tokenId) == msg.sender, "Not token owner");
            require(stakes[tokenId].owner == address(0), "Already staked");
            
            nftCollection.transferFrom(msg.sender, address(this), tokenId);
            
            stakes[tokenId] = StakeInfo({
                owner: msg.sender,
                stakedAt: block.timestamp,
                lastClaimTime: block.timestamp
            });
            
            stakedTokens[msg.sender].push(tokenId);
            stakedCount[msg.sender]++;
            
            emit Staked(msg.sender, tokenId, block.timestamp);
        }
    }
    
    // Unstake NFT and claim rewards
    function unstake(uint256 tokenId) external nonReentrant {
        require(stakes[tokenId].owner == msg.sender, "Not stake owner");
        
        // Claim pending rewards
        _claimRewards(tokenId);
        
        // Remove from staked tokens array
        _removeFromStakedTokens(msg.sender, tokenId);
        
        // Delete stake info
        delete stakes[tokenId];
        stakedCount[msg.sender]--;
        
        // Transfer NFT back
        nftCollection.transferFrom(address(this), msg.sender, tokenId);
        
        emit Unstaked(msg.sender, tokenId, block.timestamp);
    }
    
    // Claim rewards without unstaking
    function claimRewards(uint256 tokenId) external nonReentrant {
        require(stakes[tokenId].owner == msg.sender, "Not stake owner");
        _claimRewards(tokenId);
    }
    
    // Claim all rewards from all staked NFTs
    function claimAllRewards() external nonReentrant {
        uint256[] memory userStakedTokens = stakedTokens[msg.sender];
        require(userStakedTokens.length > 0, "No staked tokens");
        
        uint256 totalRewards = 0;
        
        for (uint256 i = 0; i < userStakedTokens.length; i++) {
            uint256 tokenId = userStakedTokens[i];
            uint256 rewards = calculateRewards(tokenId);
            
            if (rewards > 0) {
                stakes[tokenId].lastClaimTime = block.timestamp;
                totalRewards += rewards;
            }
        }
        
        if (totalRewards > 0) {
            rewardToken.mint(msg.sender, totalRewards);
            emit RewardsClaimed(msg.sender, totalRewards);
        }
    }
    
    // Internal claim function
    function _claimRewards(uint256 tokenId) private {
        uint256 rewards = calculateRewards(tokenId);
        
        if (rewards > 0) {
            stakes[tokenId].lastClaimTime = block.timestamp;
            rewardToken.mint(msg.sender, rewards);
            emit RewardsClaimed(msg.sender, rewards);
        }
    }
    
    // Calculate pending rewards for a token
    function calculateRewards(uint256 tokenId) public view returns (uint256) {
        StakeInfo memory stakeInfo = stakes[tokenId];
        
        if (stakeInfo.owner == address(0)) {
            return 0;
        }
        
        uint256 timeStaked = block.timestamp - stakeInfo.lastClaimTime;
        uint8 rarity = nftCollection.tokenRarity(tokenId);
        uint256 rate = _getRewardRate(rarity);
        
        return timeStaked * rate;
    }
    
    // Get reward rate based on rarity
    function _getRewardRate(uint8 rarity) private pure returns (uint256) {
        if (rarity == 1) return COMMON_RATE;
        if (rarity == 2) return RARE_RATE;
        if (rarity == 3) return LEGENDARY_RATE;
        return COMMON_RATE; // Default to common
    }
    
    // Get all staked tokens for an address
    function getStakedTokens(address owner) external view returns (uint256[] memory) {
        return stakedTokens[owner];
    }
    
    // Get total pending rewards for an address
    function getTotalPendingRewards(address owner) external view returns (uint256) {
        uint256[] memory userStakedTokens = stakedTokens[owner];
        uint256 totalRewards = 0;
        
        for (uint256 i = 0; i < userStakedTokens.length; i++) {
            totalRewards += calculateRewards(userStakedTokens[i]);
        }
        
        return totalRewards;
    }
    
    // Get staking info for a token
    function getStakeInfo(uint256 tokenId) external view returns (
        address owner,
        uint256 stakedAt,
        uint256 lastClaimTime,
        uint256 pendingRewards,
        uint8 rarity
    ) {
        StakeInfo memory stakeInfo = stakes[tokenId];
        return (
            stakeInfo.owner,
            stakeInfo.stakedAt,
            stakeInfo.lastClaimTime,
            calculateRewards(tokenId),
            nftCollection.tokenRarity(tokenId)
        );
    }
    
    // Emergency withdraw (no rewards)
    function emergencyWithdraw(uint256 tokenId) external nonReentrant {
        require(stakes[tokenId].owner == msg.sender, "Not stake owner");
        
        // Remove from staked tokens array
        _removeFromStakedTokens(msg.sender, tokenId);
        
        // Delete stake info
        delete stakes[tokenId];
        stakedCount[msg.sender]--;
        
        // Transfer NFT back (no rewards)
        nftCollection.transferFrom(address(this), msg.sender, tokenId);
        
        emit EmergencyWithdraw(msg.sender, tokenId);
    }
    
    // Remove token from staked tokens array
    function _removeFromStakedTokens(address owner, uint256 tokenId) private {
        uint256[] storage tokens = stakedTokens[owner];
        
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == tokenId) {
                tokens[i] = tokens[tokens.length - 1];
                tokens.pop();
                break;
            }
        }
    }
    
    // Admin functions
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }
    
    // Get leaderboard data (top stakers)
    function getTopStakers(uint256 limit) external view returns (
        address[] memory stakers,
        uint256[] memory counts
    ) {
        // This is a simplified version - in production, you'd want off-chain indexing
        // For demonstration purposes only
        stakers = new address[](limit);
        counts = new uint256[](limit);
        
        // Note: This would need proper implementation with sorting
        // Left as placeholder for gas efficiency
        return (stakers, counts);
    }
}
