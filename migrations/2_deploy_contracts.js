const TestToken = artifacts.require("TestToken");
const PheasantNetworkBridgeChild = artifacts.require("PheasantNetworkBridgeChild");
const Helper = artifacts.require("Helper");
const RLPDecoder = artifacts.require("RLPDecoder");

const mumbaiTokenAddress = "0xbb41BD3539D3aDcA6a184D8771aEf72D959912cf";
const mumbaiRLPDecoderAddress = "0xad61C11dC1C4fB7358bd974037C8aA8b8021eA41";
const polygonTokenAddress = "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619";
const polygonRLPDecoderAddress = "0x73bD253d3F5b97F9B25423D47d015a17B2345580";

module.exports = function(deployer, network, accounts) {

  deployer.then(async() => {
    if (network == "development") {
      await deployer.deploy(RLPDecoder);
      await deployer.link(RLPDecoder, PheasantNetworkBridgeChild);
      await deployer.link(RLPDecoder, Helper);
      await deployer.deploy(TestToken, accounts[0]);
      const testToken = await TestToken.deployed();
      return await deployer.deploy(PheasantNetworkBridgeChild, testToken.address);
      return await deployer.deploy(Helper, testToken.address);

    } else if(network == "mumbai") {
      RLPDecoder.address = mumbaiRLPDecoderAddress
      await deployer.link(RLPDecoder, PheasantNetworkBridgeChild);
      return await deployer.deploy(PheasantNetworkBridgeChild, mumbaiTokenAddress);
    } else if(network == "polygon") {
      await deployer.deploy(RLPDecoder);
      await deployer.link(RLPDecoder, PheasantNetworkBridgeChild);

      return await deployer.deploy(PheasantNetworkBridgeChild, polygonTokenAddress);
    } else {
      return await deployer.deploy(TestToken, accounts[0]);
    }
  });
};
