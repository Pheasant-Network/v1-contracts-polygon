// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

contract TestCheckPointManager {
    mapping(uint256 => bytes32) public blockHashs;

    function getBlockHash(uint256 _blockNumber) external view returns (bytes32) {
        return blockHashs[_blockNumber];
    }

    function setBlockHash(uint256 _blockNumber, bytes32 _blockHash) public {
        blockHashs[_blockNumber] = _blockHash;
    }
}
