const TestToken = artifacts.require("TestToken");
const TestCheckPointManager = artifacts.require("TestCheckPointManager");
const TestDisputeManager = artifacts.require("TestDisputeManager");
const PheasantNetworkBridgeChild = artifacts.require("PheasantNetworkBridgeChild");
const Helper = artifacts.require("Helper");
const RLPDecoder = artifacts.require("RLPDecoder");

//const mumbaiTokenAddress = "0xbb41BD3539D3aDcA6a184D8771aEf72D959912cf";
//const mumbaiRLPDecoderAddress = "0xad61C11dC1C4fB7358bd974037C8aA8b8021eA41";
//const polygonTokenAddress = "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619";
//const polygonRLPDecoderAddress = "0x73bD253d3F5b97F9B25423D47d015a17B2345580";
const BN = require('bn.js');
const userDepositThreshold = new BN("100000000000000000");
const utils = require('./utils')
//const mumbaiWeth = "0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa"
const disputeManagerContractPath = "../bridge-dispute-manager/";

module.exports = function(deployer, network, accounts) {

  let contractAddressObj = utils.getContractAddresses()
  let disputeManagerContractAddressObj = utils.getContractAddresses(disputeManagerContractPath)
  deployer.then(async() => {
    if (network == "development") {
      await deployer.deploy(RLPDecoder);
      await deployer.link(RLPDecoder, PheasantNetworkBridgeChild);
      await deployer.link(RLPDecoder, Helper);
      await deployer.deploy(TestToken, accounts[0]);
      await deployer.deploy(TestDisputeManager);

      const testToken = await TestToken.deployed();
      const testDisputeManager = await TestDisputeManager.deployed();
      const tokenAddressList = [
        testToken.address
      ]

      await deployer.deploy(PheasantNetworkBridgeChild, tokenAddressList, userDepositThreshold, testDisputeManager.address);
      //return await deployer.deploy(Helper, testToken.address, userDepositThreshold, pheasantNetworkDisputeManager.address);
      return await deployer.deploy(Helper, tokenAddressList, userDepositThreshold, testDisputeManager.address);

    } else if(network == "mumbai" || network == "polygon") {
      const tokenAddressList = [
        contractAddressObj[network].WETH
      ];
      await deployer.deploy(RLPDecoder);
      await deployer.link(RLPDecoder, PheasantNetworkBridgeChild);
      return await deployer.deploy(PheasantNetworkBridgeChild, tokenAddressList, userDepositThreshold, disputeManagerContractAddressObj[network].BridgeDisputeManager);

    }

    if(contractAddressObj[network] == undefined) {
      contractAddressObj[network] = {}
    }
    contractAddressObj[network].PheasantNetworkBridgeChild = PheasantNetworkBridgeChild.address;
    utils.writeContractAddresses(contractAddressObj)


  });
};
