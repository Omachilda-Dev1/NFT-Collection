// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";

contract NFTCollection is 
    ERC721, 
    ERC721Enumerable, 
    ERC2981, 
    Ownable, 
    ReentrancyGuard,
    VRFConsumerBaseV2 
{
    // Constants
    uint256 public constant MAX_SUPPLY = 100;
    uint256 public constant WHITELIST_SUPPLY = 50;
    uint256 public constant MINT_PRICE = 0.01 ether;
    
    // State variables
    uint256 private _tokenIdCounter;
    bool public isWhitelistActive = true;
    bool public isPublicMintActive = false;
    bool public isRevealed = false;
    
    bytes32 public merkleRoot;
    string private _baseTokenURI;
    string private _hiddenMetadataURI;
    
    // Chainlink VRF
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    uint64 private immutable i_subscriptionId;
    bytes32 private immutable i_keyHash;
    uint32 private constant CALLBACK_GAS_LIMIT = 100000;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;
    
    uint256 public s_requestId;
    uint256 public s_randomWord;
    
    // Rarity mapping (tokenId => rarity level: 1=Common, 2=Rare, 3=Legendary)
    mapping(uint256 => uint8) public tokenRarity;
    mapping(address => bool) public whitelistClaimed;
    
    // Events
    event WhitelistMint(address indexed minter, uint256 tokenId);
    event PublicMint(address indexed minter, uint256 tokenId);
    event Revealed(string baseURI);
    event RandomnessRequested(uint256 requestId);
    event RarityAssigned(uint256 tokenId, uint8 rarity);
    
    constructor(
        address vrfCoordinator,
        uint64 subscriptionId,
        bytes32 keyHash,
        string memory hiddenMetadataURI
    ) 
        ERC721("DeFi NFT Collection", "DNFT")
        Ownable(msg.sender)
        VRFConsumerBaseV2(vrfCoordinator)
    {
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinator);
        i_subscriptionId = subscriptionId;
        i_keyHash = keyHash;
        _hiddenMetadataURI = hiddenMetadataURI;
        
        // Set default royalty to 5%
        _setDefaultRoyalty(msg.sender, 500);
    }
    
    // Whitelist minting
    function whitelistMint(bytes32[] calldata merkleProof) 
        external 
        payable 
        nonReentrant 
    {
        require(isWhitelistActive, "Whitelist mint not active");
        require(_tokenIdCounter < WHITELIST_SUPPLY, "Whitelist supply exhausted");
        require(!whitelistClaimed[msg.sender], "Already claimed");
        require(msg.value >= MINT_PRICE, "Insufficient payment");
        
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        require(
            MerkleProof.verify(merkleProof, merkleRoot, leaf),
            "Invalid proof"
        );
        
        whitelistClaimed[msg.sender] = true;
        _mintNFT(msg.sender);
        
        emit WhitelistMint(msg.sender, _tokenIdCounter - 1);
    }
    
    // Public minting
    function publicMint() external payable nonReentrant {
        require(isPublicMintActive, "Public mint not active");
        require(_tokenIdCounter < MAX_SUPPLY, "Max supply reached");
        require(msg.value >= MINT_PRICE, "Insufficient payment");
        
        _mintNFT(msg.sender);
        
        emit PublicMint(msg.sender, _tokenIdCounter - 1);
    }
    
    // Internal mint function
    function _mintNFT(address to) private {
        uint256 tokenId = _tokenIdCounter++;
        _safeMint(to, tokenId);
        
        // Assign rarity pseudo-randomly (will be overridden by VRF if used)
        uint8 rarity = _calculateRarity(tokenId);
        tokenRarity[tokenId] = rarity;
        
        emit RarityAssigned(tokenId, rarity);
    }
    
    // Calculate rarity based on pseudo-random logic
    function _calculateRarity(uint256 tokenId) private view returns (uint8) {
        uint256 rand = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            tokenId,
            msg.sender
        ))) % 100;
        
        if (rand < 60) return 1; // 60% Common
        if (rand < 90) return 2; // 30% Rare
        return 3; // 10% Legendary
    }
    
    // Request randomness from Chainlink VRF for reveal
    function requestRandomReveal() external onlyOwner returns (uint256) {
        require(!isRevealed, "Already revealed");
        
        s_requestId = i_vrfCoordinator.requestRandomWords(
            i_keyHash,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            CALLBACK_GAS_LIMIT,
            NUM_WORDS
        );
        
        emit RandomnessRequested(s_requestId);
        return s_requestId;
    }
    
    // Chainlink VRF callback
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] memory randomWords
    ) internal override {
        s_randomWord = randomWords[0];
        
        // Optionally reassign rarities based on true randomness
        for (uint256 i = 0; i < _tokenIdCounter; i++) {
            uint256 rand = uint256(keccak256(abi.encodePacked(s_randomWord, i))) % 100;
            uint8 rarity;
            
            if (rand < 60) rarity = 1;
            else if (rand < 90) rarity = 2;
            else rarity = 3;
            
            tokenRarity[i] = rarity;
            emit RarityAssigned(i, rarity);
        }
    }
    
    // Reveal metadata
    function reveal(string memory baseURI) external onlyOwner {
        require(!isRevealed, "Already revealed");
        _baseTokenURI = baseURI;
        isRevealed = true;
        
        emit Revealed(baseURI);
    }
    
    // Toggle minting phases
    function setWhitelistActive(bool active) external onlyOwner {
        isWhitelistActive = active;
    }
    
    function setPublicMintActive(bool active) external onlyOwner {
        isPublicMintActive = active;
    }
    
    function setMerkleRoot(bytes32 root) external onlyOwner {
        merkleRoot = root;
    }
    
    function setHiddenMetadataURI(string memory uri) external onlyOwner {
        _hiddenMetadataURI = uri;
    }
    
    // Withdraw funds
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");
    }
    
    // Override tokenURI for reveal mechanism
    function tokenURI(uint256 tokenId) 
        public 
        view 
        override 
        returns (string memory) 
    {
        _requireOwned(tokenId);
        
        if (!isRevealed) {
            return _hiddenMetadataURI;
        }
        
        return string(abi.encodePacked(_baseTokenURI, _toString(tokenId), ".json"));
    }
    
    // Helper function to convert uint to string
    function _toString(uint256 value) private pure returns (string memory) {
        if (value == 0) return "0";
        
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        
        return string(buffer);
    }
    
    // Required overrides
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }
    
    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
