const PheasantNetworkBridgeChild = artifacts.require("PheasantNetworkBridgeChild");
//const PheasantNetworkDisputeManager = artifacts.require("PheasantNetworkDisputeManager");
const Helper = artifacts.require("Helper");
//const DisputeHelper = artifacts.require("DisputeHelper");
const TestToken = artifacts.require("TestToken");
const TestDisputeManager = artifacts.require("TestDisputeManager");
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
  let testDisputeManager;
  let testToken;
  let accounts;
  let txParams;
  let helper;
  let tokenAddressList;
  const userDepositThreshold = new BN("30000000000000000000");
  before(async () => {
    accounts = await web3.eth.getAccounts();
    txParams = { from: accounts[0] };
    testToken = await TestToken.new(accounts[0], txParams);
    testDisputeManager = await TestDisputeManager.new();
    tokenAddressList = [
      testToken.address
    ]
  });

  beforeEach(async () => {
    pheasantNetworkBridgeChild = await PheasantNetworkBridgeChild.new(tokenAddressList, userDepositThreshold, testDisputeManager.address, txParams);
    helper = await Helper.new(tokenAddressList, userDepositThreshold, testDisputeManager.address, txParams);
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
    await helper.depositBond(amount,{from:accounts[1]});
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
    await time.increase(time.duration.minutes(61));
    let userBalance = await helper.getUserDepositBalance(accounts[0]);
    assert.equal(userBalance.toString(), userDepositThreshold.toString())

    let relayerBalance = await helper.getRelayerBondBalance(accounts[1]);
    assert.equal(relayerBalance.toString(), amount)


    await helper.slash(0,{from:accounts[0]});
    trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.status, 4)
    userBalance = await helper.getUserDepositBalance(accounts[0]);
    assert.equal(userBalance.toString(), 0)
    relayerBalance = await helper.getRelayerBondBalance(accounts[1]);
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

    //await helper.submitEvidence(accounts[0], 0, submission, blockHeader,rawTx, {from:accounts[1]});
    //await helper.submitEvidence(accounts[0], 0, submission, {from:accounts[1], gas: 8e6, gasPrice: 20e9});
    await helper.submitEvidence(accounts[0], 0, submission, {from:accounts[1] });
    //await helper.submitEvidence(accounts[0], 0, result, {from:accounts[1]});
    trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.status, 5)

    balance = await testToken.balanceOf(accounts[1]);
    assert.equal(balance.toString(), relayerBalance.add(new BN(userDepositThreshold)).toString());
    userBalance = await helper.getUserDepositBalance(accounts[0]);
    assert.equal(userBalance.toString(), 0)


  });


  it("depositBond", async function () {

    let user = accounts[0];
    let amount = 100000000000000;
    await testToken.approve(helper.address, amount, {from:accounts[0]});
    let balance = await testToken.balanceOf(helper.address);
    assert.equal(balance.toString(), 0)
    let userBalance = await testToken.balanceOf(accounts[0]);
    let relayerBalance = await helper.getRelayerBondBalance(accounts[0]);
    assert.equal(relayerBalance.toString(), 0)

    await helper.depositBond(amount,{from:accounts[0]});
    balance = await testToken.balanceOf(helper.address);
    assert.equal(balance.toString(), amount)
    balance = await testToken.balanceOf(accounts[0]);
    assert.equal(balance.toString(), userBalance - amount)

    relayerBalance = await helper.getRelayerBondBalance(accounts[0]);
    assert.equal(relayerBalance.toString(), amount)



  });

  it("withdrawBond", async function () {
    let user = accounts[0];
    let amount = 100000000000000;
    await testToken.approve(helper.address, amount, {from:accounts[0]});
    let balance = await testToken.balanceOf(helper.address);
    assert.equal(balance.toString(), 0)

    await helper.depositBond(amount,{from:accounts[0]});
    balance = await testToken.balanceOf(helper.address);
    assert.equal(balance.toString(), amount)
    let relayerBalance = await helper.getRelayerBondBalance(accounts[0]);
    assert.equal(relayerBalance.toString(), amount)

    await helper.withdrawBond({from:accounts[0]});
    balance = await testToken.balanceOf(helper.address);
    assert.equal(balance.toString(), 0)
    relayerBalance = await helper.getRelayerBondBalance(accounts[0]);
    assert.equal(relayerBalance.toString(), 0)
  });

  it("getTokenAddress", async function () {
    const l2Address =  await pheasantNetworkBridgeChild.getTokenAddress(0, true, {from:accounts[0]});
    assert.equal(l2Address, testToken.address)
  });

});



