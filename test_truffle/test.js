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
    txParams = { from: accounts[0] };
    testDisputeManager = await TestDisputeManager.new();
  });

  beforeEach(async () => {
    testToken = await TestToken.new(accounts[0], txParams);
    tokenAddressList = [
      testToken.address
    ]
    pheasantNetworkBridgeChild = await PheasantNetworkBridgeChild.new(tokenAddressList, userDepositThreshold, testDisputeManager.address, txParams);
    helper = await Helper.new(tokenAddressList, userDepositThreshold, testDisputeManager.address, txParams);
    testData = new TestData(accounts, helper, testToken);
  });

  it("setUpTrade", async function () {
    let testTradeData = testData.getTradeData(0);
    await testData.setUpTrade(testTradeData, 0);
    const setUpData = await helper.getTrade(testTradeData.sender, testTradeData.index);
    tradeAssert(testTradeData, setUpData);
  });

  it("setUpEvidence", async function () {
    const evidence = testData.getEvidenceData(0);
    await testData.setUpEvidence(accounts[0], 0, evidence, 0);
    const setUpData = await helper.getEvidence(accounts[0], 0);
    assert.equal(evidence.blockNumber, setUpData.blockNumber);
    assert.equal(evidence.blockHash, setUpData.blockHash);
    assert.equal(evidence.transaction, setUpData.transaction);

    const expectedTxDataSpot = evidence.txDataSpot.map((item) => {
      return String(item);
    });
    assert.deepEqual(expectedTxDataSpot, setUpData.txDataSpot);
    const expectedPath = evidence.path.map((item) => {
      return String(item);
    });
    assert.deepEqual(expectedPath, setUpData.path);
    assert.equal(evidence.txReceipt, setUpData.txReceipt);
  });

  it("setUpBalance", async function () {
    const amount = 10000;
    const testBondData = testData.getBondData(0);

    await testData.setUpBalance(testBondData.bond, 2);
    const balance = await testToken.balanceOf(accounts[2]);
    assert.equal(balance.toString(), String(testBondData.bond));
  });

  it("setUpBond", async function () {
    const testBondData = testData.getBondData(0);
    await testData.setUpBond(testBondData.bond, 0);
    const balance = await testToken.balanceOf(helper.address);
    assert.equal(balance.toString(), String(testBondData.bond));
    const bondBalance = await helper.getRelayerBondBalance(accounts[0]);
    assert.equal(bondBalance.toString(), String(testBondData.bond));

  });

  it("setUpUserDeposit", async function () {
    const amount = 10000;
    await testData.setUpUserDeposit(amount, 0);
    const balance = await testToken.balanceOf(helper.address);
    assert.equal(balance.toString(), String(amount));
    const bondBalance = await helper.getUserDepositBalance(accounts[0]);
    assert.equal(bondBalance.toString(), String(amount));
  });


  it("newTrade", async function () {

    const testTradeData = testData.getTradeData(0);
    await testToken.approve(pheasantNetworkBridgeChild.address, testTradeData.amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(testTradeData.amount, testTradeData.to, testTradeData.fee, testTradeData.tokenTypeIndex,  {from:accounts[0]});
    const trade = await pheasantNetworkBridgeChild.getTrade(accounts[0], 0);
    tradeAssert(testTradeData, trade, false);
  });


  it("newTrade invalid tokeyTypeIndex", async function () {

    const testTradeData = testData.getTradeData(4);
    await testToken.approve(pheasantNetworkBridgeChild.address, testTradeData.amount, {from:accounts[0]});
    await expectRevert(
      pheasantNetworkBridgeChild.newTrade(testTradeData.amount, testTradeData.to, testTradeData.fee, testTradeData.tokenTypeIndex,  {from:accounts[0]}),
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
    await testData.setUpTrade(testTradeData, 0);
    await testData.setUpTrade(testTradeData2, 0);
    const userTrades = [
      {userAddress: testTradeData.user, index: testTradeData.index},
      {userAddress: testTradeData2.user, index: testTradeData2.index}
    ]

    const trades = await helper.getTrades(userTrades);
    tradeAssert(testTradeData, trades[0], false);
    tradeAssert(testTradeData2, trades[1], false);
  });

  it("bid", async function () {

    const testTradeData = testData.getTradeData(0);
    await testData.setUpTrade(testTradeData, 0);

    await helper.helperBid(accounts[0], 0, {from:accounts[0]});
    const trade = await helper.getTrade(accounts[0], 0);
    const expectedData = testTradeData
    expectedData.status = "1"
    expectedData.relayer = accounts[0]
    tradeAssert(expectedData, trade, false);

  });

  it("bid Can't re-bid", async function () {
    const testTradeData = testData.getTradeData(5);
    await testData.setUpTrade(testTradeData, 0);
    await helper.helperBid(testTradeData.user, testTradeData.index, {from:accounts[0]});
    trade = await helper.getTrade(testTradeData.user, testTradeData.index);
    assert.equal(trade.relayer, testTradeData.relayer)
  });

  it("bulkBid", async function () {

    const testTradeData = testData.getTradeData(0);
    const testTradeData2 = testData.getTradeData(6);
    await testData.setUpTrade(testTradeData, 0);
    await testData.setUpTrade(testTradeData2, 0);
    const userTrades = [
      {userAddress: testTradeData.user, index: testTradeData.index},
      {userAddress: testTradeData2.user, index: testTradeData2.index}
    ]

    await helper.bulkBid(userTrades , {from:accounts[0]});
    let trade = await helper.getTrade(testTradeData.user, testTradeData.index);
    let expectedData = testTradeData
    expectedData.status = "1"
    expectedData.relayer = accounts[0]
    tradeAssert(expectedData, trade, false);

    trade = await helper.getTrade(testTradeData2.user, testTradeData2.index);
    expectedData = testTradeData2
    expectedData.status = "1"
    expectedData.relayer = accounts[0]
    tradeAssert(expectedData, trade, false);

  });


  it("bulkBid invalid status", async function () {

    const testTradeData = testData.getTradeData(0);
    const testTradeData2 = testData.getTradeData(20);
    await testData.setUpTrade(testTradeData, 0);
    await testData.setUpTrade(testTradeData2, 0);
    const userTrades = [
      {userAddress: testTradeData.user, index: testTradeData.index},
      {userAddress: testTradeData2.user, index: testTradeData2.index}
    ]

    await helper.bulkBid(userTrades , {from:accounts[0]});
    let trade = await helper.getTrade(testTradeData.user, testTradeData.index);
    let expectedData = testTradeData
    expectedData.status = "1"
    expectedData.relayer = accounts[0]
    tradeAssert(expectedData, trade, false);

    trade = await helper.getTrade(testTradeData2.user, testTradeData2.index);
    expectedData = testTradeData2
    expectedData.status = "1"
    expectedData.relayer = accounts[1]
    tradeAssert(expectedData, trade, false);

  });


  it("checkTransferTx", async function () {

    const testTx = testData.getTransferTxData(0);
    let result = await helper.helperCheckTransferTx(testTx.transaction, testTx.to, testTx.amount);
    assert.equal(result, true)

  });

  it("checkTransferTx, invalid to", async function () {

    const testTx = testData.getTransferTxData(1);
    let result = await helper.helperCheckTransferTx(testTx.transaction, testTx.to, testTx.amount);
    assert.equal(result, false)

  });

  it("checkTransferTx, invalid amount", async function () {

    const testTx = testData.getTransferTxData(2);
    let result = await helper.helperCheckTransferTx(testTx.transaction, testTx.to, testTx.amount);
    assert.equal(result, false)

  });

  it("withdraw", async function () {

    const testTradeData = testData.getTradeData(2);
    await testData.setUpTrade(testTradeData, 0, true);
    const evidence = testData.getEvidenceData(0);

    const InitialBalance = await testToken.balanceOf(accounts[0]);
    await helper.helperWithdraw(testTradeData.user, testTradeData.index, evidence,{from:accounts[0]});
    const trade = await helper.getTrade(testTradeData.user, testTradeData.index);
    const expectedData = testTradeData
    expectedData.status = "2"
    tradeAssert(expectedData, trade, false);

    const balance = await testToken.balanceOf(accounts[0]);
    assert.equal(balance.toString(), InitialBalance.add(new BN(testTradeData.amount)).toString())


  });

  it("withdraw invalid transaction", async function () {

    const testTradeData = testData.getTradeData(3); //not enough amount transaction
    await testData.setUpTrade(testTradeData, 0, true);
    const evidence = testData.getEvidenceData(0);

    const InitialBalance = await testToken.balanceOf(testTradeData.relayer);
    await helper.helperWithdraw(accounts[0], 0, evidence,{from:accounts[0]});
    const trade = await helper.getTrade(accounts[0], 0);
    const expectedData = testTradeData
    expectedData.status = "1"
    tradeAssert(expectedData, trade, false);
    const balance = await testToken.balanceOf(testTradeData.relayer);
    assert.equal(balance.toString(), InitialBalance.toString())

  });

  it("withdraw invalid status", async function () {

    const testTradeData = testData.getTradeData(7);
    await testData.setUpTrade(testTradeData, 0, true);
    //NO BID
    const evidence = testData.getEvidenceData(0);
    await helper.helperWithdraw(accounts[0], 0, evidence,{from:accounts[0]});
    const trade = await helper.getTrade(accounts[0], 0);
    tradeAssert(testTradeData, trade, false);

    const balance = await testToken.balanceOf(accounts[2]);
    assert.equal(balance.toString(), 0)

  });

  it("withdraw invalid relayer", async function () {

    const testTradeData = testData.getTradeData(21);
    await testData.setUpTrade(testTradeData, 0, true);
    const evidence = testData.getEvidenceData(0);

    const InitialBalance = await testToken.balanceOf(accounts[0]);
    await helper.helperWithdraw(accounts[0], 0, evidence,{from:accounts[0]}); //invalid Relayer
    const trade = await helper.getTrade(accounts[0], 0);

    tradeAssert(testTradeData, trade, false);
    const balance = await testToken.balanceOf(accounts[0]);
    assert.equal(balance.toString(), InitialBalance.toString())

  });

  it("bulkWithdraw", async function () {

    const testTradeData = testData.getTradeData(8);
    const testTradeData2 = testData.getTradeData(9);
    await testData.setUpTrade(testTradeData, 0, true);
    await testData.setUpTrade(testTradeData2, 0, true);
    const userTrades = [
      {userAddress: testTradeData.user, index: testTradeData.index},
      {userAddress: testTradeData2.user, index: testTradeData2.index}
    ]

    const evidences = [
      testData.getEvidenceData(0),
      testData.getEvidenceData(0)
    ]

    await helper.bulkWithdraw(userTrades , evidences, {from:accounts[0]});
    trade = await helper.getTrade(testTradeData.user, testTradeData.index);
    const expectedData = testTradeData
    expectedData.status = "2"
    tradeAssert(expectedData, trade, false);

    trade = await helper.getTrade(testTradeData2.user, testTradeData2.index);
    const expectedData2 = testTradeData2
    expectedData2.status = "2"
    tradeAssert(expectedData2, trade, false);


  });

  it("bulkWithdraw invalid status", async function () {

    const testTradeData = testData.getTradeData(8);
    const testTradeData2 = testData.getTradeData(22);
    await testData.setUpTrade(testTradeData, 0, true);
    await testData.setUpTrade(testTradeData2, 0, true);
    const userTrades = [
      {userAddress: testTradeData.user, index: testTradeData.index},
      {userAddress: testTradeData2.user, index: testTradeData2.index}
    ]

    const evidences = [
      testData.getEvidenceData(0),
      testData.getEvidenceData(0)
    ]

    await helper.bulkWithdraw(userTrades , evidences, {from:accounts[0]});
    trade = await helper.getTrade(testTradeData.user, testTradeData.index);
    const expectedData = testTradeData
    expectedData.status = "2"
    tradeAssert(expectedData, trade, false);

    trade = await helper.getTrade(testTradeData2.user, testTradeData2.index);
    const expectedData2 = testTradeData2
    expectedData2.status = "2"
    tradeAssert(expectedData2, trade, false);


  });


  it("cancelTrade", async function () {

    const testTradeData = testData.getTradeData(1);
    let initialBalance = await testToken.balanceOf(testTradeData.user);
    await testData.setUpTrade(testTradeData, 0, true);

    await helper.cancelTrade(0, {from:accounts[0]});
    let trade = await helper.getTrade(accounts[0], 0);
    const expectedData = testTradeData
    expectedData.status = "99"
    tradeAssert(expectedData, trade, false);

    let afterBalance = await testToken.balanceOf(testTradeData.user);
    assert.equal(initialBalance.toString(), afterBalance.toString())

  });

  it("cancelTrade can't cancel after bidding", async function () {

    const testTradeData = testData.getTradeData(2);
    await testData.setUpTrade(testTradeData, 0, true);
    await expectRevert(
      helper.cancelTrade(testTradeData.index, {from:accounts[0]}),
      "Can't cancel after bidding"
    );


  });


  it("getUserTradeListByIndex", async function () {

    const testTradeData = testData.getTradeData(0);
    const testTradeData2 = testData.getTradeData(10);
    const testTradeData3 = testData.getTradeData(11);
    const testTradeData4 = testData.getTradeData(12);
    await testData.setUpTrade(testTradeData, 0, true);
    await testData.setUpTrade(testTradeData2, 0, true);
    await testData.setUpTrade(testTradeData3, 0, true);
    await testData.setUpTrade(testTradeData4, 0, true);
    const index = 2;
    let userTradeList = await helper.getUserTradeListByIndex(index);
    assert.equal(userTradeList.length, 2)
    assert.equal(userTradeList[0].index, 2)
    assert.equal(userTradeList[1].index, 3)
    userTradeList = await helper.getUserTradeListByIndex(4);
    assert.equal(userTradeList.length, 0)
  });


  it("dispute", async function () {

    const blockTime = await time.latest();
    const testTradeData = testData.getTradeData(13, blockTime);
    await testData.setUpTrade(testTradeData, 0, true);
    await testToken.approve(helper.address, userDepositThreshold, {from:accounts[0]});
    let userBalance = await helper.getUserDepositBalance(accounts[0]);
    assert.equal(userBalance.toString(), 0)
    const initialBalance = await testToken.balanceOf(helper.address);

    await helper.dispute(0,{from:accounts[0]});
    let trade = await helper.getTrade(accounts[0], 0);
    const expectedData = testTradeData
    expectedData.status = "3"
    tradeAssert(expectedData, trade, false);
    assert.notEqual(trade.disputeTimestamp, trade.timestamp)

    const disputeList = await helper.getDisputeList({from:accounts[1]});
    assert.equal(disputeList[0].userAddress, accounts[0])

    let balance = await testToken.balanceOf(helper.address);
    assert.equal(balance.toString(), initialBalance.add(userDepositThreshold).toString())

    userBalance = await helper.getUserDepositBalance(accounts[0]);
    assert.equal(userBalance.toString(), userDepositThreshold.toString())




  });


  it("dispute invalid timestamp", async function () {

    const blockTime = await time.latest();
    const testTradeData = testData.getTradeData(14, blockTime);
    await testData.setUpTrade(testTradeData, 0, true);

    await time.increase(time.duration.hours(1));
    await testToken.approve(helper.address, userDepositThreshold, {from:accounts[0]});

    await expectRevert(
      helper.dispute(0,{from:accounts[0]}),
      "Disputes must run within one hour of withdrawal"
    );



  });



  it("dispute invalid status", async function () {
    const blockTime = await time.latest();
    const testTradeData = testData.getTradeData(15, blockTime);
    await testData.setUpTrade(testTradeData, 0, true);

    //NO Withdraw
    await testToken.approve(helper.address, userDepositThreshold, {from:accounts[0]});
    await expectRevert(
      helper.dispute(0,{from:accounts[0]}),
      "Can't dispute before withdraw"
    );



  });

  it("slash", async function () {

    const blockTime = await time.latest();
    const testTradeData = testData.getTradeData(16, blockTime);
    await testData.setUpTrade(testTradeData, 0, true);
    const testBondData = testData.getBondData(0);
    await testData.setUpBalance(testBondData.bond, 1)
    await testData.setUpBond(testBondData.bond, 1)
    await testData.setUpUserDeposit(userDepositThreshold, 0)

    await time.increase(time.duration.minutes(61));

    const initialUserBalance = await testToken.balanceOf(accounts[0]);
    await helper.slash(0,{from:accounts[0]});
    const trade = await helper.getTrade(accounts[0], 0);
    const expectedData = testTradeData
    expectedData.status = "4"
    tradeAssert(expectedData, trade, false);

    const userBalance = await helper.getUserDepositBalance(accounts[0]);
    assert.equal(userBalance.toString(), 0)
    const relayerBalance = await helper.getRelayerBondBalance(accounts[1]);
    assert.equal(relayerBalance.toString(), 0)
    const balance = await testToken.balanceOf(accounts[0]);
    assert.equal(balance.toString(), initialUserBalance.add(new BN(testBondData.bond)).add(new BN(userDepositThreshold)).toString())

  });


  it("slash invalid status", async function () {

    const blockTime = await time.latest();
    const testTradeData = testData.getTradeData(17, blockTime);
    await testData.setUpTrade(testTradeData, 0, true);
    const testBondData = testData.getBondData(0);
    await testData.setUpBalance(testBondData.bond, 1)
    await testData.setUpBond(testBondData.bond, 1)
    await testData.setUpUserDeposit(userDepositThreshold, 0)

    await time.increase(time.duration.minutes(61));

    await expectRevert(
      helper.slash(0,{from:accounts[0]}),
      "Slashes must run after dispute"
    );

  });

  it("slash invalid timestamp", async function () {

    const blockTime = await time.latest();
    const testTradeData = testData.getTradeData(18, blockTime);
    await testData.setUpTrade(testTradeData, 0, true);
    const testBondData = testData.getBondData(0);
    await testData.setUpBalance(testBondData.bond, 1)
    await testData.setUpBond(testBondData.bond, 1)
    await testData.setUpUserDeposit(userDepositThreshold, 0)

    await time.increase(time.duration.minutes(58));
    await expectRevert(
      helper.slash(0,{from:accounts[0]}),
      "A certain time must elapse after dispute"
    );

  });


  it("submitEvidence", async function () {
    const blockTime = await time.latest();
    const testTradeData = testData.getTradeData(19, blockTime);
    await testData.setUpTrade(testTradeData, 0, true);
    const testBondData = testData.getBondData(0);
    await testData.setUpBalance(testBondData.bond, 1)
    await testData.setUpBond(testBondData.bond, 1)
    await testData.setUpUserDeposit(userDepositThreshold, 0)
    const evidence = testData.getEvidenceData(1);
    await testData.setUpEvidence(testTradeData.user, testTradeData.index, evidence, 0)

    const relayerBalance = await testToken.balanceOf(accounts[1]);
    const submission = testData.getEvidenceData(2);
    await helper.submitEvidence(accounts[0], 0, submission, {from:accounts[1] });
    trade = await helper.getTrade(accounts[0], 0);
    const expectedData = testTradeData
    expectedData.status = "5"
    tradeAssert(expectedData, trade, false);

    balance = await testToken.balanceOf(accounts[1]);
    assert.equal(balance.toString(), relayerBalance.add(new BN(userDepositThreshold)).toString());
    userBalance = await helper.getUserDepositBalance(accounts[0]);
    assert.equal(userBalance.toString(), 0)


  });


  it("depositBond", async function () {

    const testBondData = testData.getBondData(1);
    await testToken.approve(helper.address, testBondData.bond, {from:accounts[0]});
    let initialBalance = await testToken.balanceOf(helper.address);
    let userBalance = await testToken.balanceOf(accounts[0]);
    let initialRelayerBalance = await helper.getRelayerBondBalance(accounts[0]);

    await helper.depositBond(testBondData.bond,{from:accounts[0]});
    let balance = await testToken.balanceOf(helper.address);
    assert.equal(balance.toString(), initialBalance.add(new BN(testBondData.bond)).toString())
    balance = await testToken.balanceOf(accounts[0]);
    assert.equal(balance.toString(), userBalance.sub(new BN(testBondData.bond)).toString())

    relayerBalance = await helper.getRelayerBondBalance(accounts[0]);
    assert.equal(relayerBalance.toString(), initialRelayerBalance.add(new BN(testBondData.bond)).toString())



  });

  it("withdrawBond", async function () {
    const testBondData = testData.getBondData(1);
    await testData.setUpBond(testBondData.bond, 0)
    await helper.withdrawBond({from:accounts[0]});
    let balance = await testToken.balanceOf(helper.address);
    assert.equal(balance.toString(), 0)
    let relayerBalance = await helper.getRelayerBondBalance(accounts[0]);
    assert.equal(relayerBalance.toString(), 0)
  });

  it("getTokenAddress", async function () {
    const l2Address =  await pheasantNetworkBridgeChild.getTokenAddress(0, true, {from:accounts[0]});
    assert.equal(l2Address, testToken.address)
  });

});

const tradeAssert = function(rawExpectedData, rawAcutualData, isTimeStampCheck) { 
  const expect = Object.fromEntries(
    Object.entries(rawExpectedData)
    .map(([ key, val ]) => [ key, String(val) ])
  );

  const acutual = Object.fromEntries(
    Object.entries(rawAcutualData)
    .map(([ key, val ]) => [ key, String(val) ])
  );

  assert.equal(expect.index, acutual.index);
  assert.equal(expect.user, acutual.user);
  assert.equal(expect.tokenTypeIndex, acutual.tokenTypeIndex);
  assert.equal(expect.amount, acutual.amount);
  assert.equal(expect.to, acutual.to);
  assert.equal(expect.relayer, acutual.relayer);
  assert.equal(expect.status, acutual.status);
  assert.equal(expect.fee, acutual.fee);
 
  if(isTimeStampCheck) {
    assert.equal(expect.timestamp, acutual.timestamp);
    assert.equal(expect.disputeTimestamp, acutual.disputeTimestamp);
  }
}


