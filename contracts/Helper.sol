// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;
import "./PheasantNetworkBridgeChild.sol";

contract Helper is PheasantNetworkBridgeChild {
    constructor(
        address[] memory _tokenAddressList,
        uint256 _userDepositThreshold,
        address _disputeManager
    ) PheasantNetworkBridgeChild(_tokenAddressList, _userDepositThreshold, _disputeManager) {}

    function helperIsTradeExist(address user, uint256 index) public view returns (bool) {
        return super.isTradeExist(user, index);
    }

    function helperBid(address user, uint256 index) public {
        super.bid(user, index);
    }

    function helperCheckTransferTx(
        bytes calldata transaction,
        address recipient,
        uint256 amount
    ) public pure returns (bool) {
        return super.checkTransferTx(transaction, recipient, amount);
    }

    function helperWithdraw(
        address user,
        uint256 index,
        Evidence calldata evidence
    ) public {
        super.withdraw(user, index, evidence);
    }
}
