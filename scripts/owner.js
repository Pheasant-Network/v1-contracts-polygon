const HDWalletProvider = require("@truffle/hdwallet-provider");
require('dotenv').config({ path: '../.env' });
const Web3 = require('web3');
const readlineSync = require('readline-sync')
const fs = require('fs');
const utils = require('../migrations/utils')
const BN = require('bn.js');

const bridge = JSON.parse(fs.readFileSync('../build/contracts/PheasantNetworkBridgeChild.json', 'utf8'));
let contractAddressObj = utils.getContractAddresses("../")
const abi = bridge.abi;

const web3_mumbai = new Web3(new HDWalletProvider({
  mnemonic: process.env.MNEMONIC,
  providerOrUrl: process.env.PROVIDER_MUMBAI,
  chainId: 80001
}));

const web3_polygon = new Web3(new HDWalletProvider({
  mnemonic: process.env.MNEMONIC,
  providerOrUrl: process.env.PROVIDER_POLYGON,
  chainId: 137
}));

const main = async () => {
  const accounts = await web3_mumbai.eth.getAccounts();
  const address = bridge.networks[80001].address;
  const polygonAddress = bridge.networks[137].address;
  const bridgeContract = new web3_mumbai.eth.Contract(abi , address);
  const polygonBridgeContract = new web3_polygon.eth.Contract(abi , polygonAddress);
  const newOwner = "0xd98ec8eefd324e295bead16c5f451238156e1a6a";

  //let response = await polygonBridgeContract.methods.transferOwnership(newOwner).send({from:accounts[0], gas: 450000,gasPrice: 40000000000});
  let response = await bridgeContract.methods.transferOwnership(newOwner).send({from:accounts[0], gas: 450000,gasPrice: 40000000000});
  console.log(response);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


