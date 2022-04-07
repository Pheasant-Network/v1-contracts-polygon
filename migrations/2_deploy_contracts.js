const TestToken = artifacts.require("TestToken");
const TestCheckPointManager = artifacts.require("TestCheckPointManager");
const PheasantNetworkBridgeChild = artifacts.require("PheasantNetworkBridgeChild");
const PheasantNetworkDisputeManager = artifacts.require("PheasantNetworkDisputeManager");
const Helper = artifacts.require("Helper");
const DisputeHelper = artifacts.require("DisputeHelper");
const RLPDecoder = artifacts.require("RLPDecoder");

const mumbaiTokenAddress = "0xbb41BD3539D3aDcA6a184D8771aEf72D959912cf";
//const mumbaiRLPDecoderAddress = "0xad61C11dC1C4fB7358bd974037C8aA8b8021eA41";
const polygonTokenAddress = "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619";
//const polygonRLPDecoderAddress = "0x73bD253d3F5b97F9B25423D47d015a17B2345580";
const BN = require('bn.js');
const userDepositThreshold = new BN("100000000000000000");
const utils = require('./utils')
const mumbaiWeth = "0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa"

module.exports = function(deployer, network, accounts) {

  let contractAddressObj = utils.getContractAddresses()

  deployer.then(async() => {
    if (network == "development") {
      await deployer.deploy(RLPDecoder);
      await deployer.link(RLPDecoder, PheasantNetworkBridgeChild);
      await deployer.link(RLPDecoder, PheasantNetworkDisputeManager);
      await deployer.link(RLPDecoder, DisputeHelper);
      await deployer.link(RLPDecoder, Helper);
      await deployer.deploy(TestToken, accounts[0]);

      await deployer.deploy(TestCheckPointManager);
      const testCheckPointManager = await TestCheckPointManager.deployed();
      await deployer.deploy(PheasantNetworkDisputeManager, testCheckPointManager.address);
      const pheasantNetworkDisputeManager = await PheasantNetworkDisputeManager.deployed();
      await deployer.deploy(DisputeHelper, testCheckPointManager.address);
      const testToken = await TestToken.deployed();
      const tokenAddressList = [
        testToken.address
      ]

      await deployer.deploy(PheasantNetworkBridgeChild, tokenAddressList, userDepositThreshold, pheasantNetworkDisputeManager.address);
      //return await deployer.deploy(Helper, testToken.address, userDepositThreshold, pheasantNetworkDisputeManager.address);
      return await deployer.deploy(Helper, tokenAddressList, userDepositThreshold, pheasantNetworkDisputeManager.address);

    } else if(network == "mumbai") {
      const tokenAddressList = [
        contractAddressObj[network].WETH
      ];
      await deployer.deploy(RLPDecoder);
      await deployer.link(RLPDecoder, PheasantNetworkBridgeChild);
      await deployer.link(RLPDecoder, PheasantNetworkDisputeManager);
      await deployer.deploy(PheasantNetworkDisputeManager, contractAddressObj[network].PolygonChildCheckPointManager);
      const pheasantNetworkDisputeManager = await PheasantNetworkDisputeManager.deployed();
      //return await deployer.deploy(PheasantNetworkBridgeChild, mumbaiTokenAddress, userDepositThreshold, pheasantNetworkDisputeManager.address);
      return await deployer.deploy(PheasantNetworkBridgeChild, tokenAddressList, userDepositThreshold, pheasantNetworkDisputeManager.address);
    } else if(network == "polygon") {
      const tokenAddressList = [
        contractAddressObj[network].WETH
      ];
      await deployer.deploy(RLPDecoder);
      await deployer.link(RLPDecoder, PheasantNetworkBridgeChild);
      await deployer.link(RLPDecoder, PheasantNetworkDisputeManager);
      await deployer.deploy(PheasantNetworkDisputeManager, contractAddressObj[network].PolygonChildCheckPointManager);
      const pheasantNetworkDisputeManager = await PheasantNetworkDisputeManager.deployed();
      //return await deployer.deploy(PheasantNetworkBridgeChild, polygonTokenAddress, userDepositThreshold, pheasantNetworkDisputeManager.address);
      return await deployer.deploy(PheasantNetworkBridgeChild, tokenAddressList, userDepositThreshold, pheasantNetworkDisputeManager.address);

    }
  });
};
