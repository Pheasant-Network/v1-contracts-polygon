const testTrade = require('./data/trade.json');
const testBond = require('./data/bond.json');
const testEvidence = require('./data/evidence.json');
const testTransferTx = require('./data/checkTransferTx.json');

class TestData {
  constructor(_accounts, _helper, _token) {
    this.accounts = _accounts;
    this.helper = _helper;
    this.token = _token;
  }

  getTradeData(index, time = null) {
    let data = testTrade[index];
    if(Number.isInteger(data.to)) {
      data.to = this.accounts[data.to].address
    }

    if(Number.isInteger(data.sender)) {
      data.sender = this.accounts[data.sender].address
    }

    if(Number.isInteger(data.user)) {
      data.user = this.accounts[data.user].address
    }

    if(Number.isInteger(data.relayer)) {
      data.relayer = this.accounts[data.relayer].address
    }

    if(time == null) {
      data.timestamp = Math.floor(Date.now() / 1000);
      data.disputeTimestamp = Math.floor(Date.now() / 1000);
    } else {
      data.timestamp = time;
      data.disputeTimestamp = time;
    }
    return data;
  }

  getEvidenceData(index) {
    return testEvidence[index];
  }

  getTransferTxData(index) {
    return testTransferTx[index];
  }

  getBondData(index) {
    return testBond[index];
  }

  async setUpTrade(testData, accountIndex, isDeposit = false){
    if(isDeposit) {
      await this.token.connect(this.accounts[accountIndex]).approve(this.helper.address, testData.amount);
    }

    await this.helper.connect(this.accounts[accountIndex]).setUpTrade(
      testData.sender,
      testData.index,
      testData.user,
      testData.tokenTypeIndex,
      testData.amount,
      testData.timestamp,
      testData.to,
      testData.relayer,
      testData.status,
      testData.fee,
      testData.disputeTimestamp,
      isDeposit
    );
  }


  async setUpEvidence(user, index, evidence, accountIndex){
    await this.helper.connect(this.accounts[accountIndex]).setUpEvidence(
      user,
      index,
      evidence
    );
  }

  async setUpBalance(amount, accountIndex){
    await this.token.connect(this.accounts[0]).transfer(this.accounts[accountIndex].address, amount);
  }



  async setUpBond(amount, accountIndex){
    await this.token.connect(this.accounts[accountIndex]).approve(this.helper.address, amount);
    await this.helper.connect(this.accounts[accountIndex]).depositBond(
      amount
    );
  }

  async setUpUserDeposit(amount, accountIndex){
    await this.token.connect(this.accounts[accountIndex]).approve(this.helper.address, amount);
    await this.helper.connect(this.accounts[accountIndex]).setUpUserDeposit(
      amount
    );
  }
}

const setUpMockDisputeManager = async function(mockDisputeManager, results) { 
  await mockDisputeManager.mock.verifyBlockHeader.returns(results[0]);
  await mockDisputeManager.mock.verifyProof.returns(results[1]);
  await mockDisputeManager.mock.verifyRawTx.returns(results[2]);
  await mockDisputeManager.mock.verifyTxSignature.returns(results[3]);
  await mockDisputeManager.mock.verifyBlockHash.returns(results[4]);
  return mockDisputeManager;
}

exports.setUpMockDisputeManager = setUpMockDisputeManager;
exports.TestData = TestData;
