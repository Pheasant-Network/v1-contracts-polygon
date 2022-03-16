// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {RLPDecoder} from "./RLPDecoder.sol";
//import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

interface PheasantNetworkDisputeManagerInterface {
  function verifyBlockHeader(bytes32  blockHash, bytes[] calldata blockHeaderRaw) external pure returns (bool);
  function checkProof(bytes[] memory proof, bytes memory bytesRoot, uint8[] memory path) external pure returns (bytes memory);
  function verifyRawTx(bytes memory transaction, bytes[] calldata txRaw) external pure returns(bool);
  function verifyTxSignature(address from, bytes[] calldata txRaw) external pure returns(bool);
  function verifyBlockHash(bytes32  _blockHash, uint _blockNumber) external view returns (bool);
}

contract PheasantNetworkBridgeChild  is Ownable{

  using SafeMath for uint;
  constructor(address[] memory _tokenAddressList, uint _userDepositThreshold, address _disputeManager) {
      tokenAddressL2[ETH_TOKEN_INDEX] = _tokenAddressList[ETH_TOKEN_INDEX];
      userDepositThreshold = _userDepositThreshold;
      disputeManager = PheasantNetworkDisputeManagerInterface(_disputeManager);
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
  uint8 constant STATUS_COMPLETE = 5;
  uint8 constant STATUS_CANCEL = 99;
  bytes constant TRANSFER_METHOD_ID = bytes(hex"a9059cbb");
  uint constant GRACE_PERIOD = 1 hours;
  uint constant DISPUTABLE_PERIOD = 1 hours;
  uint constant BLOCKHEADER_TRANSACTIONROOT_INDEX = 4;
  uint constant TRANSACTION_TO_INDEX = 5;
  uint constant TRANSACTION_VALUE_INDEX = 6;
  uint internal userDepositThreshold;
  mapping(address => Trade[] ) internal trades;
  mapping(address => mapping(uint => Evidence) ) internal evidences;
  mapping(address => uint256) internal relayerDeposit;
  mapping(address => uint256) internal userDeposit;
 //uint constant SUBMIT_LIMIT_BLOCK_INTERVAL = 150; //approximately 30 min.

  event NewTrade(address indexed userAddress, uint8 tokenTypeIndex, uint256 amount);
  event Bid(address indexed relayer, address indexed userAddress, uint256 index);
  event Withdraw(address indexed relayer, address indexed userAddress, uint256 index);
  event Dispute(address indexed userAddress, uint256 index);
  event Slash(address indexed userAddress, uint256 index, address indexed relayer);
  event Submit(address indexed relayer, address indexed userAddress, uint256 index);

  struct UserTrade {
    address userAddress;
    uint index;
  }

  UserTrade[] internal userTradeList;
  mapping(address => UserTrade[] ) internal disputeList;

  struct Trade {
    uint index;
	address user;
    uint8 tokenTypeIndex;
	uint amount;
	uint timestamp;
	address to;
	address relayer;
	uint8 status;
	uint fee;
	uint disputeTimestamp;
  }

  struct Evidence {
	bytes blockNumber;
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

  function newTrade(uint amount, address to, uint fee, uint8 tokenTypeIndex) external payable{
    require(tokenTypeIndex == ETH_TOKEN_INDEX, "Only ETH Support for now");
    IERC20 token = IERC20(tokenAddressL2[tokenTypeIndex]);
    require(token.transferFrom(msg.sender, address(this), amount), "Transfer Fail");

    trades[msg.sender].push(Trade(
        trades[msg.sender].length,
        msg.sender,
        tokenTypeIndex,
        tokenTypeIndex == MATIC_TOKEN_INDEX ? msg.value : amount,
        block.timestamp,
        to,
        address(0x0),
        STATUS_START,
        fee,
        block.timestamp
    ));

    userTradeList.push(UserTrade(msg.sender, trades[msg.sender].length - 1));

    emit NewTrade(msg.sender, tokenTypeIndex, amount);
  }

  function setUserDepositThreshold(uint threshold) external onlyOwner{
      userDepositThreshold = threshold;
  }

  function getTokenAddress(uint8 tokenTypeIndex, bool isL2) external view returns(address){
      if(isL2) {
          return tokenAddressL2[tokenTypeIndex];
      }
      return tokenAddressL1[tokenTypeIndex];
  }

  function cancelTrade(uint index) external {
    require(isTradeExist(msg.sender, index));
    Trade memory trade = getTrade(msg.sender, index);
    require(trade.status == STATUS_START);
    trade.status = STATUS_CANCEL;
    trades[msg.sender][index] = trade;
    IERC20 token = IERC20(tokenAddressL2[trade.tokenTypeIndex]);
    require(token.transfer(msg.sender, trade.amount), "Transfer Fail");
    //payable(msg.sender).transfer(trade.amount);
  }

  function dispute(uint index) external {
    require(isTradeExist(msg.sender, index));
    Trade memory trade = getTrade(msg.sender, index);
    require(trade.status == STATUS_PAID);
    require(trade.timestamp.add(DISPUTABLE_PERIOD) > block.timestamp);

    IERC20 token = IERC20(tokenAddressL2[ETH_TOKEN_INDEX]);
    require(token.transferFrom(msg.sender, address(this), userDepositThreshold), "Transfer Fail");
    userDeposit[msg.sender] = userDeposit[msg.sender].add(userDepositThreshold);

    trade.status = STATUS_DISPUTE;
    trade.disputeTimestamp = block.timestamp;
    trades[msg.sender][index] = trade;
    disputeList[trade.relayer].push(UserTrade(msg.sender, index));
  
    emit Dispute(msg.sender, index);
  }

  function slash(uint index) external {
    require(isTradeExist(msg.sender, index));
    Trade memory trade = getTrade(msg.sender, index);
    require(trade.status == STATUS_DISPUTE);
    require(trade.disputeTimestamp.add(GRACE_PERIOD) < block.timestamp);

    IERC20 token = IERC20(tokenAddressL2[ETH_TOKEN_INDEX]);
    uint userDepositAmount = userDeposit[msg.sender];
    userDeposit[msg.sender] = 0;
    require(token.transfer(msg.sender, userDepositAmount), "Transfer Fail");

    uint relayerDepositAmount = relayerDeposit[trade.relayer];
    relayerDeposit[trade.relayer] = 0;
    require(token.transfer(msg.sender, relayerDepositAmount), "Transfer Fail");

    trade.status = STATUS_SLASHED;
    trades[msg.sender][index] = trade;

    emit Slash(msg.sender, index, trade.relayer);
  }

  function submitEvidence(address user, uint index, Evidence calldata evidence) external {
    require(isTradeExist(user, index), "Trade Doesn't Exist");
    Trade memory trade = getTrade(user, index);
    require(trade.status == STATUS_DISPUTE, "Invalid Status");
    require(trade.relayer == msg.sender, "Only Relayer can submit Evidences");

    require(checkTransferTx(evidence.transaction, trade.to, trade.amount - trade.fee), "Invalid Tx Data");
    require(disputeManager.verifyBlockHeader(evidence.blockHash, evidence.rawBlockHeader), "Invalid BlockHeader");
    bytes memory transaction = disputeManager.checkProof(evidence.txProof, evidence.rawBlockHeader[BLOCKHEADER_TRANSACTIONROOT_INDEX], evidence.path);
    require(keccak256(transaction) == keccak256(evidence.transaction), "Invalid Tx Proof");
    require(disputeManager.verifyRawTx(evidence.transaction, evidence.rawTx), "Invalid Tx elements");
    require(disputeManager.verifyTxSignature(trade.relayer, evidence.rawTx), "Invalid Tx elements");
    uint blockNumber = uint(RLPDecoder.toUintX(evidence.blockNumber, 0));
    require(disputeManager.verifyBlockHash(evidence.blockHash, blockNumber), "Invalid blockHash");

    trade.status = STATUS_COMPLETE;
    trades[user][index] = trade;

    IERC20 token = IERC20(tokenAddressL2[ETH_TOKEN_INDEX]);
    uint userDepositAmount = userDeposit[trade.user];
    userDeposit[trade.user] = 0;
    require(token.transfer(msg.sender, userDepositAmount), "Transfer Fail");
    emit Submit(msg.sender, user, index);

  }

  function getDisputeList() external view returns(UserTrade[] memory){
    return disputeList[msg.sender];
  }

  function getTrade(address user, uint index) public view returns(Trade memory){
    require(isTradeExist(user, index));
    return trades[user][index];
  }

  function getUserTradeList() external view returns(UserTrade[] memory){
    return userTradeList;
  }

  function getUserTradeListByIndex(uint _index) external view returns(UserTrade[] memory){
    uint length = userTradeList.length - _index;
    UserTrade[] memory result = new UserTrade[](length);

    for(uint i = 0; i < length; i++) {
        result[i] = userTradeList[_index + i];
    }
    return result;
  }

  function getTrades(UserTrade[] memory userTrades) external view returns(Trade[] memory){
    uint length = userTrades.length;
    Trade[] memory tradeList = new Trade[](length);

    for(uint i = 0; i < length; i++) {
        tradeList[i] = getTrade(userTrades[i].userAddress, userTrades[i].index);
    }

    return tradeList;
  }

  function getTradeList() external view returns(Trade[] memory){
    return trades[msg.sender];
  }

  function isTradeExist(address user, uint index) internal view returns(bool){
      return trades[user].length >= index + 1;
  }

  function getRelayerDepositBalance(address account) view external returns (uint256){
        return relayerDeposit[account];
  }

  function getUserDepositBalance(address account) view external returns (uint256){
        return userDeposit[account];
  }

  function deposit(uint amount) external {
    IERC20 token = IERC20(tokenAddressL2[ETH_TOKEN_INDEX ]);
    require(token.transferFrom(msg.sender, address(this), amount), "Transfer Fail");
    relayerDeposit[msg.sender] = relayerDeposit[msg.sender].add(amount);
  }

  function withdrawDeposit() external {
    IERC20 token = IERC20(tokenAddressL2[ETH_TOKEN_INDEX ]);
    uint amount = relayerDeposit[msg.sender];
    relayerDeposit[msg.sender] = 0;
    require(token.transfer(msg.sender, amount), "Transfer Fail");
  }

  function bid(address user, uint index) internal {
    Trade memory trade = getTrade(user, index);
    if(trade.status != STATUS_START) return ;
    trade.relayer = msg.sender;
    trade.status = STATUS_BID;
    trades[user][index] = trade;
 
    emit Bid(msg.sender, user, index);
  }

  function refund(UserTrade[] memory userTrades) external onlyOwner{
    uint length = userTrades.length;

    for(uint i = 0; i < length; i++) {
        Trade memory trade = getTrade(userTrades[i].userAddress, userTrades[i].index);

        if(trade.status == STATUS_PAID || trade.status == STATUS_CANCEL) continue;
        IERC20 token = IERC20(tokenAddressL2[trade.tokenTypeIndex]);
        if(!token.transfer(trade.user, trade.amount)) return ;
        //payable(trade.user).transfer(trade.amount);
    }
  }

  function bulkBid(UserTrade[] calldata userTrades) external onlyOwner{
    //require(getRelayerDepositBalance(msg.sender) >= 100); //TODO 
    for(uint i = 0; i < userTrades.length; i++) {
      bid(userTrades[i].userAddress, userTrades[i].index);
    }
  }


  function bulkWithdraw(UserTrade[] calldata _userTrades, Evidence[] calldata _evidences) external onlyOwner{
    for(uint i = 0; i < _userTrades.length; i++) {
      withdraw(_userTrades[i].userAddress, _userTrades[i].index, _evidences[i]);
    }
  }

  function withdraw(address user, uint index, Evidence calldata evidence) internal{
    //require(block.number >= toUint256(evidence.blockNumber) + SUBMIT_LIMIT_BLOCK_INTERVAL); //TODO
    Trade memory trade = getTrade(user, index);
    if(trade.status != STATUS_BID) return ;
    if(trade.relayer != msg.sender) return ;
    if(!checkTransferTx(evidence.transaction, trade.to, trade.amount - trade.fee)) return ;

    IERC20 token = IERC20(tokenAddressL2[trade.tokenTypeIndex]);
    if(!token.transfer(msg.sender, trade.amount)) return ;
   // payable(msg.sender).transfer(trade.amount);

    trade.status = STATUS_PAID;
    evidences[user][index] = evidence;
    trades[user][index] = trade;
  
    emit Withdraw(msg.sender, user, index);

  }

  function checkTransferTx(bytes calldata transaction, address recipient, uint amount) internal pure returns(bool){
      bytes[] memory decodedTx =  decodeNode(transaction[1:]);
      bytes memory value = decodedTx[TRANSACTION_VALUE_INDEX];
      bytes memory to = decodedTx[TRANSACTION_TO_INDEX];
      bytes memory prefix = new bytes(32 - value.length);
      return toAddress(to, 0) == recipient && toUint256(bytes.concat(prefix, value), 0) >= amount;
  }

  function decodeNode(bytes memory item) public pure returns (bytes[] memory ){
      return RLPDecoder.decode(item);
  }

  function getEvidence(address user, uint index) public view returns(Evidence memory){
    require(keccak256(evidences[user][index].blockNumber) != keccak256(bytes("")), "No Evidence");
    return evidences[user][index];
  }


  function toUint256(bytes memory _bytes, uint256 _start) internal pure returns (uint256) {
      require(_bytes.length >= _start + 32, "toUint256_outOfBounds");
      uint256 tempUint;

      assembly {
          tempUint := mload(add(add(_bytes, 0x20), _start))
      }

      return tempUint;
  }

  function toAddress(bytes memory _bytes, uint256 _start) internal pure returns (address) {
      require(_bytes.length >= _start + 20, "toAddress_outOfBounds");
      address tempAddress;

      assembly {
          tempAddress := div(mload(add(add(_bytes, 0x20), _start)), 0x1000000000000000000000000)
      }

      return tempAddress;
  }



}
