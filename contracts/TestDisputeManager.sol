// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

contract TestDisputeManager {
    function verifyBlockHeader(bytes32 blockHash, bytes[] calldata blockHeaderRaw) external pure returns (bool){
        return true;
    }

    function verifyProof(
        bytes32 txHash,
        bytes[] memory proof,
        bytes memory bytesRoot,
        uint8[] memory path
    ) external pure returns (bool) {
        return true;
    }

    function verifyRawTx(bytes memory transaction, bytes[] calldata txRaw) external pure returns (bool) {
        return true;
    }

    function verifyTxSignature(address from, bytes[] calldata txRaw) external pure returns (bool) {
        return true;
    }

    function verifyBlockHash(bytes32 _blockHash, uint256 _blockNumber) external view returns (bool) {
        return true;
    }
}
