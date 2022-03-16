const PolygonRootCheckPointManager = artifacts.require("PolygonRootCheckPointManager");
const checkpointGoerli = "0x2890bA17EfE978480615e330ecB65333b880928e";
const fxRootGoerli = "0x3d1d3E34f7fB6D26245E6640E1c50710eFFf15bA";
const checkpointEthereumMainnet = "0x86E4Dc95c7FBdBf52e33D563BbDB00823894C287";
const fxRootEthereumMainnet = "0xfe5e5D361b2ad62c541bAb87C45a0B9B018389a2";

const utils = require('./utils')
 
module.exports = function(deployer, network, accounts) {
  if (network != "goerli" && network != "mainnet") {
    return;
  }

  let contractAddressObj = utils.getContractAddresses()
  deployer.then(async() => {
    if (network == "goerli") {
      await deployer.deploy(PolygonRootCheckPointManager, checkpointGoerli, fxRootGoerli);
    } else if(network == "mainnet") {
      await deployer.deploy(PolygonRootCheckPointManager, checkpointEthereumMainnet, fxRootEthereumMainnet);
    }

    if(contractAddressObj[network] == undefined) {
      contractAddressObj[network] = {}
    }
    contractAddressObj[network].PolygonRootCheckPointManager = PolygonRootCheckPointManager.address;
    utils.writeContractAddresses(contractAddressObj)

  });

};
