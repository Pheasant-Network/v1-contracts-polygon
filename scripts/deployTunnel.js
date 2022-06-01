// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
const utils = require('./utils')
const fxChildMumbai = "0xCf73231F28B7331BBe3124B907840A94851f9f11";
const fxChildPolygon = "0x8397259c983751DAf40400790063935a11afa28a";
const checkpointGoerli = "0x2890bA17EfE978480615e330ecB65333b880928e";
const fxRootGoerli = "0x3d1d3E34f7fB6D26245E6640E1c50710eFFf15bA";
const checkpointEthereumMainnet = "0x86E4Dc95c7FBdBf52e33D563BbDB00823894C287";
const fxRootEthereumMainnet = "0xfe5e5D361b2ad62c541bAb87C45a0B9B018389a2";

async function main() {
  let contractAddressObj = utils.getContractAddresses()
  const accounts =  await ethers.getSigners();
  console.log("Network name =", hre.network.name);
  let fxChild = "";
  let fxRoot = "";
  let checkPoint = "";

  const PolygonChildCheckPointManager = await hre.ethers.getContractFactory("PolygonChildCheckPointManager");
  const PolygonRootCheckPointManager = await hre.ethers.getContractFactory("PolygonRootCheckPointManager");
  if(hre.network.name == "mumbai") {
    fxChild = fxChildMumbai;
  } else if(hre.network.name == "polygon") {
    fxChild = fxChildPolygon;
  } else if(hre.network.name == "goerli") {
    fxRoot = fxRootGoerli;
    checkPoint = checkpointGoerli;
  } else if(hre.network.name == "mainnet") {
    fxRoot = fxRootEthereumMainnet;
    checkPoint = checkpointEthereumMainnet;
  }

  if(hre.network.name == "mumbai" || hre.network.name == "polygon") {
    const polygonChildCheckPointManager = await PolygonChildCheckPointManager.connect(accounts[0]).deploy(fxChild);
    console.log("PolygonChildCheckPointManager address:", polygonChildCheckPointManager.address);
    console.log("PolygonChildCheckPointManager TxHash:", polygonChildCheckPointManager.deployTransaction.hash);
    contractAddressObj[hre.network.name].PolygonChildCheckPointManager = polygonChildCheckPointManager.address;
  }else if(hre.network.name == "goerli" || hre.network.name == "mainnet") {
    const polygonRootCheckPointManager = await PolygonRootCheckPointManager.connect(accounts[0]).deploy(checkPoint, fxRoot);
    console.log("PolygonRootCheckPointManager address:", polygonRootCheckPointManager.address);
    console.log("PolygonRootCheckPointManager TxHash:", polygonRootCheckPointManager.deployTransaction.hash);
    contractAddressObj[hre.network.name].PolygonRootCheckPointManager = polygonRootCheckPointManager.address;
  }

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
