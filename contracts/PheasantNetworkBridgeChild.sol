// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import {RLPDecoder} from "./RLPDecoder.sol";

contract PheasantNetworkBridgeChild  is Ownable{

  //constructor(address _tokenAddress, address _checkPointManager) {
  constructor(address _tokenAddress) {
      //tokenAddressL1[0] = _tokenAddress;
      tokenAddressL2[0] = _tokenAddress;
  }

  mapping(uint8 => address) internal tokenAddressL1;
  mapping(uint8 => address) internal tokenAddressL2;
  uint8 constant NOT_NATIVE = 0;
  uint8 constant ETHER = 1;
  uint8 constant MATIC = 2;
  uint8 constant STATUS_START = 0;
  uint8 constant STATUS_BID = 1;
  uint8 constant STATUS_PAID = 2;
  uint8 constant STATUS_CANCEL = 99;
  bytes constant TRANSFER_METHOD_ID = bytes(hex"a9059cbb");
  mapping(address => Trade[] ) internal trades;
  mapping(address => mapping(uint => Evidence) ) internal evidences;
 // uint constant SUBMIT_LIMIT_BLOCK_INTERVAL = 150; //approximately 30 min.

  struct UserTrade {
    address userAddress;
    uint index;
  }

  UserTrade[] internal userTradeList;

  struct Trade {
    uint index;
	address user;
    uint8 nativeFlg;
	address tokenL1;
	address tokenL2;
	uint amount;
	uint timestamp;
	address to;
	address changer;
	uint8 status;
	uint fee;
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
  }

  function newTrade(uint amount, address to, uint fee, uint8 tokenTypeIndex, uint8 nativeFlg) external payable{
    if (nativeFlg == NOT_NATIVE || nativeFlg == ETHER) {
        IERC20 token = IERC20(tokenAddressL2[tokenTypeIndex]);
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer Fail");
    }

    trades[msg.sender].push(Trade(
        trades[msg.sender].length,
        msg.sender,
        nativeFlg,
        nativeFlg == ETHER ? address(0x0) : tokenAddressL1[tokenTypeIndex],
        nativeFlg == MATIC ? address(0x0) : tokenAddressL2[tokenTypeIndex],
        nativeFlg == MATIC ? msg.value : amount,
        block.timestamp,
        to,
        address(0x0),
        STATUS_START,
        fee
    ));

    userTradeList.push(UserTrade(msg.sender, trades[msg.sender].length - 1));

  }

  function cancelTrade(uint index) external {
    require(isTradeExist(msg.sender, index));
    Trade memory trade = getTrade(msg.sender, index);
    require(trade.status == STATUS_START);
    trade.status = STATUS_CANCEL;
    trades[msg.sender][index] = trade;
    if (trade.nativeFlg == NOT_NATIVE || trade.nativeFlg == ETHER) {
        IERC20 token = IERC20(trade.tokenL2);
        require(token.transfer(msg.sender, trade.amount), "Transfer Fail");
    } else {
       payable(msg.sender).transfer(trade.amount);
    }
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

  function bid(address user, uint index) internal {
    Trade memory trade = getTrade(user, index);
    if(trade.status != STATUS_START) return ;
    trade.changer = msg.sender;
    trade.status = STATUS_BID;
    trades[user][index] = trade;
  }

  function refund(UserTrade[] memory userTrades) external onlyOwner{
    uint length = userTrades.length;

    for(uint i = 0; i < length; i++) {
        Trade memory trade = getTrade(userTrades[i].userAddress, userTrades[i].index);

        if(trade.status == STATUS_PAID || trade.status == STATUS_CANCEL) continue;
        if (trade.nativeFlg == NOT_NATIVE || trade.nativeFlg == ETHER) {
          IERC20 token = IERC20(trade.tokenL2);
          if(!token.transfer(trade.user, trade.amount)) return ;
        } else if (trade.nativeFlg == MATIC){
           payable(trade.user).transfer(trade.amount);
        }


    }

  }

  function bulkBid(UserTrade[] calldata userTrades) external onlyOwner{
    //require(getChangerBalance() >= 100); //TODO 
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
    if(trade.changer != msg.sender) return ;
    if(!checkTransferTx(evidence.transaction, trade.to, trade.amount - trade.fee)) return ;

    if (trade.nativeFlg == NOT_NATIVE || trade.nativeFlg == ETHER) {
        IERC20 token = IERC20(trade.tokenL2);
        if(!token.transfer(msg.sender, trade.amount)) return ;
    } else if (trade.nativeFlg == MATIC){
       payable(msg.sender).transfer(trade.amount);
    }

    trade.status = STATUS_PAID;
    evidences[user][index] = evidence;
    trades[user][index] = trade;

  }

  function checkTransferTx(bytes calldata transaction, address recipient, uint amount) internal pure returns(bool){
      bytes[] memory decodedTx =  decodeNode(transaction[1:]);
      bytes memory value = decodedTx[6];
      bytes memory to = decodedTx[5];
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
