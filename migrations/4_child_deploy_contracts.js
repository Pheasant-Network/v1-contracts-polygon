const PolygonChildCheckPointManager = artifacts.require("PolygonChildCheckPointManager");
const fxChildMumbai = "0xCf73231F28B7331BBe3124B907840A94851f9f11";
const fxChildPolygon = "0x8397259c983751DAf40400790063935a11afa28a";
const utils = require('./utils')
 
module.exports = function(deployer, network, accounts) {

  if (network != "mumbai" && network != "polygon") {
    return;
  }

  let contractAddressObj = utils.getContractAddresses()
  deployer.then(async() => {
    if (network == "mumbai") {
      await deployer.deploy(PolygonChildCheckPointManager, fxChildMumbai);
    } else if(network == "polygon") {
      await deployer.deploy(PolygonChildCheckPointManager, fxChildPolygon);
    }

    if(contractAddressObj[network] == undefined) {
      contractAddressObj[network] = {}
    }
    contractAddressObj[network].PolygonChildCheckPointManager = PolygonChildCheckPointManager.address;
    utils.writeContractAddresses(contractAddressObj)

  });


};
