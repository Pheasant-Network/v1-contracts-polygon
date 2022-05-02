const PheasantNetworkBridgeChild = artifacts.require("PheasantNetworkBridgeChild");
const PheasantNetworkDisputeManager = artifacts.require("PheasantNetworkDisputeManager");
const Helper = artifacts.require("Helper");
const DisputeHelper = artifacts.require("DisputeHelper");
const TestToken = artifacts.require("TestToken");
const TestCheckPointManager = artifacts.require("TestCheckPointManager");
const BN = require('bn.js');
const Util = require("ethereumjs-util")
const Web3 = require('web3');
const rlp = require('rlp');
const {time} = require('@openzeppelin/test-helpers');
const { EthereumProof } = require("ethereum-proof");
const HDWalletProvider = require("@truffle/hdwallet-provider");
const dotenv = require('dotenv');
dotenv.config();

/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */

contract("PheasantNetworkBridgeChild", function (/* accounts */) {

  let pheasantNetworkBridgeChild;
  let pheasantNetworkDisputeManager;
  let testToken;
  let testCheckPointManager;
  let accounts;
  let txParams;
  let helper;
  let tokenAddressList;
  const userDepositThreshold = new BN("30000000000000000000");
  before(async () => {
    accounts = await web3.eth.getAccounts();
    txParams = { from: accounts[0] };
    testToken = await TestToken.new(accounts[0], txParams);
    testCheckPointManager = await TestCheckPointManager.new();
    tokenAddressList = [
      testToken.address
    ]
  });

  beforeEach(async () => {
    pheasantNetworkDisputeManager = await PheasantNetworkDisputeManager.new(testCheckPointManager.address, txParams);
    //pheasantNetworkBridgeChild = await PheasantNetworkBridgeChild.new(testToken.address, userDepositThreshold, pheasantNetworkDisputeManager.address, txParams);
    pheasantNetworkBridgeChild = await PheasantNetworkBridgeChild.new(tokenAddressList, userDepositThreshold, pheasantNetworkDisputeManager.address, txParams);
    helper = await Helper.new(tokenAddressList, userDepositThreshold, pheasantNetworkDisputeManager.address, txParams);
  });

  it("test", async function () {
    let user = accounts[0];
    let amount = 10000;
    let fee = 100;
    await testToken.approve(helper.address, amount, {from:accounts[0]});
    await helper.newTrade(amount, user, fee, 0,  {from:accounts[0]});

  });

  it("newTrade", async function () {

    let user = accounts[0];
    let amount = 10000;
    let fee = 100;
    await testToken.approve(pheasantNetworkBridgeChild.address, amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(amount, user, fee, 0,  {from:accounts[0]});

    const trade = await pheasantNetworkBridgeChild.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.tokenTypeIndex, 0)
    assert.equal(trade.user, user)
    assert.equal(trade.amount, amount)
    assert.equal(trade.fee, fee)
    assert.equal(trade.to, user)
    assert.equal(trade.relayer, "0x0000000000000000000000000000000000000000")
    assert.equal(trade.status, "0")

    await testToken.approve(pheasantNetworkBridgeChild.address, amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(amount, user, fee, 0,  {from:accounts[0]});
    const trade2 = await pheasantNetworkBridgeChild.getTrade(accounts[0], 1);
    assert.equal(trade2.index, 1)
  });


  it("getTrades", async function () {

    let user = accounts[0];
    let amount = 10000;
    let fee = 100;
    await testToken.approve(pheasantNetworkBridgeChild.address, amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(amount, user, fee, 0,  {from:accounts[0]});

    await testToken.approve(pheasantNetworkBridgeChild.address, amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(amount, user, fee, 0,  {from:accounts[0]});
    const userTrades = [
      {userAddress: accounts[0], index: 0},
      {userAddress: accounts[0], index: 1}
    ]

    const trades = await pheasantNetworkBridgeChild.getTrades(userTrades);
    assert.equal(trades[0].index, 0)
    assert.equal(trades[0].tokenTypeIndex, 0)
    assert.equal(trades[0].user, user)
    assert.equal(trades[0].amount, amount)
    assert.equal(trades[0].fee, fee)
    assert.equal(trades[0].to, user)
    assert.equal(trades[0].relayer, "0x0000000000000000000000000000000000000000")
    assert.equal(trades[0].status, "0")


    assert.equal(trades[1].index, 1)
  });

  it("isTradeExist", async function () {

    let user = accounts[0];
    let amount = 10000;
    let fee = 100;
    let isTradeExist = await helper.helperIsTradeExist(user, 0);
    assert.equal(isTradeExist, false)
    await testToken.approve(helper.address, amount, {from:accounts[0]});
    await helper.newTrade(amount, user, fee, 0,  {from:accounts[0]});

    isTradeExist = await helper.helperIsTradeExist(user, 0);
    assert.equal(isTradeExist, true)
  });

  it("bid", async function () {

    let user = accounts[0];
    let amount = 10000;
    let fee = 100;
    await testToken.approve(helper.address, amount, {from:accounts[0]});
    await helper.newTrade(amount, user, fee, 0,  {from:accounts[0]});
    let trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.relayer, "0x0000000000000000000000000000000000000000")
    assert.equal(trade.status, "0")

    await helper.helperBid(user, 0, {from:accounts[0]});
    trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.relayer, accounts[0])
    assert.equal(trade.status, "1")

    await helper.helperBid(user, 0, {from:accounts[1]});
    trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.relayer, accounts[0])

  });

  it("bulkBid", async function () {

    let user = accounts[0];
    let amount = 10000;
    let fee = 100;
    await testToken.approve(pheasantNetworkBridgeChild.address, amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(amount, user, fee, 0,  {from:accounts[0]});
    let trade = await pheasantNetworkBridgeChild.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.relayer, "0x0000000000000000000000000000000000000000")
    assert.equal(trade.status, "0")


    await testToken.approve(pheasantNetworkBridgeChild.address, amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(amount, user, fee, 0,  {from:accounts[0]});
    trade = await pheasantNetworkBridgeChild.getTrade(accounts[0], 1);
    assert.equal(trade.index, 1)
    assert.equal(trade.relayer, "0x0000000000000000000000000000000000000000")
    assert.equal(trade.status, "0")

    const userTrades = [
      {userAddress: accounts[0], index: 0},
      {userAddress: accounts[0], index: 1}
    ]

    await pheasantNetworkBridgeChild.bulkBid(userTrades , {from:accounts[0]});
    trade = await pheasantNetworkBridgeChild.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.relayer, accounts[0])
    assert.equal(trade.status, "1")

    trade = await pheasantNetworkBridgeChild.getTrade(accounts[0], 1);
    assert.equal(trade.index, 1)
    assert.equal(trade.relayer, accounts[0])
    assert.equal(trade.status, "1")



  });

  it("checkTransferTx", async function () {

    let user = accounts[0];
    let amount = 100000000000000;

    let transaction = "0x02f872058202548459682f008459682f0982520894b0e426b1a0b8ba474dc5c8f6493b3e63d7121626865af3107a400080c080a034eec646e80e1e7e7fc3363502a7aab747516d4670383aa2c9bab8a37dd41522a074df6c8ef2e0f0f7969b5a7b3769fda73ae6ad6a385fed881203434c2a276382";

    //await testToken.approve(helper.address, amount, {from:accounts[0]});
    let result = await helper.helperCheckTransferTx(transaction, user, amount);
    assert.equal(result, true)

  });

  it("checkTransferTx, invalid recipient", async function () {

    let user = accounts[1];
    let amount = 100000000000000;

    let transaction = "0x02f872058202548459682f008459682f0982520894b0e426b1a0b8ba474dc5c8f6493b3e63d7121626865af3107a400080c080a034eec646e80e1e7e7fc3363502a7aab747516d4670383aa2c9bab8a37dd41522a074df6c8ef2e0f0f7969b5a7b3769fda73ae6ad6a385fed881203434c2a276382";

    //await testToken.approve(helper.address, amount, {from:accounts[0]});
    let result = await helper.helperCheckTransferTx(transaction, user, amount);
    assert.equal(result, false)

  });

  it("checkTransferTx, invalid amount", async function () {

    let user = accounts[0];
    let amount = 100000000000001;

    let transaction = "0x02f872058202548459682f008459682f0982520894b0e426b1a0b8ba474dc5c8f6493b3e63d7121626865af3107a400080c080a034eec646e80e1e7e7fc3363502a7aab747516d4670383aa2c9bab8a37dd41522a074df6c8ef2e0f0f7969b5a7b3769fda73ae6ad6a385fed881203434c2a276382";

    //await testToken.approve(helper.address, amount, {from:accounts[0]});
    let result = await helper.helperCheckTransferTx(transaction, user, amount);
    assert.equal(result, false)

  });

  it("withdraw", async function () {

    let user = accounts[0];
    let amount = 100000010000000;
    let fee = 10000000;
    await testToken.approve(helper.address, amount, {from:accounts[0]});
    let balance = await testToken.balanceOf(accounts[1]);
    assert.equal(balance.toNumber(), 0)

    await helper.newTrade(amount, user, fee, 0,  {from:accounts[0]});
    await helper.helperBid(user, 0, {from:accounts[1]});
    let trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.relayer, accounts[1])
    assert.equal(trade.status, "1")

    const evidence = {
      blockNumber: '0x5ed90c',
      blockHash: '0xd792952703adf456f92a4298f396da0fc5f771afd2082b46c9c5b2118e10db1c',
      txReceiptProof: [],
      txProof: [],
      transaction: '0x02f872058202548459682f008459682f0982520894b0e426b1a0b8ba474dc5c8f6493b3e63d7121626865af3107a400080c080a034eec646e80e1e7e7fc3363502a7aab747516d4670383aa2c9bab8a37dd41522a074df6c8ef2e0f0f7969b5a7b3769fda73ae6ad6a385fed881203434c2a276382',
      txDataSpot: [ 0, 0 ],
      path: [ 1, 11 ],
      txReceipt: '0x',
      rawTx: [],
      rawBlockHeader: []
    }

    await helper.helperWithdraw(user, 0, evidence,{from:accounts[1]});
    trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.relayer, accounts[1])
    assert.equal(trade.status, "2")

    balance = await testToken.balanceOf(accounts[1]);
    assert.equal(balance.toNumber(), amount)


  });

  it("withdraw invalid transaction", async function () {

    let user = accounts[0];
    let amount = 100000010000000;
    let fee = 1000000; //not enough amount transaction
    await testToken.approve(helper.address, amount, {from:accounts[0]});
    let balance = await testToken.balanceOf(accounts[2]);
    assert.equal(balance.toNumber(), 0)

    await helper.newTrade(amount, user, fee, 0,  {from:accounts[0]});
    await helper.helperBid(user, 0, {from:accounts[2]});
    let trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.relayer, accounts[2])
    assert.equal(trade.status, "1")

    const evidence = {
      blockNumber: '0x5ed90c',
      blockHash: '0xd792952703adf456f92a4298f396da0fc5f771afd2082b46c9c5b2118e10db1c',
      txReceiptProof: [],
      txProof: [],
      transaction: '0x02f872058202548459682f008459682f0982520894b0e426b1a0b8ba474dc5c8f6493b3e63d7121626865af3107a400080c080a034eec646e80e1e7e7fc3363502a7aab747516d4670383aa2c9bab8a37dd41522a074df6c8ef2e0f0f7969b5a7b3769fda73ae6ad6a385fed881203434c2a276382',
      txDataSpot: [ 0, 0 ],
      path: [ 1, 11 ],
      txReceipt: '0x',
      rawTx: [],
      rawBlockHeader: []
    }

    await helper.helperWithdraw(user, 0, evidence,{from:accounts[2]});
    trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.relayer, accounts[2])
    assert.equal(trade.status, "1") // skip

    balance = await testToken.balanceOf(accounts[2]);
    assert.equal(balance.toNumber(), 0)

  });

  it("withdraw invalid status", async function () {

    let user = accounts[0];
    let amount = 100000010000000;
    let fee = 10000000; 
    await testToken.approve(helper.address, amount, {from:accounts[0]});
    let balance = await testToken.balanceOf(accounts[2]);
    assert.equal(balance.toNumber(), 0)

    await helper.newTrade(amount, user, fee, 0,  {from:accounts[0]});
    const evidence = {
      blockNumber: '0x5ed90c',
      blockHash: '0xd792952703adf456f92a4298f396da0fc5f771afd2082b46c9c5b2118e10db1c',
      txReceiptProof: [],
      txProof: [],
      transaction: '0x02f872058202548459682f008459682f0982520894b0e426b1a0b8ba474dc5c8f6493b3e63d7121626865af3107a400080c080a034eec646e80e1e7e7fc3363502a7aab747516d4670383aa2c9bab8a37dd41522a074df6c8ef2e0f0f7969b5a7b3769fda73ae6ad6a385fed881203434c2a276382',
      txDataSpot: [ 0, 0 ],
      path: [ 1, 11 ],
      txReceipt: '0x',
      rawTx: [],
      rawBlockHeader: []
    }

    await helper.helperWithdraw(user, 0, evidence,{from:accounts[2]});
    trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.relayer, "0x0000000000000000000000000000000000000000")
    assert.equal(trade.status, "0") // skip

    balance = await testToken.balanceOf(accounts[2]);
    assert.equal(balance.toNumber(), 0)

  });

  it("withdraw invalid relayer", async function () {

    let user = accounts[0];
    let amount = 100000010000000;
    let fee = 10000000; 
    await testToken.approve(helper.address, amount, {from:accounts[0]});
    let balance = await testToken.balanceOf(accounts[2]);
    assert.equal(balance.toNumber(), 0)

    await helper.newTrade(amount, user, fee, 0,  {from:accounts[0]});
    await helper.helperBid(user, 0, {from:accounts[2]});
    let trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.relayer, accounts[2])
    assert.equal(trade.status, "1")

    const evidence = {
      blockNumber: '0x5ed90c',
      blockHash: '0xd792952703adf456f92a4298f396da0fc5f771afd2082b46c9c5b2118e10db1c',
      txReceiptProof: [],
      txProof: [],
      transaction: '0x02f872058202548459682f008459682f0982520894b0e426b1a0b8ba474dc5c8f6493b3e63d7121626865af3107a400080c080a034eec646e80e1e7e7fc3363502a7aab747516d4670383aa2c9bab8a37dd41522a074df6c8ef2e0f0f7969b5a7b3769fda73ae6ad6a385fed881203434c2a276382',
      txDataSpot: [ 0, 0 ],
      path: [ 1, 11 ],
      txReceipt: '0x',
      rawTx: [],
      rawBlockHeader: []

    }

    await helper.helperWithdraw(user, 0, evidence,{from:accounts[3]});
    trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.relayer, accounts[2])
    assert.equal(trade.status, "1") // skip

    balance = await testToken.balanceOf(accounts[3]);
    assert.equal(balance.toNumber(), 0)

  });

  it("bulkWithdraw", async function () {

    let user = accounts[0];
    let amount = 100000010000000;
    let fee = 10000000; 

    await testToken.approve(pheasantNetworkBridgeChild.address, amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(amount, user, fee, 0,  {from:accounts[0]});
    let trade = await pheasantNetworkBridgeChild.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.relayer, "0x0000000000000000000000000000000000000000")
    assert.equal(trade.status, "0")


    await testToken.approve(pheasantNetworkBridgeChild.address, amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(amount, user, fee, 0,  {from:accounts[0]});
    trade = await pheasantNetworkBridgeChild.getTrade(accounts[0], 1);
    assert.equal(trade.index, 1)
    assert.equal(trade.relayer, "0x0000000000000000000000000000000000000000")
    assert.equal(trade.status, "0")

    const userTrades = [
      {userAddress: accounts[0], index: 0},
      {userAddress: accounts[0], index: 1}
    ]

    await pheasantNetworkBridgeChild.bulkBid(userTrades , {from:accounts[0]});
    trade = await pheasantNetworkBridgeChild.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.relayer, accounts[0])
    assert.equal(trade.status, "1")

    trade = await pheasantNetworkBridgeChild.getTrade(accounts[0], 1);
    assert.equal(trade.index, 1)
    assert.equal(trade.relayer, accounts[0])
    assert.equal(trade.status, "1")

    const evidence = {
      blockNumber: '0x5ed90c',
      blockHash: '0xd792952703adf456f92a4298f396da0fc5f771afd2082b46c9c5b2118e10db1c',
      txReceiptProof: [],
      txProof: [],
      transaction: '0x02f872058202548459682f008459682f0982520894b0e426b1a0b8ba474dc5c8f6493b3e63d7121626865af3107a400080c080a034eec646e80e1e7e7fc3363502a7aab747516d4670383aa2c9bab8a37dd41522a074df6c8ef2e0f0f7969b5a7b3769fda73ae6ad6a385fed881203434c2a276382',
      txDataSpot: [ 0, 0 ],
      path: [ 1, 11 ],
      txReceipt: '0x',
      rawTx: [],
      rawBlockHeader: []
    }


    const evidences = [
      evidence,
      evidence
    ]


    await pheasantNetworkBridgeChild.bulkWithdraw(userTrades , evidences, {from:accounts[0]});
    trade = await pheasantNetworkBridgeChild.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.relayer, accounts[0])
    assert.equal(trade.status, "2")

    trade = await pheasantNetworkBridgeChild.getTrade(accounts[0], 1);
    assert.equal(trade.index, 1)
    assert.equal(trade.relayer, accounts[0])
    assert.equal(trade.status, "2")


  });

  it("cancelTrade", async function () {

    let user = accounts[0];
    let amount = 100000010000000;
    let fee = 10000000; 
    let initialBalance = await testToken.balanceOf(accounts[0]);

    await testToken.approve(pheasantNetworkBridgeChild.address, amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(amount, user, fee, 0,  {from:accounts[0]});
    let balance = await testToken.balanceOf(accounts[0]);
    assert.equal(balance.toString(), initialBalance.sub(new BN(amount)).toString())


    let trade = await pheasantNetworkBridgeChild.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.status, "0")

    await pheasantNetworkBridgeChild.cancelTrade(0, {from:accounts[0], gas: 500000});
    trade = await pheasantNetworkBridgeChild.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.status, "99")

    let afterBalance = await testToken.balanceOf(accounts[0]);
    assert.equal(initialBalance.toString(), afterBalance.toString())


  });

  it("getUserTradeListByIndex", async function () {

    let user = accounts[0];
    let amount = 10000;
    let fee = 100;
    await testToken.approve(pheasantNetworkBridgeChild.address, amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(amount, user, fee, 0,  {from:accounts[0]});

    await testToken.approve(pheasantNetworkBridgeChild.address, amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(amount, user, fee, 0,  {from:accounts[0]});

    await testToken.approve(pheasantNetworkBridgeChild.address, amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(amount, user, fee, 0,  {from:accounts[0]});

    await testToken.approve(pheasantNetworkBridgeChild.address, amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(amount, user, fee, 0,  {from:accounts[0]});

    const index = 2;
    let userTradeList = await pheasantNetworkBridgeChild.getUserTradeListByIndex(index);
    assert.equal(userTradeList.length, 2)
    assert.equal(userTradeList[0].index, 2)
    assert.equal(userTradeList[1].index, 3)
    userTradeList = await pheasantNetworkBridgeChild.getUserTradeListByIndex(4);
    assert.equal(userTradeList.length, 0)
  });


  it("dispute", async function () {

    let user = accounts[0];
    let amount = 100000010000000;
    let fee = 10000000;
    await testToken.approve(helper.address, amount, {from:accounts[0]});
    let balance = await testToken.balanceOf(accounts[1]);

    await helper.newTrade(amount, user, fee, 0,  {from:accounts[0]});
    await helper.helperBid(user, 0, {from:accounts[1]});
    let trade = await helper.getTrade(accounts[0], 0);

    const evidence = {
      blockNumber: '0x5ed90c',
      blockHash: '0xd792952703adf456f92a4298f396da0fc5f771afd2082b46c9c5b2118e10db1c',
      txReceiptProof: [],
      txProof: [],
      transaction: '0x02f872058202548459682f008459682f0982520894b0e426b1a0b8ba474dc5c8f6493b3e63d7121626865af3107a400080c080a034eec646e80e1e7e7fc3363502a7aab747516d4670383aa2c9bab8a37dd41522a074df6c8ef2e0f0f7969b5a7b3769fda73ae6ad6a385fed881203434c2a276382',
      txDataSpot: [ 0, 0 ],
      path: [ 1, 11 ],
      txReceipt: '0x',
      rawTx: [],
      rawBlockHeader: []

    }

    await helper.helperWithdraw(user, 0, evidence,{from:accounts[1]});
    trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.status, 2)
    assert.equal(trade.disputeTimestamp, trade.timestamp);

    await time.increase(time.duration.minutes(58));
    balance = await testToken.balanceOf(helper.address);
    assert.equal(balance, 0);

    await testToken.approve(helper.address, userDepositThreshold, {from:accounts[0]});
    let userBalance = await helper.getUserDepositBalance(accounts[0]);
    assert.equal(userBalance.toString(), 0)

    await helper.dispute(0,{from:accounts[0]});
    trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.status, 3)
    assert.notEqual(trade.disputeTimestamp, trade.timestamp)

    let disputeList = await helper.getDisputeList({from:accounts[1]});
    assert.equal(disputeList[0].userAddress, accounts[0])

    balance = await testToken.balanceOf(helper.address);
    assert.equal(balance, userDepositThreshold.toString())

    userBalance = await helper.getUserDepositBalance(accounts[0]);
    assert.equal(userBalance.toString(), userDepositThreshold.toString())




  });


  it("dispute invalid timestamp", async function () {

    let user = accounts[0];
    let amount = 100000010000000;
    let fee = 10000000;
    await testToken.approve(helper.address, amount, {from:accounts[0]});
    let balance = await testToken.balanceOf(accounts[1]);

    await helper.newTrade(amount, user, fee, 0,  {from:accounts[0]});
    await helper.helperBid(user, 0, {from:accounts[1]});
    let trade = await helper.getTrade(accounts[0], 0);

    const evidence = {
      blockNumber: '0x5ed90c',
      blockHash: '0xd792952703adf456f92a4298f396da0fc5f771afd2082b46c9c5b2118e10db1c',
      txReceiptProof: [],
      txProof: [],
      transaction: '0x02f872058202548459682f008459682f0982520894b0e426b1a0b8ba474dc5c8f6493b3e63d7121626865af3107a400080c080a034eec646e80e1e7e7fc3363502a7aab747516d4670383aa2c9bab8a37dd41522a074df6c8ef2e0f0f7969b5a7b3769fda73ae6ad6a385fed881203434c2a276382',
      txDataSpot: [ 0, 0 ],
      path: [ 1, 11 ],
      txReceipt: '0x',
      rawTx: [],
      rawBlockHeader: []

    }

    await helper.helperWithdraw(user, 0, evidence,{from:accounts[1]});
    trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.status, 2)
    assert.equal(trade.disputeTimestamp, trade.timestamp);

    await time.increase(time.duration.hours(1));
    try {
      await testToken.approve(helper.address, userDepositThreshold, {from:accounts[0]});
      await helper.dispute(0,{from:accounts[0]});
      assert.fail();
    }catch(e) {
      assert.equal(e.message, "Returned error: VM Exception while processing transaction: revert");
    }


  });



  it("dispute invalid status", async function () {

    let user = accounts[0];
    let amount = 100000010000000;
    let fee = 10000000;
    await testToken.approve(helper.address, amount, {from:accounts[0]});
    let balance = await testToken.balanceOf(accounts[1]);

    await helper.newTrade(amount, user, fee, 0,  {from:accounts[0]});
    await helper.helperBid(user, 0, {from:accounts[1]});
    let trade = await helper.getTrade(accounts[0], 0);

    const evidence = {
      blockNumber: '0x5ed90c',
      blockHash: '0xd792952703adf456f92a4298f396da0fc5f771afd2082b46c9c5b2118e10db1c',
      txReceiptProof: [],
      txProof: [],
      transaction: '0x02f872058202548459682f008459682f0982520894b0e426b1a0b8ba474dc5c8f6493b3e63d7121626865af3107a400080c080a034eec646e80e1e7e7fc3363502a7aab747516d4670383aa2c9bab8a37dd41522a074df6c8ef2e0f0f7969b5a7b3769fda73ae6ad6a385fed881203434c2a276382',
      txDataSpot: [ 0, 0 ],
      path: [ 1, 11 ],
      txReceipt: '0x',
      rawTx: [],
      rawBlockHeader: []

    }

    assert.equal(trade.status, 1)
    try {
      await testToken.approve(helper.address, userDepositThreshold, {from:accounts[0]});
      await helper.dispute(0,{from:accounts[0]});
      assert.fail();
    }catch(e) {
      assert.equal(e.message, "Returned error: VM Exception while processing transaction: revert");
    }

  });

  it("slash", async function () {

    let user = accounts[0];
    let amount = 100000010000000;
    let fee = 10000000;

    await testToken.transfer(accounts[1], amount, {from:accounts[0]});
    await testToken.approve(helper.address, amount, {from:accounts[1]});
    await helper.deposit(amount,{from:accounts[1]});
    let balance = await testToken.balanceOf(helper.address);

    await testToken.approve(helper.address, amount, {from:accounts[0]});

    await helper.newTrade(amount, user, fee, 0,  {from:accounts[0]});
    await helper.helperBid(user, 0, {from:accounts[1]});
    let trade = await helper.getTrade(accounts[0], 0);

    const evidence = {
      blockNumber: '0x5ed90c',
      blockHash: '0xd792952703adf456f92a4298f396da0fc5f771afd2082b46c9c5b2118e10db1c',
      txReceiptProof: [],
      txProof: [],
      transaction: '0x02f872058202548459682f008459682f0982520894b0e426b1a0b8ba474dc5c8f6493b3e63d7121626865af3107a400080c080a034eec646e80e1e7e7fc3363502a7aab747516d4670383aa2c9bab8a37dd41522a074df6c8ef2e0f0f7969b5a7b3769fda73ae6ad6a385fed881203434c2a276382',
      txDataSpot: [ 0, 0 ],
      path: [ 1, 11 ],
      txReceipt: '0x',
      rawTx: [],
      rawBlockHeader: []

    }

    await helper.helperWithdraw(user, 0, evidence,{from:accounts[1]});

    await time.increase(time.duration.minutes(58));
    await testToken.approve(helper.address, userDepositThreshold, {from:accounts[0]});
    await helper.dispute(0,{from:accounts[0]});
    trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.status, 3)

    let initialUserBalance = await testToken.balanceOf(accounts[0]);
    await time.increase(time.duration.minutes(31));
    let userBalance = await helper.getUserDepositBalance(accounts[0]);
    assert.equal(userBalance.toString(), userDepositThreshold.toString())

    let relayerBalance = await helper.getRelayerDepositBalance(accounts[1]);
    assert.equal(relayerBalance.toString(), amount)


    await helper.slash(0,{from:accounts[0]});
    trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.status, 4)
    userBalance = await helper.getUserDepositBalance(accounts[0]);
    assert.equal(userBalance.toString(), 0)
    relayerBalance = await helper.getRelayerDepositBalance(accounts[1]);
    assert.equal(relayerBalance.toString(), 0)
   
    balance = await testToken.balanceOf(accounts[0]);
    assert.equal(balance.toString(), initialUserBalance.add(new BN(amount)).add(new BN(userDepositThreshold)).toString())

  });

  it("slash invalid timestamp", async function () {

    let user = accounts[0];
    let amount = 100000010000000;
    let fee = 10000000;
    await testToken.approve(helper.address, amount, {from:accounts[0]});
    let balance = await testToken.balanceOf(accounts[1]);

    await helper.newTrade(amount, user, fee, 0,  {from:accounts[0]});
    await helper.helperBid(user, 0, {from:accounts[1]});
    let trade = await helper.getTrade(accounts[0], 0);

    const evidence = {
      blockNumber: '0x5ed90c',
      blockHash: '0xd792952703adf456f92a4298f396da0fc5f771afd2082b46c9c5b2118e10db1c',
      txReceiptProof: [],
      txProof: [],
      transaction: '0x02f872058202548459682f008459682f0982520894b0e426b1a0b8ba474dc5c8f6493b3e63d7121626865af3107a400080c080a034eec646e80e1e7e7fc3363502a7aab747516d4670383aa2c9bab8a37dd41522a074df6c8ef2e0f0f7969b5a7b3769fda73ae6ad6a385fed881203434c2a276382',
      txDataSpot: [ 0, 0 ],
      path: [ 1, 11 ],
      txReceipt: '0x',
      rawTx: [],
      rawBlockHeader: []

    }

    await helper.helperWithdraw(user, 0, evidence,{from:accounts[1]});

    await time.increase(time.duration.minutes(58));
    await testToken.approve(helper.address, userDepositThreshold, {from:accounts[0]});
    await helper.dispute(0,{from:accounts[0]});


    try {
      await helper.slash(0,{from:accounts[0]});
      assert.fail();
    }catch(e) {
      assert.equal(e.message, "Returned error: VM Exception while processing transaction: revert");
    }


  });


  it("submitEvidence", async function () {

    let user = accounts[0];
    let amount = 100000010000000;
    let fee = 10000000;
    await testToken.approve(helper.address, amount, {from:accounts[0]});
    let balance = await testToken.balanceOf(accounts[1]);

    await helper.newTrade(amount, user, fee, 0,  {from:accounts[0]});
    await helper.helperBid(user, 0, {from:accounts[1]});
    let trade = await helper.getTrade(accounts[0], 0);

    /*const evidence = {
      blockNumber: '0x5ed90c',
      blockHash: '0xd792952703adf456f92a4298f396da0fc5f771afd2082b46c9c5b2118e10db1c',
      txReceiptProof: [],
      txProof: [],
      transaction: '0x02f872058202548459682f008459682f0982520894b0e426b1a0b8ba474dc5c8f6493b3e63d7121626865af3107a400080c080a034eec646e80e1e7e7fc3363502a7aab747516d4670383aa2c9bab8a37dd41522a074df6c8ef2e0f0f7969b5a7b3769fda73ae6ad6a385fed881203434c2a276382',
      txDataSpot: [ 0, 0 ],
      path: [ 1, 11 ],
      txReceipt: '0x'
    }*/

    const evidence = {
      blockNumber: '0x624a71',
      blockHash: '0x162f57008b0727797b4e02e4308a3ecb920f6fe534efb3b5cf548e421604a7b0',
      txReceiptProof: [],
      txProof: [],
      transaction: '0x02f8700580847029fd38847029fd4282520894b0e426b1a0b8ba474dc5c8f6493b3e63d7121626865af3107a400080c080a0e652f92895753c04e12dec82396722de717cb6e23311b09848c3f8e7f6ec712ca06c9fa23e04fa2a05509fd426d0e4a64e96278af74034bae52f3bef7af1cb6e83',
      txDataSpot: [ 0, 0 ],
      path: [ 8, 1, 9, 10 ],
      txReceipt: '0x',
      rawTx: [],
      rawBlockHeader: []

    }

    await helper.helperWithdraw(user, 0, evidence,{from:accounts[1]});

    await time.increase(time.duration.minutes(58));
    await testToken.approve(helper.address, userDepositThreshold, {from:accounts[0]});
    await helper.dispute(0,{from:accounts[0]});
    let userBalance = await helper.getUserDepositBalance(accounts[0]);
    assert.equal(userBalance.toString(), userDepositThreshold.toString())


    trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.status, 3)

    let relayerBalance = await testToken.balanceOf(accounts[1]);
    const blockHeader =
    [ 
      '0x40a8d5e78f2d5ddd86d8bfc7b4c72e850dd41738da187dae3ee89dd9d405525b',
      '0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347',
      "0x0000000000000000000000000000000000000000",
      '0x18e078bb7956a437e1cb3a334ed445be6cce25593b4a2240e4404d285c95ea38',
      '0x2c44b55fc3af63d882cce460743e1f61df10d54351db3abba548f2c52150f6c1',
      '0x0bc81f20dcab9ccdfc530d12322dc839008842df27c670d1e151bb845f20a4b0',
      '0x000000800000000000000a400000000000080000808000000001000000010002000000000000000000100000000080000020000000100000000000008024840000080000000000010400000e000800000000000000040800020000004000000000001000002000010000018000000000000008000000000004001010130000001000000040000104000008000000012000000000020800040000000004000040020002000001001000241000000010800000000002000080000000000000000001000002080000088000000000000000000000000000000000000000000140000010000000004040000400000000000000000000000000000040000200000000',
      "0x02",
      '0x624a71',
      '0x01c9c347',
      '0x3f0c5f',
      '0x6219b01c',
      '0xd883010a0d846765746888676f312e31372e33856c696e7578000000000000008b3692147fce0e9e5132f909ad96cc2c6e33b9d49b19440d7db0a625b4a6067b21e626586b66fb574420fee5703a424f8b6dece8bc5ca51b965626c1416be74800',
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "0x0000000000000000",
      '0x09',
    ]
 
    const rawTx = [ 
       '0x05',
       '0x',
       '0x7029fd38',
       '0x7029fd42',
       '0x5208',
       '0xb0E426B1A0B8BA474Dc5c8F6493B3E63D7121626',
       '0x5af3107a4000',
       '0x',
       [],
       '0x',
       '0xe652f92895753c04e12dec82396722de717cb6e23311b09848c3f8e7f6ec712c',
       '0x6c9fa23e04fa2a05509fd426d0e4a64e96278af74034bae52f3bef7af1cb6e83'
    ]


    const submission = {
      blockNumber: '0x624a71',
      blockHash: '0x162f57008b0727797b4e02e4308a3ecb920f6fe534efb3b5cf548e421604a7b0',
      txReceiptProof: [],
      txProof: [
        '0xf90131a0ac1e38c6ea88b92b55ec98e4a8e752fcc9d07b5fd332fbb948a1c92922f6299ba09b5523def7604f44b1622a1d1b7be6ac9faaf5c82ae8775190b2aa4b2183bdc2a05a281bd917c22feac14a78bdea5e94af6b1c52b4a4ddf53586c8c46edd9864c6a04c34905b0102819eea59e290e3f9a06a9bcb009f6abb21ed0f50017d0a563540a0baadb96875e620f778ab3f686626c37c54924fdd0bbd49bf25a5b43b55fde72ea09e646485a141c8839b84de6f7da4e4ad087816a1e9d32d7322ce9abc47a02bc0a0ad335d5522ebccef4e4b433546d1561d7ad6b1bef8dca5c6bf096fed12374c75a0ccdd150d82ad0a233cee2eb2382ef7782d6164d9b41f2f4cbe9b0525c46ae858a06e863c7f77f7633b40a308bdc0461a64cddf34e74694b3f8b01f71abfb50b0978080808080808080',
        '0xf851a0ba9a293b03ac7766cd668f719fbb6bc4d624615c04ec8cc204b2b66739fa29c1a0763fce7bc293ca7221709e31523e9c90c2bca88b9277762db46d9d5bf655f97f808080808080808080808080808080',
        '0xf8518080808080808080a0562ff984058368f0aba9a45fd20aaad3a64d903aa0b2f10baee42e814234f795a0dcbb0453991cfd024ffcbd6add756d70ffb0fd5e09d0a63470a9b12952352a2080808080808080',
        '0xf901d1a0675473b9403ede92b3bceead14e582e5d880112af393c549b4bac58219030e0ea0cbf98b7df1f4c569ab420d757fa085a66748d46b735146e05db89f5eaf5b367ca0d46f135e05fa45faa08e8bb390154bd34d44180c4a8613b4a85b59e610b27248a04fd23740a74ec2d571ce46a18d63c40710bdcbede62e3584612a2c62c06c1bd0a0f9d1997d938343a7d57814a456f8c7fe5fbeb8c060228199b78745c1e16a8090a078fe0d9ae0553e927a8f6fcc387eb70a8d57f291a105367c31b04382c9d55ff9a0ebb802440dabfa7f7a9648baef7e7aec8a63c61070e854992288c9093751ba07a03fa79f04c223dca8582601842da01c2a758d57f7b1a9b0f31f2e0c988c7839cfa0116bf256199ecaa1905f8a2acb793d07b3f6bfc779d5b46ef5ca9e23b4ddae52a0a9ab1380900a212d81641b0685b1c95f58b2b23fba73723267b9e243f7ef79aba0928e135758b43a467bdeeb5ffea815501c7ed926600d241a7cdca089404eb6dca0423eefbbb525a43e9ec48cf3853b247824c1ca8e90efabb258a8c6d76c1e0e9ba057c3f19a42f931919a8f50b92623518ed97e8579a7a839a64c1f2b9284e3ffd8a0b8ea286a00b4634b0b4c26121c0501d04745c453b33596dcd35e454125a7b9f1808080',
        '0xf87620b87302f8700580847029fd38847029fd4282520894b0e426b1a0b8ba474dc5c8f6493b3e63d7121626865af3107a400080c080a0e652f92895753c04e12dec82396722de717cb6e23311b09848c3f8e7f6ec712ca06c9fa23e04fa2a05509fd426d0e4a64e96278af74034bae52f3bef7af1cb6e83'
      ],
      transaction: '0x02f8700580847029fd38847029fd4282520894b0e426b1a0b8ba474dc5c8f6493b3e63d7121626865af3107a400080c080a0e652f92895753c04e12dec82396722de717cb6e23311b09848c3f8e7f6ec712ca06c9fa23e04fa2a05509fd426d0e4a64e96278af74034bae52f3bef7af1cb6e83',
      txDataSpot: [ 0, 0 ],
      path: [ 8, 1, 9, 10 ],
      txReceipt: '0x',
      rawTx: rawTx,
      rawBlockHeader: blockHeader

    }
/*    const blockHeader =
    {
      parentHash: '0x40a8d5e78f2d5ddd86d8bfc7b4c72e850dd41738da187dae3ee89dd9d405525b',
      sha3Uncles: '0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347',
      miner: "0x0000000000000000000000000000000000000000",
      stateRoot: '0x18e078bb7956a437e1cb3a334ed445be6cce25593b4a2240e4404d285c95ea38',
      transactionsRoot: '0x2c44b55fc3af63d882cce460743e1f61df10d54351db3abba548f2c52150f6c1',
      receiptsRoot: '0x0bc81f20dcab9ccdfc530d12322dc839008842df27c670d1e151bb845f20a4b0',
      logsBloom: '0x000000800000000000000a400000000000080000808000000001000000010002000000000000000000100000000080000020000000100000000000008024840000080000000000010400000e000800000000000000040800020000004000000000001000002000010000018000000000000008000000000004001010130000001000000040000104000008000000012000000000020800040000000004000040020002000001001000241000000010800000000002000080000000000000000001000002080000088000000000000000000000000000000000000000000140000010000000004040000400000000000000000000000000000040000200000000',
      difficulty: "0x02",
      number: '0x624a71',
      gasLimit: '0x01c9c347',
      gasUsed: '0x3f0c5f',
      timestamp: '0x6219b01c',
      extraData: '0xd883010a0d846765746888676f312e31372e33856c696e7578000000000000008b3692147fce0e9e5132f909ad96cc2c6e33b9d49b19440d7db0a625b4a6067b21e626586b66fb574420fee5703a424f8b6dece8bc5ca51b965626c1416be74800',
      mixHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
      nonce: "0x0000000000000000",
      baseFeePerGas: '0x09',
    }*/

    await testCheckPointManager.setBlockHash(6441585, submission.blockHash, {from:accounts[0]});
    //await helper.submitEvidence(accounts[0], 0, submission, blockHeader,rawTx, {from:accounts[1]});
    await helper.submitEvidence(accounts[0], 0, submission, {from:accounts[1]});
    //await helper.submitEvidence(accounts[0], 0, result, {from:accounts[1]});
    trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.status, 5)

    balance = await testToken.balanceOf(accounts[1]);
    assert.equal(balance.toString(), relayerBalance.add(new BN(userDepositThreshold)).toString());
    userBalance = await helper.getUserDepositBalance(accounts[0]);
    assert.equal(userBalance.toString(), 0)


  });


  it("deposit", async function () {

    let user = accounts[0];
    let amount = 100000000000000;
    await testToken.approve(helper.address, amount, {from:accounts[0]});
    let balance = await testToken.balanceOf(helper.address);
    assert.equal(balance.toString(), 0)
    let userBalance = await testToken.balanceOf(accounts[0]);
    let relayerBalance = await helper.getRelayerDepositBalance(accounts[0]);
    assert.equal(relayerBalance.toString(), 0)

    await helper.deposit(amount,{from:accounts[0]});
    balance = await testToken.balanceOf(helper.address);
    assert.equal(balance.toString(), amount)
    balance = await testToken.balanceOf(accounts[0]);
    assert.equal(balance.toString(), userBalance - amount)

    relayerBalance = await helper.getRelayerDepositBalance(accounts[0]);
    assert.equal(relayerBalance.toString(), amount)



  });

  it("withdrawDeposit", async function () {
    let user = accounts[0];
    let amount = 100000000000000;
    await testToken.approve(helper.address, amount, {from:accounts[0]});
    let balance = await testToken.balanceOf(helper.address);
    assert.equal(balance.toString(), 0)

    await helper.deposit(amount,{from:accounts[0]});
    balance = await testToken.balanceOf(helper.address);
    assert.equal(balance.toString(), amount)
    let relayerBalance = await helper.getRelayerDepositBalance(accounts[0]);
    assert.equal(relayerBalance.toString(), amount)

    await helper.withdrawDeposit({from:accounts[0]});
    balance = await testToken.balanceOf(helper.address);
    assert.equal(balance.toString(), 0)
    relayerBalance = await helper.getRelayerDepositBalance(accounts[0]);
    assert.equal(relayerBalance.toString(), 0)
  });

  it("getTokenAddress", async function () {
    const l2Address =  await pheasantNetworkBridgeChild.getTokenAddress(0, true, {from:accounts[0]});
    assert.equal(l2Address, testToken.address)
  });

});

contract("PheasantNetworkDisputeManager", function (/* accounts */) {

  let pheasantNetworkBridgeChild;
  let pheasantNetworkDisputeManager;
  let testCheckPointManager;
  let testToken;
  let accounts;
  let txParams;
  let helper;
  let disputeHelper;
  const web3 = new Web3('http://localhost:8545');    

  before(async () => {
    accounts = await web3.eth.getAccounts();
    txParams = { from: accounts[0] };
    testToken = await TestToken.new(accounts[0], txParams);
    testCheckPointManager = await TestCheckPointManager.new();
  });

  beforeEach(async () => {
    //pheasantNetworkDisputeManager = await PheasantNetworkDisputeManager.new();
    pheasantNetworkDisputeManager = await PheasantNetworkDisputeManager.new(testCheckPointManager.address, txParams);
    disputeHelper = await DisputeHelper.new(testCheckPointManager.address, txParams);
  });
  it("verifyBlockHeader", async function () {
    const blockHash = "0xd792952703adf456f92a4298f396da0fc5f771afd2082b46c9c5b2118e10db1c";
    const blockHeader =
    [ 
      "0x671d6e9a041f1b41743faaae21331b46e72d99cbd4fd5fb60477d7f16268f7dc",
      "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
      "0x0000000000000000000000000000000000000000",
      "0x711bec99efae8b9dbad390d6d86ff819ec676c13142ba53cdf79ab3e8d529b80",
      "0x6620503086737b0b3b424d816cab4f06d7d7a004d457b409c606955134d816a8",
      "0x75f25da7d96b85673bd63fc48057d47a62c607787d60c044ba49869f304c166e",
       "0x0000040000001000000004000c0040000002400004000008000100220000000000100000000000808000000000040020802000000042080400000000002100400088080000000000000002080020280000000224014000000400008800080800000000002200000000000000800008000406004000082100000000100000009000000000400200100008200240000008000004810040000000000000040000100a0000501080040080000080000000000004000011040020000040000000000100000002000002204000000000001000002000000000000000004200800020000010000000004040000000000001000010120140000000040000002000400009",
      "0x02",
      "0x5ed90c",
      "0x01c9c380",
      "0x14e608",
      "0x61e54773",
      "0x0000000000000000000000000000000000000000000000000000000000000000e985ea5a68911d86ff0e269231e6f97f6f9a7a576e6afa2605b8a9d7442d3b7a74ab4290c82f85cf2b50bfd7aa3af771725998e7cb7ba5695d890c21da8a0e0201",
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "0x0000000000000000",
      "0x07"
    ]


    const result = await pheasantNetworkDisputeManager.verifyBlockHeader(blockHash, blockHeader);
    assert.isTrue(result);
  });

  /*it("verifyBlockHeader", async function () {
    //const blockHash = "0xdd08249cc3f6b6d787df9ac377c39c30668bf3c2222529e23f51cc61c4c7d708";
    const blockHash = "0xd792952703adf456f92a4298f396da0fc5f771afd2082b46c9c5b2118e10db1c";
    const blockHeader =
    {
      parentHash: "0x671d6e9a041f1b41743faaae21331b46e72d99cbd4fd5fb60477d7f16268f7dc",
      sha3Uncles: "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
      miner: "0x0000000000000000000000000000000000000000",
      stateRoot: "0x711bec99efae8b9dbad390d6d86ff819ec676c13142ba53cdf79ab3e8d529b80",
      transactionsRoot: "0x6620503086737b0b3b424d816cab4f06d7d7a004d457b409c606955134d816a8",
      receiptsRoot: "0x75f25da7d96b85673bd63fc48057d47a62c607787d60c044ba49869f304c166e",
      logsBloom: "0x0000040000001000000004000c0040000002400004000008000100220000000000100000000000808000000000040020802000000042080400000000002100400088080000000000000002080020280000000224014000000400008800080800000000002200000000000000800008000406004000082100000000100000009000000000400200100008200240000008000004810040000000000000040000100a0000501080040080000080000000000004000011040020000040000000000100000002000002204000000000001000002000000000000000004200800020000010000000004040000000000001000010120140000000040000002000400009",
      difficulty: "0x02",
      number: "0x5ed90c",
      gasLimit: "0x01c9c380",
      gasUsed: "0x14e608",
      timestamp: "0x61e54773",
      extraData: "0x0000000000000000000000000000000000000000000000000000000000000000e985ea5a68911d86ff0e269231e6f97f6f9a7a576e6afa2605b8a9d7442d3b7a74ab4290c82f85cf2b50bfd7aa3af771725998e7cb7ba5695d890c21da8a0e0201",
      mixHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
      nonce: "0x0000000000000000",
      baseFeePerGas: "0x07"
    }


    const result = await pheasantNetworkDisputeManager.verifyBlockHeader(blockHash, blockHeader);
    assert.isTrue(result);
  });*/


  it("verifyBlockHeader false", async function () {
    const blockHash = "0xcc43d2fc3f894c5d99661c4d02c95479d13355533641755ab51f4b858853312a"; //wrong block hash
    const blockHeader =
    [ 
      "0x671d6e9a041f1b41743faaae21331b46e72d99cbd4fd5fb60477d7f16268f7dc",
      "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
      "0x0000000000000000000000000000000000000000",
      "0x711bec99efae8b9dbad390d6d86ff819ec676c13142ba53cdf79ab3e8d529b80",
      "0x6620503086737b0b3b424d816cab4f06d7d7a004d457b409c606955134d816a8",
      "0x75f25da7d96b85673bd63fc48057d47a62c607787d60c044ba49869f304c166e",
       "0x0000040000001000000004000c0040000002400004000008000100220000000000100000000000808000000000040020802000000042080400000000002100400088080000000000000002080020280000000224014000000400008800080800000000002200000000000000800008000406004000082100000000100000009000000000400200100008200240000008000004810040000000000000040000100a0000501080040080000080000000000004000011040020000040000000000100000002000002204000000000001000002000000000000000004200800020000010000000004040000000000001000010120140000000040000002000400009",
      "0x02",
      "0x5ed90c",
      "0x01c9c380",
      "0x14e608",
      "0x61e54773",
      "0x0000000000000000000000000000000000000000000000000000000000000000e985ea5a68911d86ff0e269231e6f97f6f9a7a576e6afa2605b8a9d7442d3b7a74ab4290c82f85cf2b50bfd7aa3af771725998e7cb7ba5695d890c21da8a0e0201",
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "0x0000000000000000",
      "0x07"
    ]

    const result = await pheasantNetworkDisputeManager.verifyBlockHeader(blockHash, blockHeader);
    assert.isNotTrue(result);
  });


  it("bufferToNibble", async function () {

    const bufferStringArray = [ "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c"]; 
    const buffer = Buffer.from(bufferStringArray.join(''), 'hex');
    const result = await disputeHelper.helperBufferToNibble(buffer);
    assert.equal(bufferStringArray.length, result.length)
    for(let i = 0; i < result.length; i++) {
      assert.equal(result[i].toString(16), bufferStringArray[i])
    }
  });

  it("checkProof", async function () {

    const txHash = "0x87408fdb8cab715a54fef2f4fcade724a2ab8af0514ad87e4dfba605142048bf";
    const proof = [
    '0xf891a005b1b90ba86ef738bfb79d677668ac86829e9a087cf64a673e589ed52862e1bca03e651f383233f5d08ec2cd677e348c645c091cc5e5b431462ef4c5dc7ce84094a0573115215b322a70bf9154ef1bbb4f7d211fa11d831a836f9fac8c0c53c38afe8080808080a03c6a2c95680e0ce8b03065247b48a42c4f452472a60a89d5a3bc125edf5a38fc8080808080808080',
    '0xf90211a0245b86faa0fff7239732c5349f229000c0e979d02bbb7a4bdb81fdba765f9e9ba08f74444d640bf6b863313916ecd0798353f79b3077dba677483cf4014cf40407a013dfe71408a18d8044388894a507011b85ff9a33e43cdda7db2ade4308410d6aa008bab891c3f197e91ae52f500e715191fea5d4ebf556adfc5a913d17bca1d577a05e9dcc160d74c6ddc009551303c9233632a9ded8547d7dfff7a06368a5b16735a052b8f0e2555adbc5304e4f4117a5c02dc8ebdaf54252c6059fccc2998aacfc31a01f622b8dd4440f1075cec6a2c958b85e8191969cde8ef6b4d1796d25d465de34a08d3c3e9bf22c8452bc289a36d74233e5a4d1d6279d25a946251cf2dc98832564a06274b385050b58ce3bb24f959d745e4777b60b006c4f8643616b190428530f20a04cef9af88fa29a7b75abede8165ac394b4aa32f380788fef72dda422e010739ba006677bc336eb4c0442b926599872fcac00eb20823756540ccd67cae3eedfb9d8a018163956275c644e8ee2d27ef703805bd844c9751b7a8007ea9ac5354e56c43aa071b5ef7db89662cfa5a4c127a1605af600325b7f29ee5cc0dcfb10d64e5c3e8fa0163f15d795eef33faac6b85820f6c0fdc292ba5bc0dc7ff0073c7a29c2912929a051c32cd22d214cce0a298584502947fada07d775b0b4eca44da9b30b86967d0ca0ff1f887c345f629b226d3590db3a8ad981d84df527c9ab0a83332bf9a777630c80',
    '0xf8b620b8b302f8b005808459682f008459682f098301330e94582525da8d609b7fa7c3a58ccdc59d4ab92bfa5780b844a9059cbb000000000000000000000000e202b444db397f53ae05149fe2843d7841a2dcbe00000000000000000000000000000000000000000000021e19e0c9bab2400000c001a0ae7456d7d684bb97429079b14366ed6fcb4b55830136bc8bb1a8348c9d8043c1a05379dc47e2253044a1c93c15029af516b664f9a045c2f0ed8063c502aa5eb5f7'
  ];
    const txRoot = "0x3087644bce2559e711ec1c30b3620e68b3178114354c373a4d5c32120c4287f4";
    const path = [ 1, 13 ];

    const result = await pheasantNetworkDisputeManager.checkProof(proof, txRoot, path);
    assert.equal(txHash, web3.utils.keccak256(result))

  });

  it("checkProof wrong root", async function () {

    const txHash = "0x87408fdb8cab715a54fef2f4fcade724a2ab8af0514ad87e4dfba605142048bf";
    const proof = [
    '0xf891a005b1b90ba86ef738bfb79d677668ac86829e9a087cf64a673e589ed52862e1bca03e651f383233f5d08ec2cd677e348c645c091cc5e5b431462ef4c5dc7ce84094a0573115215b322a70bf9154ef1bbb4f7d211fa11d831a836f9fac8c0c53c38afe8080808080a03c6a2c95680e0ce8b03065247b48a42c4f452472a60a89d5a3bc125edf5a38fc8080808080808080',
    '0xf90211a0245b86faa0fff7239732c5349f229000c0e979d02bbb7a4bdb81fdba765f9e9ba08f74444d640bf6b863313916ecd0798353f79b3077dba677483cf4014cf40407a013dfe71408a18d8044388894a507011b85ff9a33e43cdda7db2ade4308410d6aa008bab891c3f197e91ae52f500e715191fea5d4ebf556adfc5a913d17bca1d577a05e9dcc160d74c6ddc009551303c9233632a9ded8547d7dfff7a06368a5b16735a052b8f0e2555adbc5304e4f4117a5c02dc8ebdaf54252c6059fccc2998aacfc31a01f622b8dd4440f1075cec6a2c958b85e8191969cde8ef6b4d1796d25d465de34a08d3c3e9bf22c8452bc289a36d74233e5a4d1d6279d25a946251cf2dc98832564a06274b385050b58ce3bb24f959d745e4777b60b006c4f8643616b190428530f20a04cef9af88fa29a7b75abede8165ac394b4aa32f380788fef72dda422e010739ba006677bc336eb4c0442b926599872fcac00eb20823756540ccd67cae3eedfb9d8a018163956275c644e8ee2d27ef703805bd844c9751b7a8007ea9ac5354e56c43aa071b5ef7db89662cfa5a4c127a1605af600325b7f29ee5cc0dcfb10d64e5c3e8fa0163f15d795eef33faac6b85820f6c0fdc292ba5bc0dc7ff0073c7a29c2912929a051c32cd22d214cce0a298584502947fada07d775b0b4eca44da9b30b86967d0ca0ff1f887c345f629b226d3590db3a8ad981d84df527c9ab0a83332bf9a777630c80',
    '0xf8b620b8b302f8b005808459682f008459682f098301330e94582525da8d609b7fa7c3a58ccdc59d4ab92bfa5780b844a9059cbb000000000000000000000000e202b444db397f53ae05149fe2843d7841a2dcbe00000000000000000000000000000000000000000000021e19e0c9bab2400000c001a0ae7456d7d684bb97429079b14366ed6fcb4b55830136bc8bb1a8348c9d8043c1a05379dc47e2253044a1c93c15029af516b664f9a045c2f0ed8063c502aa5eb5f7'
  ];
    const txRoot = "0xf94fdd74f197425dda1eeef534497f407158d845cac9092a5b7fea9681dbb239"; //wrong root
    const path = [ 1, 13 ];
    try {
      const result = await pheasantNetworkDisputeManager.checkProof(proof, txRoot, path);
      assert.fail();
    }catch(e) {
      assert.equal(e.message, "Returned error: VM Exception while processing transaction: revert Invalid Tx Root");
    }

  });



  it("verifyTxSignature", async function () {
    var list = [
      '0x05',
      '0x06',
      '0x59682f00',
      '0x59682f0a',
      '0x12da1',
      '0x499d11E0b6eAC7c0593d8Fb292DCBbF815Fb29Ae',
      '0x',
      '0xa9059cbb000000000000000000000000578d9b2d04bc99007b941787e88e4ea57d888a560000000000000000000000000000000000000000000000000de0b6b3a7640000',
      [],
      '0x',
      '0x10e1dcf5759151ab38ff9bdfa9e0ffa291e7c91ecc078d37a51cc1695b6b61b7',
      '0x6581c44376517a9906918379e87cf22d61f59e95cb29776fde2d7ae655e758da'
    ]

    const address = "0xE202B444Db397F53AE05149fE2843D7841A2dCBE";
    const result = await pheasantNetworkDisputeManager.verifyTxSignature(address, list);

    assert.isTrue(result);
    //console.log(result);

    var list2 = [
      '0x05',
      '0x10',
      '0x59682f00',
      '0x59682f09',
      '0x0aad87',
      '0x75d5e88adf8F3597c7C3e4a930544FB48089C779',
      '0x',
      '0x69328dec0000000000000000000000004a55a3a00d3afd19062dcad21b24c09d935f895a00000000000000000000000000000000000000000000000963a185106dd691dc00000000000000000000000067260f925d901e9cd9b113ba2ec06c7af53560bd',
      [],
      '0x01',
      '0xdc0c502fde9fafc6951a31e24e32ec996d1c04d6953117746cf47dc33e1e5d43',
      '0x36288ccd52fc8c07ab05d051f7cd61bd6d4813442cdd4e7cbe35204532c2fbe3',
    ]

    const address2 = "0x67260f925D901e9Cd9b113BA2Ec06c7Af53560Bd";
    const result2 = await pheasantNetworkDisputeManager.verifyTxSignature(address2, list2);

    assert.isTrue(result2);
  });


  it("verifyTxSignature false", async function () {
    var list = [
      '0x05',
      '0x06',
      '0x59682f00',
      '0x59682f0a',
      '0x12da1',
      '0x499d11E0b6eAC7c0593d8Fb292DCBbF815Fb29Ae',
      '0x',
      '0xa9059cbb000000000000000000000000578d9b2d04bc99007b941787e88e4ea57d888a560000000000000000000000000000000000000000000000000de0b6b3a7640000',
      [],
      '0x01', //wrong parity
      '0x10e1dcf5759151ab38ff9bdfa9e0ffa291e7c91ecc078d37a51cc1695b6b61b7',
      '0x6581c44376517a9906918379e87cf22d61f59e95cb29776fde2d7ae655e758da'
    ]

    const address = "0xE202B444Db397F53AE05149fE2843D7841A2dCBE";
    const result = await pheasantNetworkDisputeManager.verifyTxSignature(address, list);

    assert.isNotTrue(result);
  });


  it("verifyBlockHash", async function () {
    const blockHash = "0xd858caa161bde78ebc8a8fe12adae6ecf7f0bcb8b1547b992215bf13fdbe17f9";
    const blockNumber = 5858981;
    await testCheckPointManager.setBlockHash(blockNumber, blockHash, {from:accounts[0]});
    const blockHashResult = await testCheckPointManager.getBlockHash(blockNumber);

    assert.equal(blockHashResult, blockHash)
    const result = await pheasantNetworkDisputeManager.verifyBlockHash.call(blockHash, blockNumber);
    assert.isTrue(result);
  });


  it("verifyRawTx", async function () {
    const rawTx = [ 
       '0x05',
       '0x',
       '0x7029fd38',
       '0x7029fd42',
       '0x5208',
       '0xb0E426B1A0B8BA474Dc5c8F6493B3E63D7121626',
       '0x5af3107a4000',
       '0x',
       [],
       '0x',
       '0xe652f92895753c04e12dec82396722de717cb6e23311b09848c3f8e7f6ec712c',
       '0x6c9fa23e04fa2a05509fd426d0e4a64e96278af74034bae52f3bef7af1cb6e83'
    ]

    const transaction = '0x02f8700580847029fd38847029fd4282520894b0e426b1a0b8ba474dc5c8f6493b3e63d7121626865af3107a400080c080a0e652f92895753c04e12dec82396722de717cb6e23311b09848c3f8e7f6ec712ca06c9fa23e04fa2a05509fd426d0e4a64e96278af74034bae52f3bef7af1cb6e83'

    const result = await pheasantNetworkDisputeManager.verifyRawTx.call(transaction, rawTx);
    assert.isTrue(result);
  });

  it("verifyRawTx false", async function () {
    const rawTx = [ 
       '0x05',
       '0x',
       '0x7029fd38',
       '0x7029fd42',
       '0x5208',
       '0xb0E426B1A0B8BA474Dc5c8F6493B3E63D7121626',
       '0x5af3107a4000',
       '0x',
       [],
       '0x',
       '0xe652f92895753c04e12dec82396722de717cb6e23311b09848c3f8e7f6ec712c',
       '0x6c9fa23e04fa2a05509fd426d0e4a64e96278af74034bae52f3bef7af1cb6e83'
    ]

    const transaction = '0x02f87305820295849502f900849502f90e82791894e202b444db397f53ae05149fe2843d7841a2dcbe871f38a3b249400080c080a027094150a21e8d9485c58d1459254e334e8482c3dea46c8ef28aedada3e53c07a01bf9d6673eac1cc5a956070a6a38c954f07867d611964d49cc42940034cd103f'

    const result = await pheasantNetworkDisputeManager.verifyRawTx.call(transaction, rawTx);
    assert.isNotTrue(result);
  });



  it("ecrecover", async function () {
  var list3 = [
    '0x5',
    '0x6',
    '0x59682f00',
    '0x59682f0a',
    '0x12da1',
    '0x499d11E0b6eAC7c0593d8Fb292DCBbF815Fb29Ae',
    '0x',
    '0xa9059cbb000000000000000000000000578d9b2d04bc99007b941787e88e4ea57d888a560000000000000000000000000000000000000000000000000de0b6b3a7640000',
    [],
    '0x',
    '0x10e1dcf5759151ab38ff9bdfa9e0ffa291e7c91ecc078d37a51cc1695b6b61b7',
    '0x6581c44376517a9906918379e87cf22d61f59e95cb29776fde2d7ae655e758da'
  ]
const provider = new HDWalletProvider({
  mnemonic: "ill rigid magic normal mesh deny round faint museum staff suggest wool",
  providerOrUrl: process.env.PROVIDER_GOERLI,
  //chainId: 80001
  chainId: 5
});
const web3 = new Web3(provider);
const ethereumProof = new EthereumProof(web3);
    const blockHeader =
    {
      parentHash: "0x671d6e9a041f1b41743faaae21331b46e72d99cbd4fd5fb60477d7f16268f7dc",
      sha3Uncles: "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
      miner: "0x0000000000000000000000000000000000000000",
      stateRoot: "0x711bec99efae8b9dbad390d6d86ff819ec676c13142ba53cdf79ab3e8d529b80",
      transactionsRoot: "0x6620503086737b0b3b424d816cab4f06d7d7a004d457b409c606955134d816a8",
      receiptsRoot: "0x75f25da7d96b85673bd63fc48057d47a62c607787d60c044ba49869f304c166e",
      logsBloom: "0x0000040000001000000004000c0040000002400004000008000100220000000000100000000000808000000000040020802000000042080400000000002100400088080000000000000002080020280000000224014000000400008800080800000000002200000000000000800008000406004000082100000000100000009000000000400200100008200240000008000004810040000000000000040000100a0000501080040080000080000000000004000011040020000040000000000100000002000002204000000000001000002000000000000000004200800020000010000000004040000000000001000010120140000000040000002000400009",
      difficulty: "0x02",
      number: "0x5ed90c",
      gasLimit: "0x01c9c380",
      gasUsed: "0x14e608",
      timestamp: "0x61e54773",
      extraData: "0x0000000000000000000000000000000000000000000000000000000000000000e985ea5a68911d86ff0e269231e6f97f6f9a7a576e6afa2605b8a9d7442d3b7a74ab4290c82f85cf2b50bfd7aa3af771725998e7cb7ba5695d890c21da8a0e0201",
      mixHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
      nonce: "0x0000000000000000",
      baseFeePerGas: "0x07"
    }
let result = await ethereumProof.composeBlockHeader(6215948);
//console.log(result);
//result = await ethereumProof.composeTx("0xcf29aa9a8e728ccb838a51a04d13563371e688deb124b17c2435fce36f2919fc");
//console.log(Object.values(result.rawTx));
//console.log(web3.utils.keccak256("0x" + result.tx.toString('hex')));

const encodedtx = Buffer.concat([Buffer.from("02", 'hex'),rlp.encode(list3)])
const unsignedEncodedtx = Buffer.concat([Buffer.from("02", 'hex'),rlp.encode(list3.slice(0,9))])

const message = web3.utils.keccak256("0x" + unsignedEncodedtx.toString('hex'));
    const r ='0x10e1dcf5759151ab38ff9bdfa9e0ffa291e7c91ecc078d37a51cc1695b6b61b7';
    const s = '0x6581c44376517a9906918379e87cf22d61f59e95cb29776fde2d7ae655e758da';
    const v = 27;
    //const result2 = await pheasantNetworkDisputeManager.txEcrecover(message, v ,r ,s).estimateGas();
    const result2 = await pheasantNetworkDisputeManager.txEcrecover.estimateGas(message, v ,r ,s);
console.log(result2);

/*const encodedtx = Buffer.concat([Buffer.from("02", 'hex'),rlp.encode(list3)])
const unsignedEncodedtx = Buffer.concat([Buffer.from("02", 'hex'),rlp.encode(list3.slice(0,9))])
console.log(rlp.encode(list3).toString('hex')); //"こんにちわ" 
console.log(encodedtx); //"こんにちわ" 
console.log(web3.utils.keccak256("0x" + encodedtx.toString('hex'))); //"こんにちわ" 
console.log(web3.utils.keccak256("0x" + unsignedEncodedtx.toString('hex'))); //"こんにちわ" 
const message = web3.utils.keccak256("0x" + unsignedEncodedtx.toString('hex'));
    const r ='0x10e1dcf5759151ab38ff9bdfa9e0ffa291e7c91ecc078d37a51cc1695b6b61b7';
    const s = '0x6581c44376517a9906918379e87cf22d61f59e95cb29776fde2d7ae655e758da';
    //const v = 18 + 27;
    const v = 27;
    const result = await pheasantNetworkDisputeManager.txEcrecover(message, v ,r ,s);
    console.log(result);
    const result2 = await pheasantNetworkDisputeManager.rlpEncode(list3, true);
    const address = "0xE202B444Db397F53AE05149fE2843D7841A2dCBE";
    const result3 = await pheasantNetworkDisputeManager.verifyTxSignature(address, list3);
    console.log(result3);*/

    //const unsignedEncodedtx2 = Buffer.concat([Buffer.from("02", 'hex'), Buffer.from(result2.slice(2), 'hex')])
    //console.log(unsignedEncodedtx2);
//console.log(web3.utils.keccak256("0x" + unsignedEncodedtx2.toString('hex'))); //"こんにちわ" 
    //console.log(result2.slice(2));



  /*    blockHash: '0x464511303762992712dd3e9bc9c65521e95944b08f35943da96fe3862a1fe1d5',
  blockNumber: 6289881,
  chainId: '0x5',
  from: '0xE202B444Db397F53AE05149fE2843D7841A2dCBE',
  gas: 31000,
  gasPrice: '2500000007',
  hash: '0x636cd8bdff454099fda07d38ed59da395097b49c571870a20e844f2e4d3c100d',
  input: '0x',
  maxFeePerGas: '2500000014',
  maxPriorityFeePerGas: '2500000000',
  nonce: 629,
    const txHash = "0x636cd8bdff454099fda07d38ed59da395097b49c571870a20e844f2e4d3c100d";
    const r ='0xd1073daff97c4c60dcec546b9f0c45a5ecf9a934b48a408122bd3486809903a8';
    const s = '0x74a0ed9f768c5ee8dc4b1a57bc5ad9e2974742b707fcc9aab2c10ad1f24f46d';
    //const v = 18 + 27;
    const v = 46;
    const result = await pheasantNetworkDisputeManager.txEcrecover(txHash, v ,r ,s);
    console.log(result);
    console.log(web3.utils.keccak256(result));*/
  });
});

