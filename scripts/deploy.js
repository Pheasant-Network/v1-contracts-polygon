// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
const BN = require('bn.js');
const userDepositThreshold = "100000000000000000";
const utils = require('./utils')
const disputeManagerContractPath = "../bridge-dispute-manager/";
require('dotenv').config({ path: '../.env' });

async function main() {
  let contractAddressObj = utils.getContractAddresses()
  let disputeManagerContractAddressObj = utils.getContractAddresses(disputeManagerContractPath)
  const accounts =  await ethers.getSigners();
  console.log("Network name =", hre.network.name);
  const tokenAddressList = [];
  let disputeManagerAddress = "";
  let newOwner = "";

  if(hre.network.name == "localhost") {
    const TestToken = await hre.ethers.getContractFactory("TestToken");
    const testToken = await TestToken.deploy(accounts[0].address);
    console.log("TestToken address:", testToken.address);
    tokenAddressList.push(testToken.address);
    contractAddressObj[hre.network.name].TestToken = testToken.address;
    utils.writeContractAddresses(contractAddressObj)

    const TestDisputeManager = await hre.ethers.getContractFactory("TestDisputeManager");
    const testDisputeManager = await TestDisputeManager.deploy();
    disputeManagerAddress = testDisputeManager.address;
    newOwner = accounts[0].address;

  } else if(hre.network.name == "mumbai" || hre.network.name == "polygon") {
    newOwner = process.env.NEW_OWNER;
    tokenAddressList.push(contractAddressObj[hre.network.name].WETH);
    disputeManagerAddress = disputeManagerContractAddressObj[hre.network.name].BridgeDisputeManager
  }

  const RLPDecoder = await hre.ethers.getContractFactory("RLPDecoder");
  const rlpDecoder = await RLPDecoder.deploy();
  const PheasantNetworkBridgeChild = await hre.ethers.getContractFactory("PheasantNetworkBridgeChild", {
    libraries: {
      RLPDecoder: rlpDecoder.address,
    },
  });

  const pheasantNetworkBridgeChild = await PheasantNetworkBridgeChild.connect(accounts[0]).deploy(tokenAddressList, userDepositThreshold, disputeManagerAddress, newOwner);

  console.log("PheasantNetworkBridgeChild address:", pheasantNetworkBridgeChild.address);
  const Helper = await hre.ethers.getContractFactory("Helper", {
    libraries: {
      RLPDecoder: rlpDecoder.address,
    },
  });
  const helper = await Helper.deploy(tokenAddressList, userDepositThreshold, disputeManagerAddress, newOwner);
  console.log("Helper address:", helper.address);

  contractAddressObj[hre.network.name].PheasantNetworkBridgeChild = pheasantNetworkBridgeChild.address;
  utils.writeContractAddresses(contractAddressObj)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
