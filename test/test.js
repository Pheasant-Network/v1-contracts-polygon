const { expect, assert } = require("chai");
const { ethers } = require("hardhat");
const BN = require('bn.js');
const userDepositThreshold = "30000000000000000000";
const { time, expectRevert } = require('@openzeppelin/test-helpers');
const utils = require('./utils.js');
const TestData = utils.TestData;
const setUpMockDisputeManager = utils.setUpMockDisputeManager;
const {deployMockContract} = require('@ethereum-waffle/mock-contract');
const TestDisputeManagerJSON = require('../artifacts/contracts/TestDisputeManager.sol/TestDisputeManager');

describe("PheasantNetworkBridgeChild", function () {

  let pheasantNetworkBridgeChild;
  let TestDisputeManager;
  let testDisputeManager;
  let mockDisputeManager;
  let TestToken;
  let testToken;
  let RLPDecoder;
  let rlpDecoder;
  let accounts;
  let txParams;
  let helper;
  let tokenAddressList;
  let testData;
  before(async () => {
    TestToken = await hre.ethers.getContractFactory("TestToken");
    RLPDecoder = await hre.ethers.getContractFactory("RLPDecoder");
    TestDisputeManager = await hre.ethers.getContractFactory("TestDisputeManager");
    rlpDecoder = await RLPDecoder.deploy();
    accounts =  await ethers.getSigners();
    mockDisputeManager = await deployMockContract(accounts[0], TestDisputeManagerJSON.abi);
    testDisputeManager = await TestDisputeManager.connect(accounts[0]).deploy();
  });

  beforeEach(async () => {
    testToken = await TestToken.connect(accounts[0]).deploy(accounts[0].address);
    tokenAddressList = [
      testToken.address
    ]

    const PheasantNetworkBridgeChild = await hre.ethers.getContractFactory("PheasantNetworkBridgeChild", {
      libraries: {
        RLPDecoder: rlpDecoder.address,
      },
    });

    pheasantNetworkBridgeChild = await PheasantNetworkBridgeChild.connect(accounts[0]).deploy(tokenAddressList, userDepositThreshold.toString(), mockDisputeManager.address, accounts[0].address);

    const Helper = await hre.ethers.getContractFactory("Helper", {
      libraries: {
        RLPDecoder: rlpDecoder.address,
      },
    });
    helper = await Helper.deploy(tokenAddressList, userDepositThreshold.toString(), mockDisputeManager.address, accounts[0].address);

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
    await testData.setUpEvidence(accounts[0].address, 0, evidence, 0);
    const setUpData = await helper.getEvidence(accounts[0].address, 0);
    assert.equal(evidence.blockNumber, setUpData.blockNumber);
    assert.equal(evidence.blockHash, setUpData.blockHash);
    assert.equal(evidence.transaction, setUpData.transaction);

    assert.deepEqual(evidence.txDataSpot, setUpData.txDataSpot);
    assert.deepEqual(evidence.path, setUpData.path);
    assert.equal(evidence.txReceipt, setUpData.txReceipt);
  });

  it("setUpBalance", async function () {
    const amount = 10000;
    const testBondData = testData.getBondData(0);

    await testData.setUpBalance(testBondData.bond, 2);
    const balance = await testToken.balanceOf(accounts[2].address);
    assert.equal(balance.toString(), String(testBondData.bond));
  });

  it("setUpBond", async function () {
    const testBondData = testData.getBondData(0);
    await testData.setUpBond(testBondData.bond, 0);
    const balance = await testToken.balanceOf(helper.address);
    assert.equal(balance.toString(), String(testBondData.bond));
    const bondBalance = await helper.getRelayerBondBalance(accounts[0].address);
    assert.equal(bondBalance.toString(), String(testBondData.bond));

  });

  it("setUpUserDeposit", async function () {
    const amount = 10000;
    await testData.setUpUserDeposit(amount, 0);
    const balance = await testToken.balanceOf(helper.address);
    assert.equal(balance.toString(), String(amount));
    const bondBalance = await helper.getUserDepositBalance(accounts[0].address);
    assert.equal(bondBalance.toString(), String(amount));
  });

  it("newTrade", async function () {

    const testTradeData = testData.getTradeData(0);
    await testToken.connect(accounts[0]).approve(pheasantNetworkBridgeChild.address, testTradeData.amount);
    await pheasantNetworkBridgeChild.connect(accounts[0]).newTrade(testTradeData.amount, testTradeData.to, testTradeData.fee, testTradeData.tokenTypeIndex);
    const trade = await pheasantNetworkBridgeChild.getTrade(accounts[0].address, 0);
    tradeAssert(testTradeData, trade, false);
  });


  it("newTrade invalid tokeyTypeIndex", async function () {

    const testTradeData = testData.getTradeData(4);
    await testToken.connect(accounts[0]).approve(pheasantNetworkBridgeChild.address, testTradeData.amount);
    await expect(
      pheasantNetworkBridgeChild.connect(accounts[0]).newTrade(testTradeData.amount, testTradeData.to, testTradeData.fee, testTradeData.tokenTypeIndex)
    ).to.be.revertedWith("Only ETH Support for now");


  });

  it("getTrade No Trade Error", async function () {
    await expect(
      pheasantNetworkBridgeChild.getTrade(accounts[0].address, 0)
    ).to.be.revertedWith("No Trade Exists");
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

    await helper.connect(accounts[0]).helperBid(accounts[0].address, 0);
    const trade = await helper.connect(accounts[0]).getTrade(accounts[0].address, 0);
    const expectedData = testTradeData
    expectedData.status = "1"
    expectedData.relayer = accounts[0].address
    tradeAssert(expectedData, trade, false);

  });

  it("bid Can't re-bid", async function () {
    const testTradeData = testData.getTradeData(5);
    await testData.setUpTrade(testTradeData, 0);
    await helper.connect(accounts[0]).helperBid(testTradeData.user, testTradeData.index);
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

    await helper.connect(accounts[0]).bulkBid(userTrades);
    let trade = await helper.getTrade(testTradeData.user, testTradeData.index);
    let expectedData = testTradeData
    expectedData.status = "1"
    expectedData.relayer = accounts[0].address
    tradeAssert(expectedData, trade, false);

    trade = await helper.getTrade(testTradeData2.user, testTradeData2.index);
    expectedData = testTradeData2
    expectedData.status = "1"
    expectedData.relayer = accounts[0].address
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

    await helper.connect(accounts[0]).bulkBid(userTrades);
    let trade = await helper.getTrade(testTradeData.user, testTradeData.index);
    let expectedData = testTradeData
    expectedData.status = "1"
    expectedData.relayer = accounts[0].address
    tradeAssert(expectedData, trade, false);

    trade = await helper.getTrade(testTradeData2.user, testTradeData2.index);
    expectedData = testTradeData2
    expectedData.status = "1"
    expectedData.relayer = accounts[1].address
    tradeAssert(expectedData, trade, false);

  });

  it("withdraw", async function () {

    const testTradeData = testData.getTradeData(2);
    await testData.setUpTrade(testTradeData, 0, true);
    const evidence = testData.getEvidenceData(0);
    mockDisputeManager = await setUpMockDisputeManager(mockDisputeManager, [true, true, true, true, true, true]);

    const InitialBalance = await testToken.balanceOf(accounts[0].address);
    await helper.connect(accounts[0]).helperWithdraw(testTradeData.user, testTradeData.index, evidence);
    const trade = await helper.getTrade(testTradeData.user, testTradeData.index);
    const expectedData = testTradeData
    expectedData.status = "2"
    tradeAssert(expectedData, trade, false);

    const balance = await testToken.balanceOf(accounts[0].address);
    assert.equal(balance.toString(), InitialBalance.add(testTradeData.amount).toString())


  });

  it("withdraw invalid transaction", async function () {

    const testTradeData = testData.getTradeData(3); 
    await testData.setUpTrade(testTradeData, 0, true);
    const evidence = testData.getEvidenceData(0);
    mockDisputeManager = await setUpMockDisputeManager(mockDisputeManager, [true, true, true, true, true, false]);

    const InitialBalance = await testToken.balanceOf(testTradeData.relayer);
    await helper.connect(accounts[0]).helperWithdraw(accounts[0].address, 0, evidence);
    const trade = await helper.getTrade(accounts[0].address, 0);
    const expectedData = testTradeData
    expectedData.status = "1"
    tradeAssert(expectedData, trade, false);
    const balance = await testToken.balanceOf(testTradeData.relayer);
    assert.equal(balance.toString(), InitialBalance.toString())

  });

  it("withdraw invalid status", async function () {

    const testTradeData = testData.getTradeData(7);
    await testData.setUpTrade(testTradeData, 0, true);
    mockDisputeManager = await setUpMockDisputeManager(mockDisputeManager, [true, true, true, true, true, true]);
    //NO BID
    const evidence = testData.getEvidenceData(0);
    await helper.connect(accounts[0]).helperWithdraw(accounts[0].address, 0, evidence);
    const trade = await helper.getTrade(accounts[0].address, 0);
    tradeAssert(testTradeData, trade, false);

    const balance = await testToken.balanceOf(accounts[2].address);
    assert.equal(balance.toString(), 0)

  });

  it("withdraw invalid relayer", async function () {

    const testTradeData = testData.getTradeData(21);
    await testData.setUpTrade(testTradeData, 0, true);
    const evidence = testData.getEvidenceData(0);
    mockDisputeManager = await setUpMockDisputeManager(mockDisputeManager, [true, true, true, true, true, true]);

    const InitialBalance = await testToken.balanceOf(accounts[0].address);
    await helper.connect(accounts[0]).helperWithdraw(accounts[0].address, 0, evidence); //invalid Relayer
    const trade = await helper.getTrade(accounts[0].address, 0);

    tradeAssert(testTradeData, trade, false);
    const balance = await testToken.balanceOf(accounts[0].address);
    assert.equal(balance.toString(), InitialBalance.toString())

  });


  it("bulkWithdraw", async function () {

    const testTradeData = testData.getTradeData(8);
    const testTradeData2 = testData.getTradeData(9);
    await testData.setUpTrade(testTradeData, 0, true);
    await testData.setUpTrade(testTradeData2, 0, true);
    mockDisputeManager = await setUpMockDisputeManager(mockDisputeManager, [true, true, true, true, true, true]);
    const userTrades = [
      {userAddress: testTradeData.user, index: testTradeData.index},
      {userAddress: testTradeData2.user, index: testTradeData2.index}
    ]

    const evidences = [
      testData.getEvidenceData(0),
      testData.getEvidenceData(0)
    ]

    await helper.connect(accounts[0]).bulkWithdraw(userTrades , evidences);
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
    mockDisputeManager = await setUpMockDisputeManager(mockDisputeManager, [true, true, true, true, true, true]);
    const userTrades = [
      {userAddress: testTradeData.user, index: testTradeData.index},
      {userAddress: testTradeData2.user, index: testTradeData2.index}
    ]

    const evidences = [
      testData.getEvidenceData(0),
      testData.getEvidenceData(0)
    ]

    await helper.connect(accounts[0]).bulkWithdraw(userTrades , evidences);
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

    await helper.connect(accounts[0]).cancelTrade(0);
    let trade = await helper.getTrade(accounts[0].address, 0);
    const expectedData = testTradeData
    expectedData.status = "99"
    tradeAssert(expectedData, trade, false);

    let afterBalance = await testToken.balanceOf(testTradeData.user);
    assert.equal(initialBalance.toString(), afterBalance.toString())

  });

  it("cancelTrade can't cancel after bidding", async function () {

    const testTradeData = testData.getTradeData(2);
    await testData.setUpTrade(testTradeData, 0, true);
    await expect(
      helper.connect(accounts[0]).cancelTrade(testTradeData.index),
    ).to.be.revertedWith("Can't cancel after bidding");

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

    const lastestBlock = await network.provider.send('eth_getBlockByNumber', ['latest', false]);
    const testTradeData = testData.getTradeData(13, lastestBlock.timestamp);

    await testData.setUpTrade(testTradeData, 0, true);

    await testToken.connect(accounts[0]).approve(helper.address, userDepositThreshold);
    let userBalance = await helper.getUserDepositBalance(accounts[0].address);
    assert.equal(userBalance.toString(), 0)
    const initialBalance = await testToken.balanceOf(helper.address);

    await hre.ethers.provider.send("evm_increaseTime", [3580]) //around 1 hour later.
    await hre.ethers.provider.send("evm_mine")

    await helper.connect(accounts[0]).dispute(0);
    let trade = await helper.getTrade(accounts[0].address, 0);
    const expectedData = testTradeData
    expectedData.status = "3"
    tradeAssert(expectedData, trade, false);
    assert.notEqual(trade.disputeTimestamp, trade.timestamp)

    const disputeList = await helper.connect(accounts[1]).getDisputeList();
    assert.equal(disputeList[0].userAddress, accounts[0].address)

    let balance = await testToken.balanceOf(helper.address);
    assert.equal(balance.toString(), initialBalance.add(userDepositThreshold).toString())

    userBalance = await helper.getUserDepositBalance(accounts[0].address);
    assert.equal(userBalance.toString(), userDepositThreshold.toString())




  });


  it("dispute invalid timestamp", async function () {

    const lastestBlock = await network.provider.send('eth_getBlockByNumber', ['latest', false]);
    const testTradeData = testData.getTradeData(14, lastestBlock.timestamp);
    await testData.setUpTrade(testTradeData, 0, true);
    await hre.ethers.provider.send("evm_increaseTime", [3600])
    await hre.ethers.provider.send("evm_mine")

    await testToken.connect(accounts[0]).approve(helper.address, userDepositThreshold);

    await expect(
      helper.connect(accounts[0]).dispute(0),
    ).to.be.revertedWith("Disputes must run within one hour of withdrawal");




  });



  it("dispute invalid status", async function () {
    const lastestBlock = await network.provider.send('eth_getBlockByNumber', ['latest', false]);
    const testTradeData = testData.getTradeData(15, lastestBlock.timestamp);
    await testData.setUpTrade(testTradeData, 0, true);

    //NO Withdraw
    await testToken.connect(accounts[0]).approve(helper.address, userDepositThreshold);
    await expect(
      helper.connect(accounts[0]).dispute(0),
    ).to.be.revertedWith("Can't dispute before withdraw");


  });


  it("slash", async function () {

    const lastestBlock = await network.provider.send('eth_getBlockByNumber', ['latest', false]);
    const testTradeData = testData.getTradeData(16, lastestBlock.timestamp);
    await testData.setUpTrade(testTradeData, 0, true);
    const testBondData = testData.getBondData(0);
    await testData.setUpBalance(testBondData.bond, 1)
    await testData.setUpBond(testBondData.bond, 1)
    await testData.setUpUserDeposit(userDepositThreshold, 0)

    await hre.ethers.provider.send("evm_increaseTime", [3660])
    await hre.ethers.provider.send("evm_mine")


    const initialUserBalance = await testToken.balanceOf(accounts[0].address);
    await helper.connect(accounts[0]).slash(0);
    const trade = await helper.getTrade(accounts[0].address, 0);
    const expectedData = testTradeData
    expectedData.status = "4"
    tradeAssert(expectedData, trade, false);

    const userBalance = await helper.getUserDepositBalance(accounts[0].address);
    assert.equal(userBalance.toString(), 0)
    const relayerBalance = await helper.getRelayerBondBalance(accounts[1].address);
    assert.equal(relayerBalance.toString(), 0)
    const balance = await testToken.balanceOf(accounts[0].address);
    assert.equal(balance.toString(), initialUserBalance.add(testBondData.bond).add(userDepositThreshold).toString())

  });


  it("slash invalid status", async function () {

    const lastestBlock = await network.provider.send('eth_getBlockByNumber', ['latest', false]);
    const testTradeData = testData.getTradeData(17, lastestBlock.timestamp);
    await testData.setUpTrade(testTradeData, 0, true);
    const testBondData = testData.getBondData(0);
    await testData.setUpBalance(testBondData.bond, 1)
    await testData.setUpBond(testBondData.bond, 1)
    await testData.setUpUserDeposit(userDepositThreshold, 0)

    await hre.ethers.provider.send("evm_increaseTime", [3660])
    await hre.ethers.provider.send("evm_mine")

    await expect(
      helper.connect(accounts[0]).slash(0),
    ).to.be.revertedWith("Slashes must run after dispute");


  });

  it("slash invalid timestamp", async function () {

    const lastestBlock = await network.provider.send('eth_getBlockByNumber', ['latest', false]);
    const testTradeData = testData.getTradeData(18, lastestBlock.timestamp);
    await testData.setUpTrade(testTradeData, 0, true);
    const testBondData = testData.getBondData(0);
    await testData.setUpBalance(testBondData.bond, 1)
    await testData.setUpBond(testBondData.bond, 1)
    await testData.setUpUserDeposit(userDepositThreshold, 0)

    await hre.ethers.provider.send("evm_increaseTime", [3480])
    await hre.ethers.provider.send("evm_mine")

    await expect(
      helper.connect(accounts[0]).slash(0),
    ).to.be.revertedWith("A certain time must elapse after dispute");


  });


  it("submitEvidence", async function () {
    const lastestBlock = await network.provider.send('eth_getBlockByNumber', ['latest', false]);
    const testTradeData = testData.getTradeData(19, lastestBlock.timestamp);
    mockDisputeManager = await setUpMockDisputeManager(mockDisputeManager, [true, true, true, true, true, true]);
    await testData.setUpTrade(testTradeData, 0, true);
    const testBondData = testData.getBondData(0);
    await testData.setUpBalance(testBondData.bond, 1)
    await testData.setUpBond(testBondData.bond, 1)
    await testData.setUpUserDeposit(userDepositThreshold, 0)
    const evidence = testData.getEvidenceData(1);
    await testData.setUpEvidence(testTradeData.user, testTradeData.index, evidence, 0)

    const relayerBalance = await testToken.balanceOf(accounts[1].address);
    const submission = testData.getEvidenceData(2);
    await helper.connect(accounts[1]).submitEvidence(accounts[0].address, 0, submission);
    trade = await helper.getTrade(accounts[0].address, 0);
    const expectedData = testTradeData
    expectedData.status = "5"
    tradeAssert(expectedData, trade, false);

    balance = await testToken.balanceOf(accounts[1].address);
    assert.equal(balance.toString(), relayerBalance.add(userDepositThreshold).toString());
    userBalance = await helper.getUserDepositBalance(accounts[0].address);
    assert.equal(userBalance.toString(), 0)
  });

  it("submitEvidence Invalid status", async function () {
    const lastestBlock = await network.provider.send('eth_getBlockByNumber', ['latest', false]);
    const testTradeData = testData.getTradeData(23, lastestBlock.timestamp);
    mockDisputeManager = await setUpMockDisputeManager(mockDisputeManager, [true, true, true, true, true, true]);
    await testData.setUpTrade(testTradeData, 0, true);
    const relayerBalance = await testToken.balanceOf(accounts[1].address);
    const submission = testData.getEvidenceData(2);
    await expect(
      helper.connect(accounts[1]).submitEvidence(accounts[0].address, 0, submission),
    ).to.be.revertedWith("Invalid Status");

  });

  it("depositBond", async function () {

    const testBondData = testData.getBondData(1);
    await testToken.connect(accounts[0]).approve(helper.address, testBondData.bond);
    let initialBalance = await testToken.balanceOf(helper.address);
    let userBalance = await testToken.balanceOf(accounts[0].address);
    let initialRelayerBalance = await helper.getRelayerBondBalance(accounts[0].address);

    await helper.connect(accounts[0]).depositBond(testBondData.bond);
    let balance = await testToken.balanceOf(helper.address);
    assert.equal(balance.toString(), initialBalance.add(testBondData.bond).toString())
    balance = await testToken.balanceOf(accounts[0].address);
    assert.equal(balance.toString(), userBalance.sub(testBondData.bond).toString())

    relayerBalance = await helper.getRelayerBondBalance(accounts[0].address);
    assert.equal(relayerBalance.toString(), initialRelayerBalance.add(testBondData.bond).toString())



  });

  it("withdrawBond", async function () {
    const testBondData = testData.getBondData(1);
    await testData.setUpBond(testBondData.bond, 0)
    await helper.connect(accounts[0]).withdrawBond();
    let balance = await testToken.balanceOf(helper.address);
    assert.equal(balance.toString(), 0)
    let relayerBalance = await helper.getRelayerBondBalance(accounts[0].address);
    assert.equal(relayerBalance.toString(), 0)
  });



  it("getTokenAddress", async function () {
    const l2Address =  await pheasantNetworkBridgeChild.connect(accounts[0]).getTokenAddress(0, true);
    assert.equal(l2Address, testToken.address)
  });


  it("depositAsset", async function () {

    const testAssetData = testData.getAssetData(1);
    await testToken.connect(accounts[0]).approve(helper.address, testAssetData.asset);
    let initialBalance = await testToken.balanceOf(helper.address);
    let userBalance = await testToken.balanceOf(accounts[0].address);
    let initialRelayerBalance = await helper.getRelayerAssetBalance(accounts[0].address);

    await helper.connect(accounts[0]).depositAsset(testAssetData.asset);
    let balance = await testToken.balanceOf(helper.address);
    assert.equal(balance.toString(), initialBalance.add(testAssetData.asset).toString())
    balance = await testToken.balanceOf(accounts[0].address);
    assert.equal(balance.toString(), userBalance.sub(testAssetData.asset).toString())

    relayerBalance = await helper.getRelayerAssetBalance(accounts[0].address);
    assert.equal(relayerBalance.toString(), initialRelayerBalance.add(testAssetData.asset).toString())

  });

  it("withdrawAsset", async function () {
    const testAssetData = testData.getAssetData(1);
    await testData.setUpAsset(testAssetData.asset, 0)
    await helper.connect(accounts[0]).withdrawAsset();
    let balance = await testToken.balanceOf(helper.address);
    assert.equal(balance.toString(), 0)
    let relayerBalance = await helper.getRelayerAssetBalance(accounts[0].address);
    assert.equal(relayerBalance.toString(), 0)
  });


  it("createUpwardTrade", async function () {
    const testTradeData = testData.getTradeData(24);
    const evidence = testData.getEvidenceData(3);
    mockDisputeManager = await setUpMockDisputeManager(mockDisputeManager, [true, true, true, true, true, true]);

    await testToken.connect(accounts[0]).approve(helper.address, testTradeData.amount);
    await helper.connect(accounts[0]).createUpwardTrade(testTradeData.amount, testTradeData.to, testTradeData.fee, testTradeData.tokenTypeIndex, evidence);

    const trade = await helper.getTrade(accounts[0].address, 0);
    const hashedEvidence = await helper.getHashedEvidence(accounts[0].address, 0);
    const expectHashedEvidence = await helper.helperHashEvidence(evidence);
    assert.equal(hashedEvidence, expectHashedEvidence)
    tradeAssert(testTradeData, trade, false);
  });

  it("accept", async function () {
    const testTradeData = testData.getTradeData(24);
    await testData.setUpTrade(testTradeData, 0, false, true);
    const testAssetData = testData.getAssetData(2);
    await testData.setUpAsset(testAssetData.asset, 0)
    const evidence = testData.getEvidenceData(3);
    await testData.setUpHashedEvidence(accounts[0].address, 0, evidence, 0)
    let initialRelayerBalance = await helper.getRelayerAssetBalance(accounts[0].address);

    await helper.connect(accounts[0]).accept(testTradeData.user, testTradeData.index);
    const trade = await helper.getTrade(accounts[0].address, 0);
    const expectedData = testTradeData
    expectedData.status = "2"
    let relayerBalance = await helper.getRelayerAssetBalance(accounts[0].address);
    tradeAssert(expectedData, trade, false);
    assert.equal(relayerBalance.toString(), initialRelayerBalance.sub(testTradeData.amount - testTradeData.fee).toString())
  });

  /*it("newDispute", async function () {
    const testTradeData = testData.getTradeData(26);
    await testData.setUpTrade(testTradeData, 0, false, true);
    const testAssetData = testData.getAssetData(2);
    await testData.setUpAsset(testAssetData.asset, 0)
    const evidence = testData.getEvidenceData(3);
    await testData.setUpHashedEvidence(accounts[0].address, 0, evidence, 0)
    await helper.connect(accounts[0]).newDispute(testTradeData.user, testTradeData.index);
    const trade = await helper.getTrade(accounts[0].address, 0);
    const expectedData = testTradeData
    expectedData.status = "3"
    tradeAssert(expectedData, trade, false);
    assert.notEqual(trade.disputeTimestamp, trade.timestamp)
  });*/




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


