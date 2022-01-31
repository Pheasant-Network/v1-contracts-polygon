const PheasantNetworkBridgeChild = artifacts.require("PheasantNetworkBridgeChild");
const Helper = artifacts.require("Helper");
const TestToken = artifacts.require("TestToken");
const TestCheckPointManager = artifacts.require("TestCheckPointManager");
const BN = require('bn.js');

/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */

contract("PheasantNetworkBridgeChild", function (/* accounts */) {

  let pheasantNetworkBridgeChild;
  let testToken;
  let accounts;
  let txParams;
  let helper;
  before(async () => {
    accounts = await web3.eth.getAccounts();
    txParams = { from: accounts[0] };
    testToken = await TestToken.new(accounts[0], txParams);
  });

  beforeEach(async () => {
    pheasantNetworkBridgeChild = await PheasantNetworkBridgeChild.new(testToken.address, txParams);
    helper = await Helper.new(testToken.address, txParams);
  });

  it("test", async function () {
    let user = accounts[0];
    let amount = 10000;
    let fee = 100;
    await testToken.approve(helper.address, amount, {from:accounts[0]});
    await helper.newTrade(amount, user, fee, 0, 1, {from:accounts[0]});

  });

  it("newTrade", async function () {

    let user = accounts[0];
    let amount = 10000;
    let fee = 100;
    await testToken.approve(pheasantNetworkBridgeChild.address, amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(amount, user, fee, 0, 1, {from:accounts[0]});

    const trade = await pheasantNetworkBridgeChild.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.nativeFlg, 1)
    assert.equal(trade.user, user)
    assert.equal(trade.tokenL1, "0x0000000000000000000000000000000000000000")
    assert.equal(trade.tokenL2, testToken.address)
    assert.equal(trade.tokenL2, testToken.address)
    assert.equal(trade.amount, amount)
    assert.equal(trade.fee, fee)
    assert.equal(trade.to, user)
    assert.equal(trade.changer, "0x0000000000000000000000000000000000000000")
    assert.equal(trade.status, "0")

    await testToken.approve(pheasantNetworkBridgeChild.address, amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(amount, user, fee, 0, 1, {from:accounts[0]});
    const trade2 = await pheasantNetworkBridgeChild.getTrade(accounts[0], 1);
    assert.equal(trade2.index, 1)
  });


  it("getTrades", async function () {

    let user = accounts[0];
    let amount = 10000;
    let fee = 100;
    await testToken.approve(pheasantNetworkBridgeChild.address, amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(amount, user, fee, 0, 1, {from:accounts[0]});

    await testToken.approve(pheasantNetworkBridgeChild.address, amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(amount, user, fee, 0, 1, {from:accounts[0]});
    const userTrades = [
      {userAddress: accounts[0], index: 0},
      {userAddress: accounts[0], index: 1}
    ]

    const trades = await pheasantNetworkBridgeChild.getTrades(userTrades);
    assert.equal(trades[0].index, 0)
    assert.equal(trades[0].nativeFlg, 1)
    assert.equal(trades[0].user, user)
    assert.equal(trades[0].tokenL1, "0x0000000000000000000000000000000000000000")
    assert.equal(trades[0].tokenL2, testToken.address)
    assert.equal(trades[0].tokenL2, testToken.address)
    assert.equal(trades[0].amount, amount)
    assert.equal(trades[0].fee, fee)
    assert.equal(trades[0].to, user)
    assert.equal(trades[0].changer, "0x0000000000000000000000000000000000000000")
    assert.equal(trades[0].status, "0")


    assert.equal(trades[1].index, 1)
    //assert.equal(trade2.index, 1)
  });

  it("isTradeExist", async function () {

    let user = accounts[0];
    let amount = 10000;
    let fee = 100;
    let isTradeExist = await helper.helperIsTradeExist(user, 0);
    assert.equal(isTradeExist, false)
    await testToken.approve(helper.address, amount, {from:accounts[0]});
    await helper.newTrade(amount, user, fee, 0, 1, {from:accounts[0]});

    isTradeExist = await helper.helperIsTradeExist(user, 0);
    assert.equal(isTradeExist, true)
  });

  it("bid", async function () {

    let user = accounts[0];
    let amount = 10000;
    let fee = 100;
    await testToken.approve(helper.address, amount, {from:accounts[0]});
    await helper.newTrade(amount, user, fee, 0, 1, {from:accounts[0]});
    let trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.changer, "0x0000000000000000000000000000000000000000")
    assert.equal(trade.status, "0")

    await helper.helperBid(user, 0, {from:accounts[0]});
    trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.changer, accounts[0])
    assert.equal(trade.status, "1")

    await helper.helperBid(user, 0, {from:accounts[1]});
    trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.changer, accounts[0])

  });

  it("bulkBid", async function () {

    let user = accounts[0];
    let amount = 10000;
    let fee = 100;
    await testToken.approve(pheasantNetworkBridgeChild.address, amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(amount, user, fee, 0, 1, {from:accounts[0]});
    let trade = await pheasantNetworkBridgeChild.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.changer, "0x0000000000000000000000000000000000000000")
    assert.equal(trade.status, "0")


    await testToken.approve(pheasantNetworkBridgeChild.address, amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(amount, user, fee, 0, 1, {from:accounts[0]});
    trade = await pheasantNetworkBridgeChild.getTrade(accounts[0], 1);
    assert.equal(trade.index, 1)
    assert.equal(trade.changer, "0x0000000000000000000000000000000000000000")
    assert.equal(trade.status, "0")

    const userTrades = [
      {userAddress: accounts[0], index: 0},
      {userAddress: accounts[0], index: 1}
    ]

    await pheasantNetworkBridgeChild.bulkBid(userTrades , {from:accounts[0]});
    trade = await pheasantNetworkBridgeChild.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.changer, accounts[0])
    assert.equal(trade.status, "1")

    trade = await pheasantNetworkBridgeChild.getTrade(accounts[0], 1);
    assert.equal(trade.index, 1)
    assert.equal(trade.changer, accounts[0])
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

    await helper.newTrade(amount, user, fee, 0, 1, {from:accounts[0]});
    await helper.helperBid(user, 0, {from:accounts[1]});
    let trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.changer, accounts[1])
    assert.equal(trade.status, "1")

    const evidence = {
      blockNumber: '0x5ed90c',
      blockHash: '0xd792952703adf456f92a4298f396da0fc5f771afd2082b46c9c5b2118e10db1c',
      txReceiptProof: [],
      txProof: [],
      transaction: '0x02f872058202548459682f008459682f0982520894b0e426b1a0b8ba474dc5c8f6493b3e63d7121626865af3107a400080c080a034eec646e80e1e7e7fc3363502a7aab747516d4670383aa2c9bab8a37dd41522a074df6c8ef2e0f0f7969b5a7b3769fda73ae6ad6a385fed881203434c2a276382',
      txDataSpot: [ 0, 0 ],
      path: [ 1, 11 ],
      txReceipt: '0x'
    }

    await helper.helperWithdraw(user, 0, evidence,{from:accounts[1]});
    trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.changer, accounts[1])
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

    await helper.newTrade(amount, user, fee, 0, 1, {from:accounts[0]});
    await helper.helperBid(user, 0, {from:accounts[2]});
    let trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.changer, accounts[2])
    assert.equal(trade.status, "1")

    const evidence = {
      blockNumber: '0x5ed90c',
      blockHash: '0xd792952703adf456f92a4298f396da0fc5f771afd2082b46c9c5b2118e10db1c',
      txReceiptProof: [],
      txProof: [],
      transaction: '0x02f872058202548459682f008459682f0982520894b0e426b1a0b8ba474dc5c8f6493b3e63d7121626865af3107a400080c080a034eec646e80e1e7e7fc3363502a7aab747516d4670383aa2c9bab8a37dd41522a074df6c8ef2e0f0f7969b5a7b3769fda73ae6ad6a385fed881203434c2a276382',
      txDataSpot: [ 0, 0 ],
      path: [ 1, 11 ],
      txReceipt: '0x'
    }

    await helper.helperWithdraw(user, 0, evidence,{from:accounts[2]});
    trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.changer, accounts[2])
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

    await helper.newTrade(amount, user, fee, 0, 1, {from:accounts[0]});
    /*await helper.helperBid(user, 0, {from:accounts[2]});
    let trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.changer, accounts[2])
    assert.equal(trade.status, "1")*/

    const evidence = {
      blockNumber: '0x5ed90c',
      blockHash: '0xd792952703adf456f92a4298f396da0fc5f771afd2082b46c9c5b2118e10db1c',
      txReceiptProof: [],
      txProof: [],
      transaction: '0x02f872058202548459682f008459682f0982520894b0e426b1a0b8ba474dc5c8f6493b3e63d7121626865af3107a400080c080a034eec646e80e1e7e7fc3363502a7aab747516d4670383aa2c9bab8a37dd41522a074df6c8ef2e0f0f7969b5a7b3769fda73ae6ad6a385fed881203434c2a276382',
      txDataSpot: [ 0, 0 ],
      path: [ 1, 11 ],
      txReceipt: '0x'
    }

    await helper.helperWithdraw(user, 0, evidence,{from:accounts[2]});
    trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.changer, "0x0000000000000000000000000000000000000000")
    assert.equal(trade.status, "0") // skip

    balance = await testToken.balanceOf(accounts[2]);
    assert.equal(balance.toNumber(), 0)

  });

  it("withdraw invalid changer", async function () {

    let user = accounts[0];
    let amount = 100000010000000;
    let fee = 10000000; 
    await testToken.approve(helper.address, amount, {from:accounts[0]});
    let balance = await testToken.balanceOf(accounts[2]);
    assert.equal(balance.toNumber(), 0)

    await helper.newTrade(amount, user, fee, 0, 1, {from:accounts[0]});
    await helper.helperBid(user, 0, {from:accounts[2]});
    let trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.changer, accounts[2])
    assert.equal(trade.status, "1")

    const evidence = {
      blockNumber: '0x5ed90c',
      blockHash: '0xd792952703adf456f92a4298f396da0fc5f771afd2082b46c9c5b2118e10db1c',
      txReceiptProof: [],
      txProof: [],
      transaction: '0x02f872058202548459682f008459682f0982520894b0e426b1a0b8ba474dc5c8f6493b3e63d7121626865af3107a400080c080a034eec646e80e1e7e7fc3363502a7aab747516d4670383aa2c9bab8a37dd41522a074df6c8ef2e0f0f7969b5a7b3769fda73ae6ad6a385fed881203434c2a276382',
      txDataSpot: [ 0, 0 ],
      path: [ 1, 11 ],
      txReceipt: '0x'
    }

    await helper.helperWithdraw(user, 0, evidence,{from:accounts[3]});
    trade = await helper.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.changer, accounts[2])
    assert.equal(trade.status, "1") // skip

    balance = await testToken.balanceOf(accounts[3]);
    assert.equal(balance.toNumber(), 0)

  });

  it("bulkWithdraw", async function () {

    let user = accounts[0];
    let amount = 100000010000000;
    let fee = 10000000; 

    await testToken.approve(pheasantNetworkBridgeChild.address, amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(amount, user, fee, 0, 1, {from:accounts[0]});
    let trade = await pheasantNetworkBridgeChild.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.changer, "0x0000000000000000000000000000000000000000")
    assert.equal(trade.status, "0")


    await testToken.approve(pheasantNetworkBridgeChild.address, amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(amount, user, fee, 0, 1, {from:accounts[0]});
    trade = await pheasantNetworkBridgeChild.getTrade(accounts[0], 1);
    assert.equal(trade.index, 1)
    assert.equal(trade.changer, "0x0000000000000000000000000000000000000000")
    assert.equal(trade.status, "0")

    const userTrades = [
      {userAddress: accounts[0], index: 0},
      {userAddress: accounts[0], index: 1}
    ]

    await pheasantNetworkBridgeChild.bulkBid(userTrades , {from:accounts[0]});
    trade = await pheasantNetworkBridgeChild.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.changer, accounts[0])
    assert.equal(trade.status, "1")

    trade = await pheasantNetworkBridgeChild.getTrade(accounts[0], 1);
    assert.equal(trade.index, 1)
    assert.equal(trade.changer, accounts[0])
    assert.equal(trade.status, "1")

    const evidence = {
      blockNumber: '0x5ed90c',
      blockHash: '0xd792952703adf456f92a4298f396da0fc5f771afd2082b46c9c5b2118e10db1c',
      txReceiptProof: [],
      txProof: [],
      transaction: '0x02f872058202548459682f008459682f0982520894b0e426b1a0b8ba474dc5c8f6493b3e63d7121626865af3107a400080c080a034eec646e80e1e7e7fc3363502a7aab747516d4670383aa2c9bab8a37dd41522a074df6c8ef2e0f0f7969b5a7b3769fda73ae6ad6a385fed881203434c2a276382',
      txDataSpot: [ 0, 0 ],
      path: [ 1, 11 ],
      txReceipt: '0x'
    }


    const evidences = [
      evidence,
      evidence
    ]


    await pheasantNetworkBridgeChild.bulkWithdraw(userTrades , evidences, {from:accounts[0]});
    trade = await pheasantNetworkBridgeChild.getTrade(accounts[0], 0);
    assert.equal(trade.index, 0)
    assert.equal(trade.changer, accounts[0])
    assert.equal(trade.status, "2")

    trade = await pheasantNetworkBridgeChild.getTrade(accounts[0], 1);
    assert.equal(trade.index, 1)
    assert.equal(trade.changer, accounts[0])
    assert.equal(trade.status, "2")


  });

  it("cancelTrade", async function () {

    let user = accounts[0];
    let amount = 100000010000000;
    let fee = 10000000; 
    let initialBalance = await testToken.balanceOf(accounts[0]);

    await testToken.approve(pheasantNetworkBridgeChild.address, amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(amount, user, fee, 0, 1, {from:accounts[0]});
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
    await pheasantNetworkBridgeChild.newTrade(amount, user, fee, 0, 1, {from:accounts[0]});

    await testToken.approve(pheasantNetworkBridgeChild.address, amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(amount, user, fee, 0, 1, {from:accounts[0]});

    await testToken.approve(pheasantNetworkBridgeChild.address, amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(amount, user, fee, 0, 1, {from:accounts[0]});

    await testToken.approve(pheasantNetworkBridgeChild.address, amount, {from:accounts[0]});
    await pheasantNetworkBridgeChild.newTrade(amount, user, fee, 0, 1, {from:accounts[0]});

    const index = 2;
    let userTradeList = await pheasantNetworkBridgeChild.getUserTradeListByIndex(index);
    assert.equal(userTradeList.length, 2)
    assert.equal(userTradeList[0].index, 2)
    assert.equal(userTradeList[1].index, 3)
    userTradeList = await pheasantNetworkBridgeChild.getUserTradeListByIndex(4);
    assert.equal(userTradeList.length, 0)
  });



});
