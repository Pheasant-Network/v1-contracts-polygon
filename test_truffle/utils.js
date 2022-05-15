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
      data.to = this.accounts[data.to]
    }

    if(Number.isInteger(data.sender)) {
      data.sender = this.accounts[data.sender]
    }

    if(Number.isInteger(data.user)) {
      data.user = this.accounts[data.user]
    }

    if(Number.isInteger(data.relayer)) {
      data.relayer = this.accounts[data.relayer]
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
      await this.token.approve(this.helper.address, testData.amount, {from: this.accounts[accountIndex]});
    }

    await this.helper.setUpTrade(
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
      isDeposit,
      {from: this.accounts[accountIndex]}
    );
  }


  async setUpEvidence(user, index, evidence, accountIndex){
    await this.helper.setUpEvidence(
      user,
      index,
      evidence,
      {from: this.accounts[accountIndex]}
    );
  }

  async setUpBalance(amount, accountIndex){
    await this.token.transfer(this.accounts[accountIndex], amount, {from:this.accounts[0]});
  }



  async setUpBond(amount, accountIndex){
    await this.token.approve(this.helper.address, amount, {from: this.accounts[accountIndex]});
    await this.helper.depositBond(
      amount,
      {from: this.accounts[accountIndex]}
    );
  }

  async setUpUserDeposit(amount, accountIndex){
    await this.token.approve(this.helper.address, amount, {from: this.accounts[accountIndex]});
    await this.helper.setUpUserDeposit(
      amount,
      {from: this.accounts[accountIndex]}
    );
  }


}

module.exports = TestData;
