// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;
import "./PheasantNetworkDisputeManager.sol";

contract DisputeHelper is PheasantNetworkDisputeManager {
    constructor(address _checkPointManager) PheasantNetworkDisputeManager(_checkPointManager) {}

    function helperBufferToNibble(bytes memory buffer) public pure returns (uint8[] memory) {
        return super.bufferToNibble(buffer);
    }
}
