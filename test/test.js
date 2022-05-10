const PheasantNetworkBridgeChild = artifacts.require("PheasantNetworkBridgeChild");
const Helper = artifacts.require("Helper");
const TestToken = artifacts.require("TestToken");
const TestDisputeManager = artifacts.require("TestDisputeManager");
const BN = require('bn.js');
const Util = require("ethereumjs-util")
const Web3 = require('web3');
const rlp = require('rlp');
const { time, expectRevert } = require('@openzeppelin/test-helpers');
const { EthereumProof } = require("ethereum-proof");
const HDWalletProvider = require("@truffle/hdwallet-provider");
const dotenv = require('dotenv');
const TestData = require('./utils.js');
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
  let testData;
  const userDepositThreshold = new BN("30000000000000000000");
  before(async () => {
    accounts = await web3.eth.getAccounts();
    testData = new TestData(accounts);
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

    const testTradeData = testData.getTradeData(0);
    await testToken.approve(pheasantNetworkBridgeChild.address, testTradeData.amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(testTradeData.amount, testTradeData.recipient, testTradeData.fee, 0,  {from:accounts[0]});

    const trade = await pheasantNetworkBridgeChild.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.tokenTypeIndex, 0)
    assert.equal(trade.user, accounts[0])
    assert.equal(trade.amount, testTradeData.amount)
    assert.equal(trade.fee, testTradeData.fee)
    assert.equal(trade.to, testTradeData.recipient)
    assert.equal(trade.relayer, "0x0000000000000000000000000000000000000000")
    assert.equal(trade.status, "0")
  });


  it("newTrade invalid tokeyTypeIndex", async function () {

    const testTradeData = testData.getTradeData(4);
    await testToken.approve(pheasantNetworkBridgeChild.address, testTradeData.amount, {from:accounts[0]});
    await expectRevert(
      pheasantNetworkBridgeChild.newTrade(testTradeData.amount, testTradeData.recipient, testTradeData.fee, testTradeData.tokenTypeIndex,  {from:accounts[0]}),
      "Only ETH Support for now"
    );


  });

  it("getTrade No Trade Error", async function () {
    await expectRevert(
      pheasantNetworkBridgeChild.getTrade(accounts[0], 0),
      "No Trade Exists"
    );
  });


  it("getTrades", async function () {

    const testTradeData = testData.getTradeData(0);
    const testTradeData2 = testData.getTradeData(1);
    await testToken.approve(pheasantNetworkBridgeChild.address, testTradeData.amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(testTradeData.amount, testTradeData.recipient, testTradeData.fee, 0,  {from:accounts[0]});

    await testToken.approve(pheasantNetworkBridgeChild.address, testTradeData2.amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(testTradeData2.amount, testTradeData2.recipient, testTradeData2.fee, 0,  {from:accounts[0]});
    const userTrades = [
      {userAddress: accounts[0], index: 0},
      {userAddress: accounts[0], index: 1}
    ]

    const trades = await pheasantNetworkBridgeChild.getTrades(userTrades);
    assert.equal(trades[0].index, 0)
    assert.equal(trades[0].tokenTypeIndex, 0)
    assert.equal(trades[0].user, accounts[0])
    assert.equal(trades[0].amount, testTradeData.amount)
    assert.equal(trades[0].fee, testTradeData.fee)
    assert.equal(trades[0].to, testTradeData.recipient)
    assert.equal(trades[0].relayer, "0x0000000000000000000000000000000000000000")
    assert.equal(trades[0].status, "0")
    assert.equal(trades[1].index, 1)
    assert.equal(trades[1].tokenTypeIndex, 0)
    assert.equal(trades[0].user, accounts[0])
    assert.equal(trades[1].amount, testTradeData2.amount)
    assert.equal(trades[1].fee, testTradeData2.fee)
    assert.equal(trades[1].to, testTradeData2.recipient)
    assert.equal(trades[1].relayer, "0x0000000000000000000000000000000000000000")
    assert.equal(trades[1].status, "0")

  });

  it("bid", async function () {

    const testTradeData = testData.getTradeData(0);
    await testToken.approve(helper.address, testTradeData.amount, {from:accounts[0]});
    await helper.newTrade(testTradeData.amount, testTradeData.recipient, testTradeData.fee, 0,  {from:accounts[0]});
    let trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.relayer, "0x0000000000000000000000000000000000000000")
    assert.equal(trade.status, "0")

    await helper.helperBid(accounts[0], 0, {from:accounts[0]});
    trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.relayer, accounts[0])
    assert.equal(trade.status, "1")

    await helper.helperBid(accounts[0], 0, {from:accounts[1]});
    trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.relayer, accounts[0])

  });

  it("bulkBid", async function () {

    const testTradeData = testData.getTradeData(0);
    await testToken.approve(pheasantNetworkBridgeChild.address, testTradeData.amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(testTradeData.amount, testTradeData.recipient, testTradeData.fee, 0,  {from:accounts[0]});
    let trade = await pheasantNetworkBridgeChild.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.relayer, "0x0000000000000000000000000000000000000000")
    assert.equal(trade.status, "0")


    await testToken.approve(pheasantNetworkBridgeChild.address, testTradeData.amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(testTradeData.amount, testTradeData.recipient, testTradeData.fee, 0,  {from:accounts[0]});
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

    const testTx = testData.getTransferTxData(0);
    let result = await helper.helperCheckTransferTx(testTx.transaction, testTx.recipient, testTx.amount);
    assert.equal(result, true)

  });

  it("checkTransferTx, invalid recipient", async function () {

    const testTx = testData.getTransferTxData(1);
    let result = await helper.helperCheckTransferTx(testTx.transaction, testTx.recipient, testTx.amount);
    assert.equal(result, false)

  });

  it("checkTransferTx, invalid amount", async function () {

    const testTx = testData.getTransferTxData(2);
    let result = await helper.helperCheckTransferTx(testTx.transaction, testTx.recipient, testTx.amount);
    assert.equal(result, false)

  });

  it("withdraw", async function () {

    const testTradeData = testData.getTradeData(2);
    await testToken.approve(helper.address, testTradeData.amount, {from:accounts[0]});
    let balance = await testToken.balanceOf(accounts[1]);
    assert.equal(balance.toNumber(), 0)

    await helper.newTrade(testTradeData.amount, testTradeData.recipient, testTradeData.fee, 0,  {from:accounts[0]});
    await helper.helperBid(accounts[0], 0, {from:accounts[1]});
    let trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.relayer, accounts[1])
    assert.equal(trade.status, "1")

    const evidence = testData.getEvidenceData(0);
    await helper.helperWithdraw(accounts[0], 0, evidence,{from:accounts[1]});
    trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.relayer, accounts[1])
    assert.equal(trade.status, "2")

    balance = await testToken.balanceOf(accounts[1]);
    assert.equal(balance.toNumber(), testTradeData.amount)


  });

  it("withdraw invalid transaction", async function () {

    const testTradeData = testData.getTradeData(3); //not enough amount transaction
    await testToken.approve(helper.address, testTradeData.amount, {from:accounts[0]});
    let balance = await testToken.balanceOf(accounts[2]);
    assert.equal(balance.toNumber(), 0)

    await helper.newTrade(testTradeData.amount, testTradeData.recipient, testTradeData.fee, 0,  {from:accounts[0]});
    await helper.helperBid(accounts[0], 0, {from:accounts[2]});
    let trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.relayer, accounts[2])
    assert.equal(trade.status, "1")

    const evidence = testData.getEvidenceData(0);
    await helper.helperWithdraw(accounts[0], 0, evidence,{from:accounts[2]});
    trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.relayer, accounts[2])
    assert.equal(trade.status, "1") // skip

    balance = await testToken.balanceOf(accounts[2]);
    assert.equal(balance.toNumber(), 0)

  });

  it("withdraw invalid status", async function () {

    const testTradeData = testData.getTradeData(2);
    await testToken.approve(helper.address, testTradeData.amount, {from:accounts[0]});
    let balance = await testToken.balanceOf(accounts[2]);
    assert.equal(balance.toNumber(), 0)

    await helper.newTrade(testTradeData.amount, testTradeData.recipient, testTradeData.fee, 0,  {from:accounts[0]});

    const evidence = testData.getEvidenceData(0);
    //NO BID
    await helper.helperWithdraw(accounts[0], 0, evidence,{from:accounts[2]});
    trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.relayer, "0x0000000000000000000000000000000000000000")
    assert.equal(trade.status, "0") // skip

    balance = await testToken.balanceOf(accounts[2]);
    assert.equal(balance.toNumber(), 0)

  });

  it("withdraw invalid relayer", async function () {

    const testTradeData = testData.getTradeData(2);
    await testToken.approve(helper.address, testTradeData.amount, {from:accounts[0]});
    let balance = await testToken.balanceOf(accounts[2]);
    assert.equal(balance.toNumber(), 0)

    await helper.newTrade(testTradeData.amount, testTradeData.recipient, testTradeData.fee, 0,  {from:accounts[0]});
    await helper.helperBid(accounts[0], 0, {from:accounts[2]});
    let trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.relayer, accounts[2])
    assert.equal(trade.status, "1")

    const evidence = testData.getEvidenceData(0);
    await helper.helperWithdraw(accounts[0], 0, evidence,{from:accounts[3]}); //invalid Relayer
    trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.relayer, accounts[2])
    assert.equal(trade.status, "1") // skip

    balance = await testToken.balanceOf(accounts[3]);
    assert.equal(balance.toNumber(), 0)

  });

  it("bulkWithdraw", async function () {

    const testTradeData = testData.getTradeData(2);
    await testToken.approve(pheasantNetworkBridgeChild.address, testTradeData.amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(testTradeData.amount, testTradeData.recipient, testTradeData.fee, 0,  {from:accounts[0]});
    let trade = await pheasantNetworkBridgeChild.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.relayer, "0x0000000000000000000000000000000000000000")
    assert.equal(trade.status, "0")


    await testToken.approve(pheasantNetworkBridgeChild.address, testTradeData.amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(testTradeData.amount, testTradeData.recipient, testTradeData.fee, 0,  {from:accounts[0]});
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

    const evidences = [
      testData.getEvidenceData(0),
      testData.getEvidenceData(0)
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

    const testTradeData = testData.getTradeData(2);
    let initialBalance = await testToken.balanceOf(accounts[0]);

    await testToken.approve(pheasantNetworkBridgeChild.address, testTradeData.amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(testTradeData.amount, testTradeData.recipient, testTradeData.fee, 0,  {from:accounts[0]});
    let balance = await testToken.balanceOf(accounts[0]);
    assert.equal(balance.toString(), initialBalance.sub(new BN(testTradeData.amount)).toString())


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

  it("cancelTrade can't cancel after bidding", async function () {

    const testTradeData = testData.getTradeData(2);
    let initialBalance = await testToken.balanceOf(accounts[0]);

    await testToken.approve(helper.address, testTradeData.amount, {from:accounts[0]});
    await helper.newTrade(testTradeData.amount, testTradeData.recipient, testTradeData.fee, 0,  {from:accounts[0]});
    
    let trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.status, "0")

    await helper.helperBid(accounts[0], 0, {from:accounts[0]});

    await expectRevert(
      helper.cancelTrade(0, {from:accounts[0], gas: 500000}),
      "Can't cancel after bidding"
    );


  });


  it("getUserTradeListByIndex", async function () {

    const testTradeData = testData.getTradeData(0);
    await testToken.approve(pheasantNetworkBridgeChild.address, testTradeData.amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(testTradeData.amount, testTradeData.recipient, testTradeData.fee, 0,  {from:accounts[0]});

    await testToken.approve(pheasantNetworkBridgeChild.address, testTradeData.amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(testTradeData.amount, testTradeData.recipient, testTradeData.fee, 0,  {from:accounts[0]});

    await testToken.approve(pheasantNetworkBridgeChild.address, testTradeData.amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(testTradeData.amount, testTradeData.recipient, testTradeData.fee, 0,  {from:accounts[0]});

    await testToken.approve(pheasantNetworkBridgeChild.address, testTradeData.amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(testTradeData.amount, testTradeData.recipient, testTradeData.fee, 0,  {from:accounts[0]});

    const index = 2;
    let userTradeList = await pheasantNetworkBridgeChild.getUserTradeListByIndex(index);
    assert.equal(userTradeList.length, 2)
    assert.equal(userTradeList[0].index, 2)
    assert.equal(userTradeList[1].index, 3)
    userTradeList = await pheasantNetworkBridgeChild.getUserTradeListByIndex(4);
    assert.equal(userTradeList.length, 0)
  });


  it("dispute", async function () {

    const testTradeData = testData.getTradeData(2);
    await testToken.approve(helper.address, testTradeData.amount, {from:accounts[0]});
    let balance = await testToken.balanceOf(accounts[1]);

    await helper.newTrade(testTradeData.amount, testTradeData.recipient, testTradeData.fee, 0,  {from:accounts[0]});
    await helper.helperBid(accounts[0], 0, {from:accounts[1]});
    let trade = await helper.getTrade(accounts[0], 0);

    const evidence = testData.getEvidenceData(0);
    await helper.helperWithdraw(accounts[0], 0, evidence,{from:accounts[1]});
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

    const testTradeData = testData.getTradeData(2);
    await testToken.approve(helper.address, testTradeData.amount, {from:accounts[0]});
    let balance = await testToken.balanceOf(accounts[1]);

    await helper.newTrade(testTradeData.amount, testTradeData.recipient, testTradeData.fee, 0,  {from:accounts[0]});
    await helper.helperBid(accounts[0], 0, {from:accounts[1]});
    let trade = await helper.getTrade(accounts[0], 0);

    const evidence = testData.getEvidenceData(0);

    await helper.helperWithdraw(accounts[0], 0, evidence,{from:accounts[1]});
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

    const testTradeData = testData.getTradeData(2);
    await testToken.approve(helper.address, testTradeData.amount, {from:accounts[0]});
    let balance = await testToken.balanceOf(accounts[1]);

    await helper.newTrade(testTradeData.amount, testTradeData.recipient, testTradeData.fee, 0,  {from:accounts[0]});
    await helper.helperBid(accounts[0], 0, {from:accounts[1]});
    let trade = await helper.getTrade(accounts[0], 0);

    const evidence = testData.getEvidenceData(0);

    assert.equal(trade.status, 1)
    //NO Withdraw
    try {
      await testToken.approve(helper.address, userDepositThreshold, {from:accounts[0]});
      await helper.dispute(0,{from:accounts[0]});
      assert.fail();
    }catch(e) {
      assert.equal(e.message, "Returned error: VM Exception while processing transaction: revert");
    }

  });

  it("slash", async function () {

    const testTradeData = testData.getTradeData(2);
    await testToken.transfer(accounts[1], testTradeData.amount, {from:accounts[0]});
    await testToken.approve(helper.address, testTradeData.amount, {from:accounts[1]});
    await helper.depositBond(testTradeData.amount,{from:accounts[1]});
    let balance = await testToken.balanceOf(helper.address);

    await testToken.approve(helper.address, testTradeData.amount, {from:accounts[0]});

    await helper.newTrade(testTradeData.amount, testTradeData.recipient, testTradeData.fee, 0,  {from:accounts[0]});
    await helper.helperBid(accounts[0], 0, {from:accounts[1]});
    let trade = await helper.getTrade(accounts[0], 0);

    const evidence = testData.getEvidenceData(0);
    await helper.helperWithdraw(accounts[0], 0, evidence,{from:accounts[1]});

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
    assert.equal(relayerBalance.toString(), testTradeData.amount)


    await helper.slash(0,{from:accounts[0]});
    trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.status, 4)
    userBalance = await helper.getUserDepositBalance(accounts[0]);
    assert.equal(userBalance.toString(), 0)
    relayerBalance = await helper.getRelayerBondBalance(accounts[1]);
    assert.equal(relayerBalance.toString(), 0)
   
    balance = await testToken.balanceOf(accounts[0]);
    assert.equal(balance.toString(), initialUserBalance.add(new BN(testTradeData.amount)).add(new BN(userDepositThreshold)).toString())

  });

  it("slash invalid timestamp", async function () {

    const testTradeData = testData.getTradeData(2);
    await testToken.approve(helper.address, testTradeData.amount, {from:accounts[0]});
    let balance = await testToken.balanceOf(accounts[1]);

    await helper.newTrade(testTradeData.amount, testTradeData.recipient, testTradeData.fee, 0,  {from:accounts[0]});
    await helper.helperBid(accounts[0], 0, {from:accounts[1]});
    let trade = await helper.getTrade(accounts[0], 0);

    const evidence = testData.getEvidenceData(0);
    await helper.helperWithdraw(accounts[0], 0, evidence,{from:accounts[1]});

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

    const testTradeData = testData.getTradeData(2);
    await testToken.approve(helper.address, testTradeData.amount, {from:accounts[0]});
    let balance = await testToken.balanceOf(accounts[1]);

    await helper.newTrade(testTradeData.amount, testTradeData.recipient, testTradeData.fee, 0,  {from:accounts[0]});
    await helper.helperBid(accounts[0], 0, {from:accounts[1]});
    let trade = await helper.getTrade(accounts[0], 0);
    const evidence = testData.getEvidenceData(1);
   

    await helper.helperWithdraw(accounts[0], 0, evidence,{from:accounts[1]});

    await time.increase(time.duration.minutes(58));
    await testToken.approve(helper.address, userDepositThreshold, {from:accounts[0]});
    await helper.dispute(0,{from:accounts[0]});
    let userBalance = await helper.getUserDepositBalance(accounts[0]);
    assert.equal(userBalance.toString(), userDepositThreshold.toString())


    trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.status, 3)

    let relayerBalance = await testToken.balanceOf(accounts[1]);
    const submission = testData.getEvidenceData(2);
    await helper.submitEvidence(accounts[0], 0, submission, {from:accounts[1] });
    trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.status, 5)

    balance = await testToken.balanceOf(accounts[1]);
    assert.equal(balance.toString(), relayerBalance.add(new BN(userDepositThreshold)).toString());
    userBalance = await helper.getUserDepositBalance(accounts[0]);
    assert.equal(userBalance.toString(), 0)


  });


  it("depositBond", async function () {

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



