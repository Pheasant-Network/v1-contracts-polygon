// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;
import { FxBaseChildTunnel } from '../../fx-portal/contracts/tunnel/FxBaseChildTunnel.sol';

contract PolygonChildCheckPointManager is FxBaseChildTunnel {
    bytes32 constant RECEIVE_BLOCK_INFO = keccak256("ReceiveBlockInfo");
    mapping(uint => bytes32) internal blockHashs;

    constructor(address _fxChild) FxBaseChildTunnel(_fxChild) {
    }

    function _processMessageFromRoot(uint256 /* stateId */, address sender, bytes memory data) internal override validateSender(sender) {
        // decode incoming data
        (bytes32 syncType, bytes memory syncData) = abi.decode(data, (bytes32, bytes));

        if (syncType == RECEIVE_BLOCK_INFO) {
            (uint256 blockNumber, bytes32 blockHash) = abi.decode(syncData, (uint, bytes32));
            blockHashs[blockNumber] = blockHash;
        } else {
            revert("FxBaseChildTunnel: INVALID_SYNC_TYPE");
        }
    }

   function getBlockHash(uint _blockNumber) external view returns(bytes32) {
      return blockHashs[_blockNumber];
  }

}
