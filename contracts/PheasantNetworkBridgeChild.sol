// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "hardhat/console.sol";

interface PheasantNetworkDisputeManagerInterface {
    function verifyBlockHeader(bytes32 blockHash, bytes[] calldata blockHeaderRaw) external pure returns (bool);

    function verifyProof(
        bytes32 txHash,
        bytes[] memory proof,
        bytes memory bytesRoot,
        uint8[] memory path
    ) external pure returns (bool);

    function verifyRawTx(bytes memory transaction, bytes[] calldata txRaw) external pure returns (bool);

    function verifyTxSignature(address from, bytes[] calldata txRaw) external pure returns (bool);

    function verifyBlockHash(bytes32 _blockHash, uint256 _blockNumber) external view returns (bool);

    function checkTransferTx(bytes calldata transaction, address recipient, uint256 amount) external pure returns (bool);
}

contract PheasantNetworkBridgeChild is Ownable {
    using SafeMath for uint256;

    constructor(
        address[] memory _tokenAddressList,
        uint256 _userDepositThreshold,
        address _disputeManager,
        address _newOwner
    ) {
        tokenAddressL2[ETH_TOKEN_INDEX] = _tokenAddressList[ETH_TOKEN_INDEX];
        userDepositThreshold = _userDepositThreshold;
        disputeManager = PheasantNetworkDisputeManagerInterface(_disputeManager);
        transferOwnership(_newOwner);
    }

    PheasantNetworkDisputeManagerInterface internal disputeManager;
    mapping(uint8 => address) internal tokenAddressL1;
    mapping(uint8 => address) internal tokenAddressL2;
    uint8 constant ETH_TOKEN_INDEX = 0;
    uint8 constant MATIC_TOKEN_INDEX = 1;
    uint8 constant STATUS_START = 0;
    uint8 constant STATUS_BID = 1;
    uint8 constant STATUS_PAID = 2;
    uint8 constant STATUS_DISPUTE = 3;
    uint8 constant STATUS_SLASHED = 4;
    uint8 constant STATUS_CANCEL = 99;
    bytes constant TRANSFER_METHOD_ID = bytes(hex"a9059cbb");
    uint256 constant GRACE_PERIOD = 1 hours;
    uint256 constant DISPUTABLE_PERIOD = 1 hours;
    uint256 constant BLOCKHEADER_TRANSACTIONROOT_INDEX = 4;
    uint256 constant TRANSACTION_TO_INDEX = 5;
    uint256 constant TRANSACTION_VALUE_INDEX = 6;
    uint256 internal userDepositThreshold;
    mapping(address => Trade[]) internal trades;
    mapping(address => mapping(uint256 => Evidence)) internal evidences;
    mapping(address => mapping(uint256 => bytes32)) internal hashedEvidences;
    mapping(address => uint256) internal relayerBond;
    mapping(address => uint256) internal relayerAsset;
    mapping(address => uint256) internal userDeposit;
    //uint constant SUBMIT_LIMIT_BLOCK_INTERVAL = 150; //approximately 30 min.

    event NewTrade(address indexed userAddress, uint8 tokenTypeIndex, uint256 amount);
    event Bid(address indexed relayer, address indexed userAddress, uint256 index);
    event Withdraw(address indexed relayer, address indexed userAddress, uint256 index);
    event Accept(address indexed relayer, address indexed userAddress, uint256 index);
    event Dispute(address indexed userAddress, uint256 indexed index);
    event Slash(address indexed userAddress, uint256 indexed index, address indexed relayer);

    struct UserTrade {
        address userAddress;
        uint256 index;
    }

    UserTrade[] internal userTradeList;
    mapping(address => UserTrade[]) internal disputeList;

    struct Trade {
        uint256 index;
        address user;
        uint8 tokenTypeIndex;
        uint256 amount;
        uint256 timestamp;
        address to;
        address relayer;
        uint8 status;
        uint256 fee;
        uint256 disputeTimestamp;
        bool isUpward;
    }

    struct Evidence {
        uint256 blockNumber;
        bytes32 blockHash;
        bytes[] txReceiptProof;
        bytes[] txProof;
        bytes transaction;
        uint8[] txDataSpot;
        uint8[] path;
        bytes txReceipt;
        bytes[] rawTx;
        bytes[] rawBlockHeader;
    }

    function getRelayer() public returns (address){
        return owner();
    }

    function createUpwardTrade(
        uint256 amount,
        address to,
        uint256 fee,
        uint8 tokenTypeIndex,
        Evidence calldata evidence
    ) public payable {
        require(tokenTypeIndex == ETH_TOKEN_INDEX, "Only ETH Support for now");
        //TODO can't send eth over the threshold
        require(disputeManager.checkTransferTx(evidence.transaction, to, amount - fee), "Invalid Evidence");
        address relayer = getRelayer();

        trades[msg.sender].push(
            Trade(
                trades[msg.sender].length,
                msg.sender,
                tokenTypeIndex,
                amount,
                block.timestamp,
                to,
                relayer,
                STATUS_START,
                fee,
                block.timestamp,
                true
            )
        );

        userTradeList.push(UserTrade(msg.sender, trades[msg.sender].length - 1));
        hashedEvidences[msg.sender][trades[msg.sender].length - 1] = hashEvidence(evidence);
        emit NewTrade(msg.sender, tokenTypeIndex, amount);
    }


    function accept(address user, uint256 index) external {
        Trade memory trade = getTrade(user, index);
        require(trade.status == STATUS_START, "Acceptance can be granted only once");

        trade.status = STATUS_PAID;
        trades[user][index] = trade;
        relayerAsset[msg.sender] = relayerAsset[msg.sender].sub(trade.amount.sub(trade.fee));

        emit Accept(msg.sender, user, index);

        IERC20 token = IERC20(tokenAddressL2[ETH_TOKEN_INDEX]);
        require(token.transfer(trade.user, trade.amount.sub(trade.fee)), "Transfer Fail");
    }

    function newTrade(
        uint256 amount,
        address to,
        uint256 fee,
        uint8 tokenTypeIndex
    ) external {
        require(tokenTypeIndex == ETH_TOKEN_INDEX, "Only ETH Support for now");
        trades[msg.sender].push(
            Trade(
                trades[msg.sender].length,
                msg.sender,
                tokenTypeIndex,
                amount,
                block.timestamp,
                to,
                address(0x0),
                STATUS_START,
                fee,
                block.timestamp,
                false
            )
        );

        userTradeList.push(UserTrade(msg.sender, trades[msg.sender].length - 1));
        emit NewTrade(msg.sender, tokenTypeIndex, amount);

        IERC20 token = IERC20(tokenAddressL2[tokenTypeIndex]);
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer Fail");
    }

    function setUserDepositThreshold(uint256 threshold) external onlyOwner {
        userDepositThreshold = threshold;
    }

    function getTokenAddress(uint8 tokenTypeIndex, bool isL2) external view returns (address) {
        if (isL2) {
            return tokenAddressL2[tokenTypeIndex];
        }
        return tokenAddressL1[tokenTypeIndex];
    }

    function cancelTrade(uint256 index) external {
        Trade memory trade = getTrade(msg.sender, index);
        require(trade.status == STATUS_START, "Can't cancel after bidding");
        trade.status = STATUS_CANCEL;
        trades[msg.sender][index] = trade;
        IERC20 token = IERC20(tokenAddressL2[trade.tokenTypeIndex]);
        require(token.transfer(msg.sender, trade.amount), "Transfer Fail");
    }

    function dispute(address user, uint256 index) external {
        Trade memory trade = getTrade(user, index);
        if(trade.isUpward) {
            //TODO after the period, users can dispute
            require(trade.status == STATUS_START, "Can't dispute after paid");
        } else {
            require(trade.status == STATUS_PAID, "Can't dispute before paid");
        }

        trade.status = STATUS_DISPUTE;
        trade.disputeTimestamp = block.timestamp;
        trades[user][index] = trade;
        disputeList[trade.relayer].push(UserTrade(user, index));

        emit Dispute(user, index);
    }

    function isValidEvidence(Trade memory trade, Evidence calldata evidence) public view returns (bool){
        //uint256 blockNumber = uint256(RLPDecoder.toUintX(evidence.blockNumber, 0));
        return disputeManager.checkTransferTx(evidence.transaction, trade.to, trade.amount - trade.fee)
            && disputeManager.verifyBlockHeader(evidence.blockHash, evidence.rawBlockHeader) 
            && disputeManager.verifyProof(keccak256(evidence.transaction), evidence.txProof, evidence.rawBlockHeader[BLOCKHEADER_TRANSACTIONROOT_INDEX], evidence.path)
            && disputeManager.verifyRawTx(evidence.transaction, evidence.rawTx)
            && disputeManager.verifyBlockHash(evidence.blockHash, evidence.blockNumber);
    }

    function checkEvidenceExceptBlockHash(Trade memory trade, Evidence calldata evidence) external view returns (bool){
        return disputeManager.checkTransferTx(evidence.transaction, trade.to, trade.amount - trade.fee)
            && disputeManager.verifyBlockHeader(evidence.blockHash, evidence.rawBlockHeader) 
            && disputeManager.verifyProof(keccak256(evidence.transaction), evidence.txProof, evidence.rawBlockHeader[BLOCKHEADER_TRANSACTIONROOT_INDEX], evidence.path)
            && disputeManager.verifyRawTx(evidence.transaction, evidence.rawTx);
    }

    function slash(address user, uint256 index, Evidence calldata evidence) external {
        Trade memory trade = getTrade(user, index);
        require(trade.status == STATUS_DISPUTE, "Slashes must run after dispute");
        require(getHashedEvidence(user, index) == hashEvidence(evidence), "Different from the evidence previously submitted");

        if(
            (!trade.isUpward && !isValidEvidence(trade, evidence))
           || (trade.isUpward && isValidEvidence(trade, evidence))
        ) {
            uint256 relayerBondAmount = relayerBond[trade.relayer];
            relayerBond[trade.relayer] = 0;
    
            trade.status = STATUS_SLASHED;
            trades[user][index] = trade;
    
            emit Slash(user, index, trade.relayer);
    
            IERC20 token = IERC20(tokenAddressL2[ETH_TOKEN_INDEX]);
            require(token.transfer(msg.sender, relayerBondAmount.div(2)), "Transfer Fail");
            require(token.transfer(user, relayerBondAmount.div(2)), "Transfer Fail");

        }
    }

    function getDisputeList() external view returns (UserTrade[] memory) {
        return disputeList[msg.sender];
    }

    function getTrade(address user, uint256 index) public isTradeExist(user, index) view returns (Trade memory) {
        return trades[user][index];
    }

    function getUserTradeList() external view returns (UserTrade[] memory) {
        return userTradeList;
    }

    function getUserTradeListByIndex(uint256 _index) external view returns (UserTrade[] memory) {
        uint256 length = userTradeList.length - _index;
        UserTrade[] memory result = new UserTrade[](length);

        for (uint256 i = 0; i < length; i++) {
            result[i] = userTradeList[_index + i];
        }
        return result;
    }

    function getTrades(UserTrade[] memory userTrades) external view returns (Trade[] memory) {
        uint256 length = userTrades.length;
        Trade[] memory tradeList = new Trade[](length);

        for (uint256 i = 0; i < length; i++) {
            tradeList[i] = getTrade(userTrades[i].userAddress, userTrades[i].index);
        }

        return tradeList;
    }

    function getTradeList() external view returns (Trade[] memory) {
        return trades[msg.sender];
    }

    modifier isTradeExist(address user, uint256 index) {
        require(trades[user].length >= index + 1, "No Trade Exists");
        _;
    }

    function getRelayerBondBalance(address account) external view returns (uint256) {
        return relayerBond[account];
    }

    function getUserDepositBalance(address account) external view returns (uint256) {
        return userDeposit[account];
    }

    function getRelayerAssetBalance(address account) external view returns (uint256) {
        return relayerAsset[account];
    }

    function depositAsset(uint256 amount) external {
        relayerAsset[msg.sender] = relayerAsset[msg.sender].add(amount);
        IERC20 token = IERC20(tokenAddressL2[ETH_TOKEN_INDEX]);
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer Fail");
    }

    function withdrawAsset() external {
        uint256 amount = relayerAsset[msg.sender];
        relayerAsset[msg.sender] = 0;
        IERC20 token = IERC20(tokenAddressL2[ETH_TOKEN_INDEX]);
        require(token.transfer(msg.sender, amount), "Transfer Fail");
    }

    function depositBond(uint256 amount) external {
        relayerBond[msg.sender] = relayerBond[msg.sender].add(amount);
        IERC20 token = IERC20(tokenAddressL2[ETH_TOKEN_INDEX]);
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer Fail");
    }

    function withdrawBond() external {
        uint256 amount = relayerBond[msg.sender];
        relayerBond[msg.sender] = 0;
        IERC20 token = IERC20(tokenAddressL2[ETH_TOKEN_INDEX]);
        require(token.transfer(msg.sender, amount), "Transfer Fail");
    }

    function bid(address user, uint256 index) internal {
        Trade memory trade = getTrade(user, index);
        require(trade.status == STATUS_START, "Invalid Status");
        trade.relayer = msg.sender;
        trade.status = STATUS_BID;
        trades[user][index] = trade;

        emit Bid(msg.sender, user, index);
    }

    function refund(UserTrade[] memory userTrades) external onlyOwner {
        uint256 length = userTrades.length;

        for (uint256 i = 0; i < length; i++) {
            Trade memory trade = getTrade(userTrades[i].userAddress, userTrades[i].index);

            if (trade.status == STATUS_PAID || trade.status == STATUS_CANCEL) continue;
            IERC20 token = IERC20(tokenAddressL2[trade.tokenTypeIndex]);
            if (!token.transfer(trade.user, trade.amount)) return;
        }
    }

    function bulkBid(UserTrade[] calldata userTrades) external onlyOwner {
        //require(getRelayerBondBalance(msg.sender) >= 100); //TODO
        for (uint256 i = 0; i < userTrades.length; i++) {
            bid(userTrades[i].userAddress, userTrades[i].index);
        }
    }

    function bulkWithdraw(UserTrade[] calldata _userTrades, Evidence[] calldata _evidences) external onlyOwner {
        for (uint256 i = 0; i < _userTrades.length; i++) {
            withdraw(_userTrades[i].userAddress, _userTrades[i].index, _evidences[i]);
        }
    }

    function withdraw(
        address user,
        uint256 index,
        Evidence calldata evidence
    ) internal {
        //require(block.number >= toUint256(evidence.blockNumber) + SUBMIT_LIMIT_BLOCK_INTERVAL); //TODO
        Trade memory trade = getTrade(user, index);
        require(trade.status == STATUS_BID, "Withdraw must run after bid");
        require(trade.relayer == msg.sender, "Only Relayer can submit Evidences");
        require(disputeManager.checkTransferTx(evidence.transaction, trade.to, trade.amount - trade.fee), "Invalid Tx Data");

        trade.status = STATUS_PAID;
        hashedEvidences[user][index] = hashEvidence(evidence);
        trades[user][index] = trade;

        emit Withdraw(msg.sender, user, index);

        IERC20 token = IERC20(tokenAddressL2[trade.tokenTypeIndex]);
        require(token.transfer(msg.sender, trade.amount), "Transfer Fail");

    }

    function getEvidence(address user, uint256 index) public view returns (Evidence memory) {
        require(evidences[user][index].blockHash != keccak256(bytes("")), "No Evidence");
        return evidences[user][index];
    }

    function getHashedEvidence(address user, uint256 index) public view returns (bytes32) {
        require(hashedEvidences[user][index] != keccak256(bytes("")), "No Evidence");
        return hashedEvidences[user][index];
    }


    /*function getHashedEvidence(Evidence calldata evidence) internal view returns (bytes32){
         return keccak256(abi.encodePacked(
            evidence.blockNumber,
            evidence.blockHash,
            encodeBytesArray(evidence.txReceiptProof),
            encodeBytesArray(evidence.txProof),
            evidence.transaction,
            encodeUint8Array(evidence.txDataSpot),
            encodeUint8Array(evidence.path),
            evidence.txReceipt,
            encodeBytesArray(evidence.rawTx),
            encodeBytesArray(evidence.rawBlockHeader)
        ));
    }*/

    function hashEvidence(Evidence calldata evidence) internal pure returns (bytes32){
         return keccak256(bytes.concat(
             encodeBlockEvidence(evidence),
             encodeTxEvidence(evidence)
        ));
    }

    function encodeBlockEvidence(Evidence calldata evidence) internal pure returns (bytes memory){
        return abi.encodePacked(
            evidence.blockNumber,
            evidence.blockHash,
            encodeBytesArray(evidence.rawBlockHeader)
        );
    }

    function encodeTxEvidence(Evidence calldata evidence) internal pure returns (bytes memory){
        return abi.encodePacked(
            encodeBytesArray(evidence.txReceiptProof),
            encodeBytesArray(evidence.txProof),
            evidence.transaction,
            encodeUint8Array(evidence.txDataSpot),
            encodeUint8Array(evidence.path),
            evidence.txReceipt,
            encodeBytesArray(evidence.rawTx)
        );
    }

    function encodeBytesArray(bytes[] memory array) internal pure returns(bytes memory encoded) {
        for (uint i = 0; i < array.length; i++) {
            encoded = bytes.concat(
                encoded, abi.encodePacked(array[i])
            );
        }
    }

    function encodeUint8Array(uint8[] memory array) internal pure returns(bytes memory encoded) {
        for (uint i = 0; i < array.length; i++) {
            encoded = bytes.concat(
                encoded, abi.encodePacked(array[i])
            );
        }
    }


}
