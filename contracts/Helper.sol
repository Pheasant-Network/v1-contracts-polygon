// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;
import "./PheasantNetworkBridgeChild.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract Helper is PheasantNetworkBridgeChild {
    using SafeMath for uint256;
    constructor(
        address[] memory _tokenAddressList,
        uint256 _userDepositThreshold,
        address _disputeManager,
        address _newOwner
    ) PheasantNetworkBridgeChild(_tokenAddressList, _userDepositThreshold, _disputeManager, _newOwner) {}

    function helperBid(address user, uint256 index) public {
        super.bid(user, index);
    }

    function setUpTrade(
        address sender,
        uint256 index,
        address user,
        uint8 tokenTypeIndex,
        uint256 amount,
        uint256 timestamp,
        address to,
        address relayer,
        uint8 status,
        uint256 fee,
        uint256 disputeTimestamp,
        bool isUpwatd

    ) public {
        trades[sender].push(
            Trade(
                index,
                user,
                tokenTypeIndex,
                amount,
                timestamp,
                to,
                relayer,
                status,
                fee,
                disputeTimestamp,
                isUpwatd
            )
        );
        
        userTradeList.push(UserTrade(msg.sender, trades[msg.sender].length - 1));

    }


    function setUpDeposit(uint8 tokenTypeIndex, uint256 amount) public {
        IERC20 token = IERC20(tokenAddressL2[tokenTypeIndex]);
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer Fail");
    }

    function setUpEvidence(
        address user,
        uint256 index,
        Evidence calldata evidence
    ) public {
        evidences[user][index] = evidence;
    }


    function setUpHashedEvidence(
        address user,
        uint256 index,
        Evidence calldata evidence
    ) public {
        hashedEvidences[user][index] = super.hashEvidence(evidence);
    }

    function setUpUserDeposit(uint256 amount) external {
        userDeposit[msg.sender] = userDeposit[msg.sender].add(amount);
        IERC20 token = IERC20(tokenAddressL2[ETH_TOKEN_INDEX]);
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer Fail");
    }

    function helperHashEvidence(Evidence calldata evidence) public pure returns (bytes32){
        return super.hashEvidence(evidence);
    }

    function helperWithdraw(
        address user,
        uint256 index,
        Evidence calldata evidence
    ) public {
        super.withdraw(user, index, evidence);
    }

}
