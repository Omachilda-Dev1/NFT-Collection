// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// Mock VRF Coordinator for testing
contract MockVRFCoordinatorV2 {
    uint256 private requestIdCounter = 1;
    
    function requestRandomWords(
        bytes32,
        uint64,
        uint16,
        uint32,
        uint32
    ) external returns (uint256) {
        return requestIdCounter++;
    }
    
    function fulfillRandomWords(
        uint256 requestId,
        address consumer,
        uint256[] memory randomWords
    ) external {
        // Mock fulfillment - in tests, you'd call this manually
    }
}
