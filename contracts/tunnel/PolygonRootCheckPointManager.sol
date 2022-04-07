// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;
import {FxBaseRootTunnel} from "../../fx-portal/contracts/tunnel/FxBaseRootTunnel.sol";

contract PolygonRootCheckPointManager is FxBaseRootTunnel {
    constructor(address _checkpointManager, address _fxRoot) FxBaseRootTunnel(_checkpointManager, _fxRoot) {}

    bytes32 constant RECEIVE_BLOCK_INFO = keccak256("ReceiveBlockInfo");

    function sendBlockInfo(uint256 _blockNumber) external {
        bytes memory message = abi.encode(RECEIVE_BLOCK_INFO, abi.encode(_blockNumber, blockhash(_blockNumber)));
        _sendMessageToChild(message);
    }

    function _processMessageFromChild(bytes memory _data) internal override {
        // latestData = _data;
    }
}
