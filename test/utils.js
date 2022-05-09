const testTrade = require('./data/trade.json');
const testEvidence = require('./data/evidence.json');
const testTransferTx = require('./data/checkTransferTx.json');

class TestData {
  constructor(_accounts) {
    this.accounts = _accounts;
  }

  getTradeData(index) {
    let data = testTrade[index];
    if(Number.isInteger(data.recipient)) {
      data.recipient = this.accounts[data.recipient]
    }
    return data;
  }

  getEvidenceData(index) {
    return testEvidence[index];
  }

  getTransferTxData(index) {
    return testTransferTx[index];
  }

}

module.exports = TestData;
